import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Tu es un expert en comptabilité. Analyse cette facture ou document d'achat.
Extrais les informations suivantes en JSON pur:
1. **supplier** : Le nom de l'entreprise qui VEND / ÉMET la facture. Cherche le logo, l'en-tête, le matricule fiscal (MF) ou ICE. Si c'est illisible, mets null.
2. **documentNumber** : Le numéro de la facture ou du document. Cherche "N°", "Facture", "Invoice". Si introuvable, mets null.
3. **documentDate** : La date du document au format YYYY-MM-DD. Si introuvable, mets null.

Exemple de réponse attendue:
{
  "supplier": "Société Exemple SARL",
  "documentNumber": "F-2026-0012",
  "documentDate": "2026-01-15"
}

Règle stricte: Rends UNIQUEMENT un objet JSON valide, sans balises markdown (\`\`\`json). Ne mets pas de texte avant ou après.`,
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
