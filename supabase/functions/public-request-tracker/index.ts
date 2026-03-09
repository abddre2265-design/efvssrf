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
    const { action, organizationId, transactionNumber, identifierValue, requestId } = await req.json();

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Action: search - Search requests by transaction number or identifier
    if (action === "search") {
      let query = supabase
        .from("invoice_requests")
        .select("id, request_number, transaction_number, identifier_value, identifier_type, client_type, first_name, last_name, company_name, total_ttc, status, payment_status, purchase_date, request_date, generated_invoice_id, pdf_download_count, rejection_reason, store:stores(name)")
        .eq("organization_id", organizationId);

      if (transactionNumber) {
        query = query.eq("transaction_number", transactionNumber);
      } else if (identifierValue) {
        query = query.eq("identifier_value", identifierValue);
      } else {
        return new Response(JSON.stringify({ error: "Missing search criteria" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await query.order("request_date", { ascending: false });

      if (error) throw error;

      return new Response(JSON.stringify({ requests: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: get_invoice_data - Get full invoice data for PDF rendering
    if (action === "get_invoice_data") {
      if (!requestId) {
        return new Response(JSON.stringify({ error: "Missing requestId" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get the request to find the generated invoice
      const { data: request, error: reqError } = await supabase
        .from("invoice_requests")
        .select("generated_invoice_id, pdf_download_count, organization_id")
        .eq("id", requestId)
        .eq("organization_id", organizationId)
        .single();

      if (reqError || !request?.generated_invoice_id) {
        return new Response(JSON.stringify({ error: "Invoice not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const invoiceId = request.generated_invoice_id;
      const isDuplicate = request.pdf_download_count > 0;

      // Fetch invoice
      const { data: invoice } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", invoiceId)
        .single();

      if (!invoice) {
        return new Response(JSON.stringify({ error: "Invoice not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch client, organization, banks, lines in parallel
      const [clientRes, orgRes, banksRes, linesRes, creditNotesRes] = await Promise.all([
        supabase.from("clients").select("*").eq("id", invoice.client_id).single(),
        supabase.from("organizations").select("*").eq("id", invoice.organization_id).single(),
        supabase.from("organization_banks").select("iban, bank_name").eq("organization_id", invoice.organization_id),
        supabase.from("invoice_lines").select("*, product:products(id, name, reference)").eq("invoice_id", invoiceId).order("line_order", { ascending: true }),
        supabase.from("credit_notes").select("*").eq("invoice_id", invoiceId).eq("status", "validated").order("credit_note_date", { ascending: true }),
      ]);

      // Fetch credit note lines
      const creditNotesWithLines = [];
      for (const cn of (creditNotesRes.data || [])) {
        const { data: cnLines } = await supabase
          .from("credit_note_lines")
          .select("*")
          .eq("credit_note_id", cn.id)
          .order("line_order", { ascending: true });
        creditNotesWithLines.push({ ...cn, lines: cnLines || [] });
      }

      // Increment download count
      await supabase
        .from("invoice_requests")
        .update({ pdf_download_count: request.pdf_download_count + 1 })
        .eq("id", requestId);

      return new Response(JSON.stringify({
        invoice,
        client: clientRes.data,
        organization: orgRes.data,
        banks: banksRes.data || [],
        lines: linesRes.data || [],
        creditNotes: creditNotesWithLines,
        isDuplicate,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
