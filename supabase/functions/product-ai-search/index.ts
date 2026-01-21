import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProductData {
  id: string;
  name: string;
  reference: string | null;
  ean: string | null;
  type: string;
  status: string;
  vat_rate: number;
  price_ht: number;
  price_ttc: number;
  stock: number | string;
  unit: string | null;
  year: number;
  max_discount: number | null;
  total_sold: number;
  total_purchased: number;
  has_sales: boolean;
  has_purchases: boolean;
  recent_activity: string[];
}

interface SearchRequest {
  query: string;
  products: ProductData[];
  language: 'fr' | 'en' | 'ar';
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, products, language } = await req.json() as SearchRequest;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are an intelligent product search assistant for an inventory management system. Your job is to understand natural language queries and filter products accordingly.

You have access to product data including:
- Basic info: name, reference, EAN/barcode, type (physical/service), status (active/archived)
- Pricing: price_ht (excl. tax), price_ttc (incl. tax), vat_rate, max_discount
- Stock: current stock level, unit of measure
- Activity: total_sold, total_purchased, has_sales, has_purchases, recent_activity
- Year: purchase year

IMPORTANT RULES:
1. Analyze the user's intent and filter products that match their criteria
2. Support queries in French, English, and Arabic
3. Understand semantic queries like:
   - "produits en rupture" → stock = 0
   - "best sellers" → high total_sold
   - "never sold" → total_sold = 0
   - "expensive products" → high price
   - "old stock" → low purchase_year or no recent activity
   - "services only" → type = 'service'
   - "archived items" → status = 'archived'
4. Return product IDs that match, along with a brief explanation
5. Suggest related searches when helpful

Response format (JSON):
{
  "filteredProductIds": ["id1", "id2", ...],
  "explanation": "Brief explanation of what was found",
  "suggestions": ["related search 1", "related search 2"]
}

Respond in ${language === 'fr' ? 'French' : language === 'ar' ? 'Arabic' : 'English'}.`;

    const userPrompt = `Query: "${query}"

Products data:
${JSON.stringify(products, null, 2)}

Analyze the query and return matching product IDs with explanation.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ 
          error: "Rate limit exceeded",
          filteredProductIds: products.map(p => p.id),
          explanation: "AI search temporarily unavailable",
          suggestions: []
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ 
          error: "Payment required",
          filteredProductIds: products.map(p => p.id),
          explanation: "AI search requires credits",
          suggestions: []
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error("No response from AI");
    }

    // Parse JSON from response (handle markdown code blocks)
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    const result = JSON.parse(jsonStr);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Product AI search error:", error);
    
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error",
      filteredProductIds: [],
      explanation: "Search error occurred",
      suggestions: []
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
