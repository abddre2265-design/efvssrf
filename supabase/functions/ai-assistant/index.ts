import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

interface AssistantRequest {
  messages: Message[];
  language: 'fr' | 'en' | 'ar';
  context?: {
    invoicesCount?: number;
    clientsCount?: number;
    productsCount?: number;
    suppliersCount?: number;
    unpaidAmount?: number;
    pendingPurchases?: number;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, language, context } = await req.json() as AssistantRequest;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const langInstructions = {
      fr: "Réponds toujours en français. Utilise un ton professionnel mais amical.",
      en: "Always respond in English. Use a professional but friendly tone.",
      ar: "أجب دائمًا بالعربية. استخدم نبرة مهنية ولكن ودية."
    };

    const systemPrompt = `Tu es un assistant IA intelligent et futuriste pour une application de gestion commerciale. Tu es l'assistant personnel de l'utilisateur pour naviguer et gérer son entreprise.

${langInstructions[language]}

## Tes capacités:
- Accès aux données: factures, clients, produits, fournisseurs, paiements, avoirs
- Navigation: guider l'utilisateur vers les bonnes pages
- Aide: expliquer les fonctionnalités de l'application
- Analyses: fournir des statistiques et insights

## Contexte actuel de l'utilisateur (données en temps réel):
${context ? `
- Nombre total de factures: ${context.invoicesCount || 0}
- Nombre de clients actifs: ${context.clientsCount || 0}
- Nombre de produits actifs: ${context.productsCount || 0}
- Nombre de fournisseurs actifs: ${context.suppliersCount || 0}
- Montant total impayé: ${context.unpaidAmount?.toFixed(2) || '0.00'} TND
- Achats en attente de validation: ${context.pendingPurchases || 0}
` : 'Contexte non disponible'}

## Pages disponibles dans l'application:
- "home" - Accueil du tableau de bord
- "products" - Gestion des produits
- "clients" - Gestion des clients
- "suppliers" - Gestion des fournisseurs
- "invoices" - Factures de vente
- "payments" - Paiements clients
- "credit-notes" - Avoirs clients
- "purchase-document-requests" - Demandes de classement (achats)
- "supply" - Approvisionnement
- "purchase-payments" - Paiements fournisseurs
- "supplier-credit-notes" - Avoirs fournisseurs
- "import-folders" - Dossiers d'importation
- "quote-requests" - Demandes de devis
- "document-families" - Familles de documents

## Format de réponse:
Réponds de manière concise et utile. Si tu suggères une navigation, inclus le tag JSON suivant:
{"navigate": "page-id"}

Exemples:
- "Montre-moi les factures" → suggère navigation vers "invoices"
- "Comment créer un client?" → explique le processus et suggère navigation vers "clients"
- "Combien j'ai d'impayés?" → utilise le contexte pour répondre

Sois proactif et offre des suggestions pertinentes. Tu es l'intelligence centrale de cette application.`;

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
          ...messages,
        ],
        temperature: 0.7,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ 
          error: "rate_limit",
          message: language === 'fr' 
            ? "Je suis temporairement indisponible. Réessayez dans un moment." 
            : language === 'ar'
            ? "أنا غير متاح مؤقتًا. حاول مرة أخرى لاحقًا."
            : "I'm temporarily unavailable. Please try again in a moment."
        }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ 
          error: "payment_required",
          message: language === 'fr'
            ? "Crédits IA épuisés. Veuillez recharger."
            : language === 'ar'
            ? "رصيد الذكاء الاصطناعي منتهي. يرجى إعادة الشحن."
            : "AI credits depleted. Please top up."
        }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    // Stream the response back
    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (error) {
    console.error("AI Assistant error:", error);
    
    return new Response(JSON.stringify({ 
      error: "internal_error",
      message: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
