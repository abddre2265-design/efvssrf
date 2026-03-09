import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

function normalizeFiscalId(raw: string): string {
  if (!raw) return '';
  const cleaned = raw.replace(/[\s\-\.]/g, '').toUpperCase();
  // Extract NNNNNNNX pattern (7 digits + 1 letter)
  const match = cleaned.match(/(\d{7}[A-Z])/);
  return match ? match[1] : cleaned;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const expectedDataStr = formData.get('expectedData') as string;

    if (!file || !expectedDataStr) {
      return new Response(
        JSON.stringify({ success: false, errors: ['Fichier et données attendues requis'] }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const expectedData = JSON.parse(expectedDataStr);
    console.log('Expected data:', expectedData);

    const arrayBuffer = await file.arrayBuffer();
    const base64 = arrayBufferToBase64(arrayBuffer);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, errors: ['Configuration AI manquante'] }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Tu es un expert en fiscalité tunisienne. Analyse ce certificat de retenue à la source.
Extrais les informations suivantes en JSON pur :

1. "payment_date" : La date de paiement (format YYYY-MM-DD). Cherche "Date de paiement" ou similaire.
2. "billing_year" : L'exercice de facturation (année). Cherche "Exercice" ou "Année".
3. "payer_identifier" : L'identifiant (matricule fiscal) dans le bloc "Personne ou organisme Payeur". Cherche le champ "Identifiant" dans ce bloc.
4. "beneficiary_identifier" : L'identifiant (matricule fiscal) dans le bloc "Bénéficiaire". Cherche le champ "Identifiant" dans ce bloc.
5. "total_ttc" : Le "Montant total TVA comprise" ou "Montant brut" dans le dernier bloc du certificat. C'est un nombre décimal.
6. "withholding_rate" : Le "Taux de la retenue" en pourcentage. C'est un nombre (ex: 1.5 pour 1,5%).

Exemple de réponse :
{
  "payment_date": "2025-12-31",
  "billing_year": 2025,
  "payer_identifier": "0123123V",
  "beneficiary_identifier": "9876543A",
  "total_ttc": 5000.000,
  "withholding_rate": 1.5
}

Règle stricte: Rends UNIQUEMENT un objet JSON valide, sans balises markdown. Ne mets pas de texte avant ou après.`,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:application/pdf;base64,${base64}`,
                  detail: 'high',
                },
              },
            ],
          },
        ],
        max_tokens: 2000,
        temperature: 0.1,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      return new Response(
        JSON.stringify({ success: false, errors: ['Erreur d\'analyse AI du certificat'] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiResult = await aiResponse.json();
    const content = aiResult.choices?.[0]?.message?.content || '{}';
    console.log('AI raw response:', content);

    let extractedData;
    try {
      let cleanContent = content.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
      const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) cleanContent = jsonMatch[0];
      extractedData = JSON.parse(cleanContent);
    } catch (e) {
      console.error('Failed to parse AI response:', content, e);
      return new Response(
        JSON.stringify({ success: false, errors: ['Impossible de lire le contenu du certificat. Vérifiez la qualité du PDF.'] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Extracted data:', extractedData);

    // Validation
    const validationErrors: string[] = [];

    // 1. Payment date
    if (expectedData.payment_date && extractedData.payment_date) {
      const expectedDate = expectedData.payment_date;
      const extractedDate = extractedData.payment_date;
      if (expectedDate !== extractedDate) {
        validationErrors.push(
          `Date de paiement : le certificat indique "${extractedDate}" mais la demande indique "${expectedDate}"`
        );
      }
    } else if (!extractedData.payment_date) {
      validationErrors.push('Date de paiement non trouvée dans le certificat');
    }

    // 2. Billing year = year of payment date
    if (expectedData.payment_date && extractedData.billing_year) {
      const expectedYear = parseInt(expectedData.payment_date.substring(0, 4));
      const extractedYear = parseInt(extractedData.billing_year);
      if (expectedYear !== extractedYear) {
        validationErrors.push(
          `Exercice de facturation : le certificat indique "${extractedYear}" mais l'année de paiement est "${expectedYear}"`
        );
      }
    }

    // 3. Payer identifier (client) 
    if (expectedData.client_identifier && extractedData.payer_identifier) {
      const normalizedExpected = normalizeFiscalId(expectedData.client_identifier);
      const normalizedExtracted = normalizeFiscalId(extractedData.payer_identifier);
      if (normalizedExpected !== normalizedExtracted) {
        validationErrors.push(
          `Identifiant Payeur : le certificat indique "${extractedData.payer_identifier}" (normalisé: ${normalizedExtracted}) mais l'identifiant client est "${expectedData.client_identifier}" (normalisé: ${normalizedExpected})`
        );
      }
    } else if (!extractedData.payer_identifier) {
      validationErrors.push('Identifiant du Payeur non trouvé dans le certificat');
    }

    // 4. Beneficiary identifier (organization)
    if (expectedData.organization_identifier && extractedData.beneficiary_identifier) {
      const normalizedExpected = normalizeFiscalId(expectedData.organization_identifier);
      const normalizedExtracted = normalizeFiscalId(extractedData.beneficiary_identifier);
      if (normalizedExpected !== normalizedExtracted) {
        validationErrors.push(
          `Identifiant Bénéficiaire : le certificat indique "${extractedData.beneficiary_identifier}" (normalisé: ${normalizedExtracted}) mais l'identifiant organisation est "${expectedData.organization_identifier}" (normalisé: ${normalizedExpected})`
        );
      }
    } else if (!extractedData.beneficiary_identifier) {
      validationErrors.push('Identifiant du Bénéficiaire non trouvé dans le certificat');
    }

    // 5. Total TTC
    if (expectedData.total_ttc !== undefined && extractedData.total_ttc !== undefined) {
      const expectedTTC = parseFloat(expectedData.total_ttc);
      const extractedTTC = parseFloat(extractedData.total_ttc);
      if (Math.abs(expectedTTC - extractedTTC) > 0.01) {
        validationErrors.push(
          `Montant total TTC : le certificat indique ${extractedTTC.toFixed(3)} mais la demande indique ${expectedTTC.toFixed(3)}`
        );
      }
    } else if (extractedData.total_ttc === undefined || extractedData.total_ttc === null) {
      validationErrors.push('Montant total TTC non trouvé dans le certificat');
    }

    // 6. Withholding rate
    if (expectedData.withholding_rate !== undefined && extractedData.withholding_rate !== undefined) {
      const expectedRate = parseFloat(expectedData.withholding_rate);
      const extractedRate = parseFloat(extractedData.withholding_rate);
      if (Math.abs(expectedRate - extractedRate) > 0.01) {
        validationErrors.push(
          `Taux de retenue : le certificat indique ${extractedRate}% mais le taux attendu est ${expectedRate}%`
        );
      }
    } else if (extractedData.withholding_rate === undefined || extractedData.withholding_rate === null) {
      validationErrors.push('Taux de retenue non trouvé dans le certificat');
    }

    const success = validationErrors.length === 0;
    console.log('Validation result:', { success, errors: validationErrors });

    return new Response(
      JSON.stringify({
        success,
        errors: validationErrors,
        extractedData,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, errors: [errorMessage] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
