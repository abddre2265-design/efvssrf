import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Message {
  role: "user" | "assistant";
  content: string;
}

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
    const { messages, organizationId, organizationName, searchIdentifier } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // If searching for a client
    let searchResults: { client: ClientResult | null; pendingRequests: PendingRequest[] } = {
      client: null,
      pendingRequests: []
    };

    if (searchIdentifier) {
      const identifier = searchIdentifier.trim();
      
      // Search in clients
      const { data: clientData } = await supabase
        .from("clients")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("identifier_value", identifier)
        .eq("status", "active")
        .maybeSingle();

      if (clientData) {
        searchResults.client = clientData;
      }

      // Search in pending invoice requests
      const { data: pendingData } = await supabase
        .from("invoice_requests")
        .select("id, request_number, identifier_value, status, created_at")
        .eq("organization_id", organizationId)
        .eq("identifier_value", identifier)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(5);

      if (pendingData && pendingData.length > 0) {
        searchResults.pendingRequests = pendingData;
      }
    }

    const systemPrompt = `Tu es un assistant IA pour le formulaire de demande de facture de "${organizationName}". Tu aides les utilisateurs à récupérer leurs informations client automatiquement.

COMPORTEMENT:
- Sois poli, professionnel et concis
- Utilise le vouvoiement
- Réponds toujours en français

ÉTAPES:
1. Accueil: Si c'est le premier message (messages vides), accueille l'utilisateur et explique qu'il peut saisir son identifiant pour récupérer ses informations automatiquement.

2. Recherche: Quand l'utilisateur fournit un identifiant:
   - CIN: 8 chiffres (ex: 12345678)
   - Matricule fiscal: formats NNNNNNN/X, NNNNNNN/X/X, NNNNNNX/X/X/NNN, NNNNNNN/X/X/X/NNN
   - Passeport: format libre

3. Résultats:
   - Si client trouvé: Affiche le nom et demande confirmation "Est-ce bien vous ?"
   - Si demande en attente trouvée: Informe qu'une demande existe déjà
   - Si non trouvé: Propose d'autres formats ou suggère la saisie manuelle

RÉPONSE JSON (obligatoire):
{
  "message": "Ton message à l'utilisateur",
  "action": "none" | "client_found" | "pending_found" | "not_found" | "confirm_client" | "fill_form",
  "clientData": null | { données du client },
  "extractedIdentifier": null | "identifiant extrait du message"
}

DONNÉES DE RECHERCHE:
${searchIdentifier ? JSON.stringify(searchResults, null, 2) : "Aucune recherche effectuée"}`;

    const aiMessages: Message[] = [
      { role: "user" as const, content: messages.length === 0 ? "Bonjour" : messages[messages.length - 1].content }
    ];

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
          ...aiMessages,
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({
          message: "Service temporairement indisponible. Veuillez remplir le formulaire manuellement.",
          action: "error",
          clientData: null,
          extractedIdentifier: null
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({
          message: "Service indisponible. Veuillez remplir le formulaire manuellement.",
          action: "error",
          clientData: null,
          extractedIdentifier: null
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

    // Parse JSON from response
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    let result;
    try {
      result = JSON.parse(jsonStr);
    } catch {
      // If JSON parsing fails, create a simple response
      result = {
        message: content,
        action: "none",
        clientData: null,
        extractedIdentifier: null
      };
    }

    // If client was found in DB, attach the data
    if (searchResults.client && (result.action === "client_found" || result.action === "confirm_client")) {
      result.clientData = searchResults.client;
    }

    // If pending requests found
    if (searchResults.pendingRequests.length > 0) {
      result.pendingRequests = searchResults.pendingRequests;
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Invoice request assistant error:", error);

    return new Response(JSON.stringify({
      message: "Une erreur s'est produite. Veuillez remplir le formulaire manuellement.",
      action: "error",
      clientData: null,
      extractedIdentifier: null
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
