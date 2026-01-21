import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InvoiceData {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  client_name: string;
  client_type: string;
  client_identifier: string;
  status: string;
  payment_status: string;
  currency: string;
  subtotal_ht: number;
  total_vat: number;
  total_discount: number;
  total_ttc: number;
  stamp_duty_amount: number;
  net_payable: number;
  paid_amount: number;
  remaining_amount: number;
  withholding_applied: boolean;
  withholding_amount: number;
  lines_count: number;
  lines_products: string[];
  payments_count: number;
  total_payments: number;
  credit_notes_count: number;
  total_credited: number;
  days_overdue: number;
  is_overdue: boolean;
}

interface SearchRequest {
  query: string;
  invoices: InvoiceData[];
  language: 'fr' | 'en' | 'ar';
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, invoices, language } = await req.json() as SearchRequest;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are an intelligent invoice search assistant for a business management system. Your job is to understand natural language queries and filter invoices accordingly.

You have access to invoice data including:
- Basic info: invoice_number, invoice_date, due_date, status (created/draft/validated), payment_status (unpaid/partial/paid)
- Client: client_name, client_type (individual_local/business_local/foreign), client_identifier
- Amounts: subtotal_ht, total_vat, total_discount, total_ttc, stamp_duty_amount, net_payable, paid_amount, remaining_amount
- Currency: currency (TND, EUR, USD, etc.)
- Withholding: withholding_applied, withholding_amount
- Lines: lines_count, lines_products (array of product names)
- Payments: payments_count, total_payments
- Credit notes: credit_notes_count, total_credited
- Due dates: days_overdue (negative = not yet due), is_overdue

IMPORTANT RULES:
1. Analyze the user's intent and filter invoices that match their criteria
2. Support queries in French, English, and Arabic
3. Understand semantic queries like:
   - "unpaid invoices" / "factures impayées" → payment_status = 'unpaid' or 'partial'
   - "overdue invoices" / "factures en retard" / "échues" → is_overdue = true
   - "paid invoices" / "factures payées" → payment_status = 'paid'
   - "draft invoices" / "brouillons" → status = 'draft'
   - "validated invoices" / "factures validées" → status = 'validated'
   - "foreign client invoices" / "factures clients étrangers" → client_type = 'foreign'
   - "large invoices" / "grosses factures" → high total_ttc or net_payable
   - "small invoices" → low total_ttc or net_payable
   - "invoices with credit notes" / "factures avec avoirs" → credit_notes_count > 0
   - "invoices with withholding" / "avec retenue à la source" → withholding_applied = true
   - "invoices from January" / "factures de janvier" → check invoice_date month
   - "invoices this month" / "factures du mois" → current month
   - "invoices for client X" → client_name contains X
   - "invoices with product X" → lines_products contains X
   - "partially paid" / "partiellement payées" → payment_status = 'partial'
   - "invoices over 1000" / "factures supérieures à 1000" → total_ttc > 1000
   - "recent invoices" / "factures récentes" → most recent invoice_date
   - "old invoices" / "anciennes factures" → oldest invoice_date
   - "invoices due soon" / "échéance proche" → days_overdue between -7 and 0
   - "invoices in EUR/USD" → currency = EUR/USD
   - "invoices with discounts" / "factures avec remise" → total_discount > 0
   - "invoices without payments" → payments_count = 0
   - "invoices with multiple products" → lines_count > 1
4. Return invoice IDs that match, along with a brief explanation
5. Suggest related searches when helpful
6. For amount-based queries, consider both total_ttc (for local) and net_payable

Response format (JSON):
{
  "filteredInvoiceIds": ["id1", "id2", ...],
  "explanation": "Brief explanation of what was found",
  "suggestions": ["related search 1", "related search 2"],
  "stats": {
    "total_amount": 12345.67,
    "unpaid_amount": 5000.00,
    "count": 5
  }
}

Respond in ${language === 'fr' ? 'French' : language === 'ar' ? 'Arabic' : 'English'}.`;

    const userPrompt = `Query: "${query}"

Invoices data:
${JSON.stringify(invoices, null, 2)}

Analyze the query and return matching invoice IDs with explanation and statistics.`;

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
          filteredInvoiceIds: invoices.map(i => i.id),
          explanation: "AI search temporarily unavailable",
          suggestions: [],
          stats: null
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ 
          error: "Payment required",
          filteredInvoiceIds: invoices.map(i => i.id),
          explanation: "AI search requires credits",
          suggestions: [],
          stats: null
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
    console.error("Invoice AI search error:", error);
    
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error",
      filteredInvoiceIds: [],
      explanation: "Search error occurred",
      suggestions: [],
      stats: null
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
