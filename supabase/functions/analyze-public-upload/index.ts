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

    console.log('Processing file:', file.name, 'Size:', file.size);

    // Convert file to base64 using chunked approach (handles large files)
    const arrayBuffer = await file.arrayBuffer();
    const base64 = arrayBufferToBase64(arrayBuffer);

    console.log('Base64 conversion complete, length:', base64.length);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      console.log('No LOVABLE_API_KEY found, using fallback extraction');
      // Fallback: extract from filename
      const filename = file.name.replace('.pdf', '');
      const parts = filename.split('_');

      return new Response(
        JSON.stringify({
          supplier: parts[0] || '',
          documentNumber: parts[1] || '',
          documentDate: parts[2] || new Date().toISOString().split('T')[0],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Calling AI API for document analysis...');

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
                text: `Tu es un expert en OCR et extraction de données de documents comptables tunisiens et internationaux.
Analyse le document PDF fourni et extrait les informations suivantes:

1. **Fournisseur (supplier)**: Le nom de l'entreprise qui émet le document (VENDEUR). 
   - Cherche en haut du document (logo, en-tête principal, adresse).
   - ⚠️ IMPORTANT: Ne confonds pas avec le Client (Facturé à, Destinataire).
   - Si tu ne trouves pas de nom clair, cherche une adresse ou un matricule fiscal pour déduire le nom.

2. **Numéro du document (documentNumber)**: Le numéro de facture, bon de livraison (BL), ou référence. 
   - Cherche: "N°", "Facture", "BL", "Reference", "Invoice", "Piece", "n/ref".

3. **Date du document (documentDate)**: La date d'émission (format YYYY-MM-DD).

Réponds UNIQUEMENT en JSON valide avec ce format exact, sans aucun texte avant ou après. 
NE METS PAS LES LABELS DANS LES VALEURS PAR DÉFAUT SI NON TROUVÉ.
{
  "supplier": "",
  "documentNumber": "",
  "documentDate": ""
}

IMPORTANT: 
- Pas de markdown.
- Si inconnu, laisse une chaîne vide "".
- Pour la date, convertis toujours au format YYYY-MM-DD (ex: 15/01/2026 devient 2026-01-15).`,
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
        max_tokens: 1000,
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
      console.log('Extracted data:', extractedData);
    } catch (e) {
      console.error('Failed to parse AI response:', content, e);
      extractedData = {
        supplier: '',
        documentNumber: '',
        documentDate: new Date().toISOString().split('T')[0],
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
        supplier: '',
        documentNumber: '',
        documentDate: new Date().toISOString().split('T')[0],
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
