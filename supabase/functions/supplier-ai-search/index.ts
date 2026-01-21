import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();
    
    if (!query || typeof query !== 'string') {
      return new Response(
        JSON.stringify({ error: "Query is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authorization header to extract user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user from token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's organization
    const { data: org } = await supabase
      .from("organizations")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!org) {
      return new Response(
        JSON.stringify({ error: "No organization found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch suppliers with purchase data
    const { data: suppliers } = await supabase
      .from("suppliers")
      .select("*")
      .eq("organization_id", org.id);

    if (!suppliers || suppliers.length === 0) {
      return new Response(
        JSON.stringify({ 
          supplierIds: [], 
          explanation: "No suppliers found in your organization.",
          suggestions: ["Add your first supplier"]
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch purchase documents for context
    const { data: purchaseDocuments } = await supabase
      .from("purchase_documents")
      .select("*")
      .eq("organization_id", org.id);

    // Fetch purchase lines
    const { data: purchaseLines } = await supabase
      .from("purchase_lines")
      .select(`
        *,
        purchase_documents!inner(supplier_id, organization_id)
      `)
      .eq("purchase_documents.organization_id", org.id);

    // Build supplier context with purchase data
    const supplierContext = suppliers.map(supplier => {
      const supplierPurchases = purchaseDocuments?.filter(pd => pd.supplier_id === supplier.id) || [];
      const supplierLines = purchaseLines?.filter(pl => 
        supplierPurchases.some(sp => sp.id === pl.purchase_document_id)
      ) || [];
      
      const totalPurchases = supplierPurchases.reduce((sum, pd) => sum + pd.total_ttc, 0);
      const unpaidAmount = supplierPurchases
        .filter(pd => pd.payment_status !== 'paid')
        .reduce((sum, pd) => sum + (pd.net_payable - pd.paid_amount), 0);
      
      const name = supplier.company_name || `${supplier.first_name || ''} ${supplier.last_name || ''}`.trim();
      
      return {
        id: supplier.id,
        name,
        type: supplier.supplier_type,
        status: supplier.status,
        country: supplier.country,
        email: supplier.email,
        phone: supplier.phone,
        identifier: supplier.identifier_value,
        purchaseCount: supplierPurchases.length,
        totalPurchases,
        unpaidAmount,
        productCount: supplierLines.length,
        lastPurchase: supplierPurchases.length > 0 
          ? supplierPurchases.sort((a, b) => 
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )[0].created_at 
          : null,
      };
    });

    // Call Lovable AI Gateway
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const systemPrompt = `You are an AI assistant that helps filter suppliers based on natural language queries.
    
Given a list of suppliers with their purchase data, analyze the user's query and return the IDs of suppliers that match.

Supplier data includes:
- id, name, type (individual_local, business_local, foreign)
- status (active, archived)
- country, email, phone, identifier
- purchaseCount (number of purchase documents)
- totalPurchases (total amount purchased)
- unpaidAmount (amount still owed)
- productCount (number of product lines purchased)
- lastPurchase (date of last purchase)

Respond with a JSON object containing:
- supplierIds: array of matching supplier IDs
- explanation: brief explanation in the user's language
- suggestions: 2-3 related search suggestions

Examples of queries:
- "fournisseurs avec des impayés" -> filter by unpaidAmount > 0
- "gros fournisseurs" -> sort by totalPurchases, return top suppliers
- "fournisseurs étrangers" -> filter by type = 'foreign'
- "fournisseurs inactifs" -> filter by status = 'archived'
- "fournisseurs sans achats" -> filter by purchaseCount = 0`;

    const userPrompt = `Query: "${query}"

Suppliers data:
${JSON.stringify(supplierContext, null, 2)}

Return only valid JSON with supplierIds, explanation, and suggestions.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No response from AI");
    }

    // Parse AI response
    let result;
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || 
                       content.match(/```\n?([\s\S]*?)\n?```/) ||
                       [null, content];
      const jsonStr = jsonMatch[1] || content;
      result = JSON.parse(jsonStr.trim());
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      // Fallback: return all suppliers
      result = {
        supplierIds: suppliers.map(s => s.id),
        explanation: "Showing all suppliers due to parsing error.",
        suggestions: [],
      };
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Supplier AI search error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
