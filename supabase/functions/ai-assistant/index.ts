import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

interface AssistantRequest {
  messages: Message[];
  language: 'fr' | 'en' | 'ar';
}

async function fetchOrganizationContext(supabase: any) {
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [
    invoicesResult,
    clientsResult,
    productsResult,
    suppliersResult,
    unpaidInvoicesResult,
    pendingPurchasesResult,
    thisMonthInvoices,
    pendingInvoiceRequests,
    pendingQuoteRequests,
    lowStockProducts,
    overdueInvoices,
    recentClientsResult,
    topClientsResult,
    thisMonthPayments,
  ] = await Promise.all([
    supabase.from('invoices').select('id', { count: 'exact', head: true }),
    supabase.from('clients').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('suppliers').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('invoices').select('net_payable, paid_amount').neq('payment_status', 'paid'),
    supabase.from('purchase_documents').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('invoices').select('net_payable').gte('invoice_date', thisMonthStart),
    supabase.from('invoice_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('quote_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('products').select('id, name', { count: 'exact' }).lt('current_stock', 10).eq('unlimited_stock', false).eq('product_type', 'physical').eq('status', 'active').limit(5),
    supabase.from('invoices').select('id', { count: 'exact', head: true }).neq('payment_status', 'paid').lt('due_date', now.toISOString().split('T')[0]),
    supabase.from('clients').select('first_name, last_name, company_name').eq('status', 'active').order('created_at', { ascending: false }).limit(5),
    supabase.from('invoices').select('client_id, net_payable, client:clients(first_name, last_name, company_name)').order('net_payable', { ascending: false }).limit(5),
    supabase.from('payments').select('amount').gte('payment_date', thisMonthStart),
  ]);

  const unpaidAmount = unpaidInvoicesResult.data?.reduce((sum: number, inv: any) => sum + (inv.net_payable - inv.paid_amount), 0) || 0;
  const totalSalesThisMonth = thisMonthInvoices.data?.reduce((sum: number, inv: any) => sum + inv.net_payable, 0) || 0;
  const paidThisMonth = thisMonthPayments.data?.reduce((sum: number, p: any) => sum + p.amount, 0) || 0;

  const recentClientNames = recentClientsResult.data?.map((c: any) => c.company_name || `${c.first_name || ''} ${c.last_name || ''}`.trim()).filter(Boolean) || [];
  const lowStockNames = lowStockProducts.data?.map((p: any) => p.name).filter(Boolean) || [];
  const topClientsList = topClientsResult.data?.map((inv: any) => {
    const c = inv.client;
    const name = c?.company_name || `${c?.first_name || ''} ${c?.last_name || ''}`.trim();
    return name ? `${name} (${inv.net_payable?.toFixed(2)} TND)` : null;
  }).filter(Boolean) || [];

  return {
    invoicesCount: invoicesResult.count || 0,
    clientsCount: clientsResult.count || 0,
    productsCount: productsResult.count || 0,
    suppliersCount: suppliersResult.count || 0,
    unpaidAmount,
    pendingPurchases: pendingPurchasesResult.count || 0,
    totalSalesThisMonth,
    paidThisMonth,
    pendingInvoiceRequests: pendingInvoiceRequests.count || 0,
    pendingQuoteRequests: pendingQuoteRequests.count || 0,
    lowStockCount: lowStockProducts.count || 0,
    lowStockProducts: lowStockNames,
    overdueInvoices: overdueInvoices.count || 0,
    recentClients: recentClientNames,
    topClients: topClientsList,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, language } = await req.json() as AssistantRequest;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Create Supabase client with user's auth token for RLS
    const authHeader = req.headers.get('Authorization');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: authHeader ? { Authorization: authHeader } : {} },
    });

    // Fetch real organization data server-side with RLS
    let context: any = {};
    try {
      context = await fetchOrganizationContext(supabase);
    } catch (e) {
      console.error("Error fetching context:", e);
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

## Données en temps réel de l'organisation de l'utilisateur:
- Nombre total de factures: ${context.invoicesCount || 0}
- Nombre de clients actifs: ${context.clientsCount || 0}
- Nombre de produits actifs: ${context.productsCount || 0}
- Nombre de fournisseurs actifs: ${context.suppliersCount || 0}
- Montant total impayé (ventes): ${context.unpaidAmount?.toFixed(2) || '0.00'} TND
- Ventes du mois en cours: ${context.totalSalesThisMonth?.toFixed(2) || '0.00'} TND
- Paiements reçus ce mois: ${context.paidThisMonth?.toFixed(2) || '0.00'} TND
- Achats en attente de validation: ${context.pendingPurchases || 0}
- Demandes de facture en attente: ${context.pendingInvoiceRequests || 0}
- Demandes de devis en attente: ${context.pendingQuoteRequests || 0}
- Factures en retard: ${context.overdueInvoices || 0}
- Produits en stock faible (< 10): ${context.lowStockCount || 0}${context.lowStockProducts?.length ? ` (${context.lowStockProducts.join(', ')})` : ''}
- Derniers clients ajoutés: ${context.recentClients?.length ? context.recentClients.join(', ') : 'Aucun'}
- Top clients (par facture): ${context.topClients?.length ? context.topClients.join(', ') : 'Aucun'}

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
- "Combien j'ai d'impayés?" → utilise le contexte pour répondre avec les chiffres réels

Sois proactif et offre des suggestions pertinentes basées sur les données réelles. Tu es l'intelligence centrale de cette application.`;

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
