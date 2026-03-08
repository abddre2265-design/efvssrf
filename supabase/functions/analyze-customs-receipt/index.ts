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
        model: 'google/gemini-1.5-flash',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Ceci est une quittance douanière tunisienne.
Extrais les données suivantes en JSON:
1. **quittanceType**: Type ("droits_taxes_importation", "regularisation", "penalite_amende", "consignation_garantie", "autre").
2. **customsOffice**: Nom du bureau (ex: "Goulette", "Sfax"). Mets null si non trouvé.
3. **documentNumber**: N° de quittance. Mets null si non trouvé.
4. **documentDate**: Date au format YYYY-MM-DD. Mets null si non trouvé.
5. **totalAmount**: Montant total payé (nombre). Mets 0 si non trouvé.
6. **customsDeclarationNumber**: N° Déclaration ou D.U. Mets null si non trouvé.
7. **importerName**: Nom de l'importateur. Mets null si non trouvé.

Exemple de réponse:
{
  "quittanceType": "droits_taxes_importation",
  "customsOffice": "Goulette",
  "documentNumber": "2026/123",
  "documentDate": "2026-02-15",
  "totalAmount": 1500.500,
  "customsDeclarationNumber": null,
  "importerName": null
}

Règle stricte: Rends UNIQUEMENT un objet JSON valide, sans balises markdown.`,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:application/pdf;base64,${base64}`,
                  detail: 'high'
                },
              },
            ],
          },
        ],
        max_tokens: 1500,
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
