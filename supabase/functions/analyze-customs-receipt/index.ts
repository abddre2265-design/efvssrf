import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to convert ArrayBuffer to base64 without stack overflow
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000; // 32KB chunks to avoid stack overflow
  
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  
  return btoa(binary);
}

// Types of customs receipts (quittances)
const QUITTANCE_TYPES = [
  'droits_taxes_importation', // Quittance droits et taxes (importation) - DEFAULT
  'regularisation',           // Quittance de régularisation
  'penalite_amende',          // Quittance de pénalité / amende
  'consignation_garantie',    // Quittance de consignation / garantie
  'autre',                    // Autre quittance douanière
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return new Response(
        JSON.stringify({ error: 'No file provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing customs receipt:', file.name, 'Size:', file.size);

    // Convert file to base64 using chunked approach (handles large files)
    const arrayBuffer = await file.arrayBuffer();
    const base64 = arrayBufferToBase64(arrayBuffer);

    console.log('Base64 conversion complete, length:', base64.length);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      console.log('No LOVABLE_API_KEY found, using fallback extraction');
      return new Response(
        JSON.stringify({
          quittanceType: 'droits_taxes_importation',
          customsOffice: '',
          documentNumber: '',
          documentDate: new Date().toISOString().split('T')[0],
          totalAmount: 0,
          customsDeclarationNumber: '',
          importerName: '',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Calling AI API for customs receipt analysis...');

    // Call Lovable AI Gateway for document analysis
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
                text: `Tu es un expert en OCR et extraction de données de documents douaniers tunisiens (quittances douanières).
Analyse le document PDF fourni et extrait les informations suivantes avec précision:

1. **Type de quittance (quittanceType)**: Identifie le type de quittance douanière parmi ces options:
   - "droits_taxes_importation" : Quittance de droits et taxes d'importation (par défaut si non déterminé)
   - "regularisation" : Quittance de régularisation
   - "penalite_amende" : Quittance de pénalité ou amende douanière
   - "consignation_garantie" : Quittance de consignation ou garantie
   - "autre" : Autre type de quittance douanière
   
   Indices: Cherche des mots-clés comme "droits de douane", "taxe", "régularisation", "pénalité", "amende", "consignation", "garantie", etc.

2. **Bureau des douanes (customsOffice)**: Le nom du bureau ou recette des douanes émetteur. Cherche des termes comme "Bureau", "Recette", "Douane de", suivi du nom de la ville/région.

3. **Numéro de quittance (documentNumber)**: Le numéro de la quittance. Cherche "N°", "Quittance N°", "N° Quittance", etc.

4. **Date de la quittance (documentDate)**: La date d'émission au format YYYY-MM-DD. Cherche "Date:", "Le:", "Fait le:", "Tunis le:", etc.

5. **Montant total (totalAmount)**: Le montant total de la quittance en dinars tunisiens (TND). Cherche "Total", "Montant", "A payer", "Arrêté à la somme de", etc. Extrait uniquement le nombre sans devise.

6. **Numéro de déclaration douanière (customsDeclarationNumber)**: Le numéro de la déclaration en douane associée (si présent). Cherche "Déclaration N°", "D.U. N°", "Référence déclaration", etc.

7. **Raison sociale importateur (importerName)**: Le nom de l'entreprise importatrice. Cherche "Importateur:", "Redevable:", "Opérateur:", "Société:", etc.

Réponds UNIQUEMENT en JSON valide avec ce format exact, sans aucun texte avant ou après:
{
  "quittanceType": "droits_taxes_importation",
  "customsOffice": "Nom du bureau des douanes",
  "documentNumber": "Numéro exact de la quittance",
  "documentDate": "YYYY-MM-DD",
  "totalAmount": 0,
  "customsDeclarationNumber": "Numéro déclaration si présent",
  "importerName": "Raison sociale importateur"
}

IMPORTANT: 
- Ne mets pas de markdown ni de backticks, juste le JSON pur.
- Si tu ne peux pas extraire une information, utilise une chaîne vide "" (ou 0 pour totalAmount).
- Pour la date, convertis toujours au format YYYY-MM-DD (ex: 15/01/2026 devient 2026-01-15).
- Pour le montant, extrait uniquement la valeur numérique sans devise ni espaces.
- Le quittanceType doit être une des 5 valeurs exactes listées ci-dessus.`,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:application/pdf;base64,${base64}`,
                },
              },
            ],
          },
        ],
        max_tokens: 800,
        temperature: 0.1,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error(`AI analysis failed: ${aiResponse.status}`);
    }

    const aiResult = await aiResponse.json();
    const content = aiResult.choices?.[0]?.message?.content || '{}';
    
    console.log('AI response content:', content);
    
    // Parse JSON from AI response
    let extractedData;
    try {
      // Clean up the response in case it has markdown code blocks
      let cleanContent = content
        .replace(/```json\n?/gi, '')
        .replace(/```\n?/g, '')
        .trim();
      
      // Find JSON object in the response
      const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanContent = jsonMatch[0];
      }
      
      extractedData = JSON.parse(cleanContent);
      
      // Validate quittanceType
      if (!QUITTANCE_TYPES.includes(extractedData.quittanceType)) {
        extractedData.quittanceType = 'droits_taxes_importation';
      }
      
      // Parse totalAmount as number
      if (typeof extractedData.totalAmount === 'string') {
        extractedData.totalAmount = parseFloat(extractedData.totalAmount.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
      }
      
      console.log('Extracted customs receipt data:', extractedData);
    } catch (e) {
      console.error('Failed to parse AI response:', content, e);
      extractedData = {
        quittanceType: 'droits_taxes_importation',
        customsOffice: '',
        documentNumber: '',
        documentDate: new Date().toISOString().split('T')[0],
        totalAmount: 0,
        customsDeclarationNumber: '',
        importerName: '',
      };
    }

    return new Response(
      JSON.stringify(extractedData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error:', errorMessage);
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        quittanceType: 'droits_taxes_importation',
        customsOffice: '',
        documentNumber: '',
        documentDate: new Date().toISOString().split('T')[0],
        totalAmount: 0,
        customsDeclarationNumber: '',
        importerName: '',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
