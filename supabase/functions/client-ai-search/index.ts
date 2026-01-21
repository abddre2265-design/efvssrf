import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ClientData {
  id: string;
  name: string;
  type: string;
  status: string;
  identifier_type: string;
  identifier_value: string;
  email: string | null;
  phone: string | null;
  country: string;
  governorate: string | null;
  address: string | null;
  account_balance: number;
  invoices: { count: number; total: number; unpaid: number };
  credit_notes: { count: number; total: number };
  movements: { deposits: number; payments: number };
  has_invoices: boolean;
  has_unpaid_invoices: boolean;
  has_credit_notes: boolean;
  has_deposits: boolean;
}

interface SearchRequest {
  query: string;
  clients: ClientData[];
  language: 'fr' | 'en' | 'ar';
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, clients, language } = await req.json() as SearchRequest;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are an intelligent client search assistant for a business management system. Your job is to understand natural language queries and filter clients accordingly.

You have access to client data including:
- Basic info: name, type (individual_local/business_local/foreign), status (active/archived)
- Identity: identifier_type, identifier_value
- Contact: email, phone, country, governorate, address
- Financial: account_balance (credit available)
- Activity:
  - invoices: count, total amount, unpaid count
  - credit_notes: count, total amount
  - movements: total deposits, total payments
  - has_invoices, has_unpaid_invoices, has_credit_notes, has_deposits

IMPORTANT RULES:
1. Analyze the user's intent and filter clients that match their criteria
2. Support queries in French, English, and Arabic
3. Understand semantic queries like:
   - "clients with unpaid invoices" → has_unpaid_invoices = true
   - "clients with credit balance" → account_balance > 0
   - "big customers" / "gros clients" → high invoice total
   - "inactive clients" / "clients inactifs" → no recent invoices or status = archived
   - "foreign clients" / "clients étrangers" → type = 'foreign'
   - "business clients" / "sociétés" → type = 'business_local'
   - "clients with deposits" → has_deposits = true
   - "clients without invoices" → has_invoices = false
   - "clients from Tunis" → governorate or address contains 'tunis'
   - "clients with credit notes" → has_credit_notes = true
   - "top spenders" → high invoice total
4. Return client IDs that match, along with a brief explanation
5. Suggest related searches when helpful

Response format (JSON):
{
  "filteredClientIds": ["id1", "id2", ...],
  "explanation": "Brief explanation of what was found",
  "suggestions": ["related search 1", "related search 2"]
}

Respond in ${language === 'fr' ? 'French' : language === 'ar' ? 'Arabic' : 'English'}.`;

    const userPrompt = `Query: "${query}"

Clients data:
${JSON.stringify(clients, null, 2)}

Analyze the query and return matching client IDs with explanation.`;

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
          filteredClientIds: clients.map(c => c.id),
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
          filteredClientIds: clients.map(c => c.id),
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
    console.error("Client AI search error:", error);
    
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error",
      filteredClientIds: [],
      explanation: "Search error occurred",
      suggestions: []
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
