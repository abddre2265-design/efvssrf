import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ClientResult {
  id: string;
  client_type: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  identifier_type: string;
  identifier_value: string;
  country: string;
  governorate: string | null;
  address: string | null;
  postal_code: string | null;
  phone_prefix: string | null;
  phone: string | null;
  whatsapp_prefix: string | null;
  whatsapp: string | null;
  email: string | null;
}

interface PendingRequest {
  id: string;
  request_number: string;
  identifier_value: string;
  status: string;
  created_at: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, organizationId, organizationName, searchIdentifier } = await req.json();
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Action: greeting - Return welcome message
    if (action === "greeting") {
      return new Response(JSON.stringify({
        action: "greeting",
        message: `Bienvenue ! 👋\n\nSi vous avez effectué un achat chez « ${organizationName} », vous pouvez saisir votre identifiant fiscal pour récupérer automatiquement vos informations.\n\n📋 Formats acceptés :\n• CIN : 8 chiffres\n• Matricule fiscal : 1234567/A/M/000\n• Passeport : format libre`,
        clientData: null,
        pendingRequests: null
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: search - Search for client by identifier
    if (action === "search" && searchIdentifier) {
      const identifier = searchIdentifier.trim().toUpperCase();
      
      let searchResults: { 
        client: ClientResult | null; 
        pendingRequests: PendingRequest[];
      } = {
        client: null,
        pendingRequests: []
      };

      // Search in clients table
      const { data: clientData } = await supabase
        .from("clients")
        .select("*")
        .eq("organization_id", organizationId)
        .ilike("identifier_value", identifier)
        .eq("status", "active")
        .maybeSingle();

      if (clientData) {
        searchResults.client = clientData;
      }

      // Search in pending invoice requests (for info only)
      const { data: pendingData } = await supabase
        .from("invoice_requests")
        .select("id, request_number, identifier_value, status, created_at")
        .eq("organization_id", organizationId)
        .ilike("identifier_value", identifier)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(3);

      if (pendingData && pendingData.length > 0) {
        searchResults.pendingRequests = pendingData;
      }

      // Build response based on search results
      if (searchResults.client) {
        const client = searchResults.client;
        const displayName = client.company_name || 
          `${client.first_name || ''} ${client.last_name || ''}`.trim() || 
          'Client';
        
        let message = `✅ Client trouvé !\n\n👤 ${displayName}`;
        if (client.email) message += `\n📧 ${client.email}`;
        if (client.phone) message += `\n📱 ${client.phone_prefix || ''} ${client.phone}`;
        if (client.address) message += `\n📍 ${client.address}`;
        message += `\n\nEst-ce bien vous ?`;

        return new Response(JSON.stringify({
          action: "client_found",
          message,
          clientData: searchResults.client,
          pendingRequests: searchResults.pendingRequests
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        // Client not found
        return new Response(JSON.stringify({
          action: "not_found",
          message: `❌ Aucun client trouvé avec cet identifiant.\n\nVous pouvez essayer :\n• Un autre format (CIN, matricule fiscal, passeport)\n• Vérifier l'orthographe\n\nOu remplir le formulaire manuellement.`,
          clientData: null,
          pendingRequests: searchResults.pendingRequests
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Default response
    return new Response(JSON.stringify({
      action: "unknown",
      message: "Je n'ai pas compris. Veuillez saisir votre identifiant fiscal (CIN, matricule fiscal ou passeport).",
      clientData: null,
      pendingRequests: null
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Invoice request assistant error:", error);

    return new Response(JSON.stringify({
      action: "error",
      message: "Une erreur s'est produite. Veuillez remplir le formulaire manuellement.",
      clientData: null,
      pendingRequests: null
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
