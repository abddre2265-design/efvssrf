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
  transaction_number: string;
  total_ttc: number;
  store_id: string | null;
  purchase_date: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, organizationId, organizationName, searchIdentifier, language } = await req.json();
    const lang = language || 'fr';
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // i18n messages
    const i18n: Record<string, Record<string, string>> = {
      greeting: {
        fr: `Bienvenue ! 👋\n\nSi vous avez effectué un achat chez « ${organizationName} », vous pouvez saisir votre identifiant fiscal pour récupérer automatiquement vos informations.\n\n📋 Formats acceptés :\n• CIN : 8 chiffres\n• Matricule fiscal : 1234567/A/M/000\n• Passeport : format libre`,
        en: `Welcome! 👋\n\nIf you made a purchase at "${organizationName}", you can enter your tax identifier to automatically retrieve your information.\n\n📋 Accepted formats:\n• CIN: 8 digits\n• Tax ID: 1234567/A/M/000\n• Passport: free format`,
        ar: `مرحباً! 👋\n\nإذا قمت بعملية شراء لدى « ${organizationName} »، يمكنك إدخال معرّفك الجبائي لاسترجاع معلوماتك تلقائياً.\n\n📋 الصيغ المقبولة:\n• بطاقة التعريف: 8 أرقام\n• المعرّف الجبائي: 1234567/A/M/000\n• جواز السفر: صيغة حرة`,
      },
      client_found: {
        fr: `✅ Client trouvé !`,
        en: `✅ Client found!`,
        ar: `✅ تم العثور على العميل!`,
      },
      is_it_you: {
        fr: `\n\nEst-ce bien vous ?`,
        en: `\n\nIs this you?`,
        ar: `\n\nهل هذا أنت؟`,
      },
      not_found: {
        fr: `❌ Aucun client trouvé avec cet identifiant.`,
        en: `❌ No client found with this identifier.`,
        ar: `❌ لم يتم العثور على عميل بهذا المعرّف.`,
      },
      unknown: {
        fr: `Je n'ai pas compris. Veuillez saisir votre identifiant fiscal (CIN, matricule fiscal ou passeport).`,
        en: `I didn't understand. Please enter your tax identifier (CIN, tax ID or passport).`,
        ar: `لم أفهم. يرجى إدخال معرّفك الجبائي (بطاقة التعريف، المعرّف الجبائي أو جواز السفر).`,
      },
      error: {
        fr: `Une erreur s'est produite. Veuillez remplir le formulaire manuellement.`,
        en: `An error occurred. Please fill in the form manually.`,
        ar: `حدث خطأ. يرجى ملء النموذج يدوياً.`,
      },
    };

    const msg = (key: string) => i18n[key]?.[lang] || i18n[key]?.fr || key;

    // Action: greeting - Return welcome message
    if (action === "greeting") {
      return new Response(JSON.stringify({
        action: "greeting",
        message: msg('greeting'),
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
        .select("id, request_number, identifier_value, status, created_at, transaction_number, total_ttc, store_id, purchase_date")
        .eq("organization_id", organizationId)
        .ilike("identifier_value", identifier)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(5);

      if (pendingData && pendingData.length > 0) {
        searchResults.pendingRequests = pendingData;
      }

      // Build response based on search results
      if (searchResults.client) {
        const client = searchResults.client;
        const displayName = client.company_name || 
          `${client.first_name || ''} ${client.last_name || ''}`.trim() || 
          'Client';
        
        let message = `${msg('client_found')}\n\n👤 ${displayName}`;
        if (client.email) message += `\n📧 ${client.email}`;
        if (client.phone) message += `\n📱 ${client.phone_prefix || ''} ${client.phone}`;
        if (client.address) message += `\n📍 ${client.address}`;
        message += msg('is_it_you');

        return new Response(JSON.stringify({
          action: "client_found",
          message,
          clientData: searchResults.client,
          pendingRequests: searchResults.pendingRequests
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        // Client not found - provide detailed format examples
        return new Response(JSON.stringify({
          action: "not_found",
          message: msg('not_found'),
          clientData: null,
          pendingRequests: searchResults.pendingRequests,
          showFormatHelp: true
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Default response
    return new Response(JSON.stringify({
      action: "unknown",
      message: msg('unknown'),
      clientData: null,
      pendingRequests: null
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Invoice request assistant error:", error);

    return new Response(JSON.stringify({
      action: "error",
      message: "An error occurred. Please fill in the form manually.",
      clientData: null,
      pendingRequests: null
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
