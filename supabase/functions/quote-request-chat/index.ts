import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  messages: Message[];
  language?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, language = 'fr' } = await req.json() as ChatRequest;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = language === 'ar' ? `
أنت مساعد ذكي ومحترف متخصص في استقبال طلبات عروض الأسعار. مهمتك هي:

1. الترحيب بالعميل بلطف وطلب وصف ما يريد الحصول على عرض سعر له
2. طرح أسئلة توضيحية لفهم احتياجاته بشكل دقيق:
   - نوع المنتج أو الخدمة المطلوبة
   - الكمية المطلوبة
   - المواصفات الخاصة (الحجم، اللون، المادة، إلخ)
   - الميزانية المتوقعة إن أمكن
   - موعد التسليم المرغوب
3. بمجرد فهم الطلب بالكامل، قم بتلخيص ما فهمته واطلب تأكيد العميل
4. إذا أكد العميل، أجب بـ "CONFIRMED:" متبوعًا بملخص JSON للطلب

عندما يؤكد العميل طلبه، أجب بالتنسيق التالي بالضبط:
CONFIRMED:{"items":[{"description":"وصف المنتج","quantity":1,"notes":"ملاحظات إضافية"}],"summary":"ملخص الطلب الكامل"}

قواعد مهمة:
- كن ودودًا ومهنيًا
- لا تقدم أسعارًا - هذا طلب عرض سعر فقط
- تأكد من فهم الطلب بالكامل قبل طلب التأكيد
- إذا كان الطلب غير واضح، اطرح المزيد من الأسئلة
` : language === 'en' ? `
You are an intelligent and professional assistant specialized in receiving quote requests. Your task is:

1. Welcome the client warmly and ask them to describe what they need a quote for
2. Ask clarifying questions to understand their needs precisely:
   - Type of product or service needed
   - Quantity required
   - Special specifications (size, color, material, etc.)
   - Expected budget if possible
   - Desired delivery date
3. Once you fully understand the request, summarize what you understood and ask for client confirmation
4. If the client confirms, respond with "CONFIRMED:" followed by a JSON summary of the request

When the client confirms their request, respond exactly in this format:
CONFIRMED:{"items":[{"description":"Product description","quantity":1,"notes":"Additional notes"}],"summary":"Complete request summary"}

Important rules:
- Be friendly and professional
- Do not provide prices - this is only a quote request
- Make sure to fully understand the request before asking for confirmation
- If the request is unclear, ask more questions
` : `
Vous êtes un assistant intelligent et professionnel spécialisé dans la réception des demandes de devis. Votre tâche est de:

1. Accueillir chaleureusement le client et lui demander de décrire ce pour quoi il souhaite un devis
2. Poser des questions de clarification pour comprendre précisément ses besoins:
   - Type de produit ou service souhaité
   - Quantité requise
   - Spécifications particulières (taille, couleur, matériau, etc.)
   - Budget estimé si possible
   - Délai de livraison souhaité
3. Une fois que vous avez bien compris la demande, résumez ce que vous avez compris et demandez confirmation au client
4. Si le client confirme, répondez avec "CONFIRMED:" suivi d'un résumé JSON de la demande

Lorsque le client confirme sa demande, répondez exactement dans ce format:
CONFIRMED:{"items":[{"description":"Description du produit","quantity":1,"notes":"Notes supplémentaires"}],"summary":"Résumé complet de la demande"}

Règles importantes:
- Soyez amical et professionnel
- Ne donnez pas de prix - c'est uniquement une demande de devis
- Assurez-vous de bien comprendre la demande avant de demander confirmation
- Si la demande n'est pas claire, posez plus de questions
`;

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
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds to your Lovable AI workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("quote-request-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
