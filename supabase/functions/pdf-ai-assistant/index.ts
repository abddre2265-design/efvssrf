import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

interface PdfAIRequest {
  messages: Message[];
  language: 'fr' | 'en' | 'ar';
  documentType: 'invoice' | 'credit-note';
  currentComponents: Record<string, boolean>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, language, documentType, currentComponents } = await req.json() as PdfAIRequest;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const langInstructions = {
      fr: "Réponds toujours en français. Utilise un ton professionnel mais amical.",
      en: "Always respond in English. Use a professional but friendly tone.",
      ar: "أجب دائمًا بالعربية. استخدم نبرة مهنية ولكن ودية."
    };

    const docLabels = {
      invoice: { fr: 'Facture de vente', en: 'Sales Invoice', ar: 'فاتورة المبيعات' },
      'credit-note': { fr: 'Avoir de vente', en: 'Sales Credit Note', ar: 'إشعار دائن' }
    };

    const componentDescriptions = {
      // Header components
      logo: { fr: 'Logo de l\'entreprise', en: 'Company Logo', ar: 'شعار الشركة' },
      company_info: { fr: 'Coordonnées entreprise', en: 'Company Information', ar: 'معلومات الشركة' },
      company_name: { fr: 'Nom de l\'entreprise', en: 'Company Name', ar: 'اسم الشركة' },
      company_address: { fr: 'Adresse de l\'entreprise', en: 'Company Address', ar: 'عنوان الشركة' },
      company_phone: { fr: 'Téléphone entreprise', en: 'Company Phone', ar: 'هاتف الشركة' },
      company_email: { fr: 'Email entreprise', en: 'Company Email', ar: 'بريد الشركة' },
      company_identifier: { fr: 'Identifiant fiscal entreprise', en: 'Company Tax ID', ar: 'الرقم الضريبي للشركة' },
      invoice_title: { fr: 'Titre "FACTURE"', en: '"INVOICE" Title', ar: 'عنوان "فاتورة"' },
      invoice_number: { fr: 'Numéro de facture', en: 'Invoice Number', ar: 'رقم الفاتورة' },
      invoice_date: { fr: 'Date de facture', en: 'Invoice Date', ar: 'تاريخ الفاتورة' },
      due_date: { fr: 'Date d\'échéance', en: 'Due Date', ar: 'تاريخ الاستحقاق' },
      status_badge: { fr: 'Badge de statut', en: 'Status Badge', ar: 'شارة الحالة' },
      credit_note_title: { fr: 'Titre "AVOIR"', en: '"CREDIT NOTE" Title', ar: 'عنوان "إشعار دائن"' },
      credit_note_number: { fr: 'Numéro d\'avoir', en: 'Credit Note Number', ar: 'رقم الإشعار' },
      credit_note_date: { fr: 'Date d\'avoir', en: 'Credit Note Date', ar: 'تاريخ الإشعار' },
      credit_note_type: { fr: 'Type d\'avoir', en: 'Credit Note Type', ar: 'نوع الإشعار' },
      // Content components
      client_info: { fr: 'Informations client', en: 'Client Information', ar: 'معلومات العميل' },
      client_name: { fr: 'Nom du client', en: 'Client Name', ar: 'اسم العميل' },
      client_address: { fr: 'Adresse du client', en: 'Client Address', ar: 'عنوان العميل' },
      client_identifier: { fr: 'Identifiant fiscal client', en: 'Client Tax ID', ar: 'الرقم الضريبي للعميل' },
      client_phone: { fr: 'Téléphone client', en: 'Client Phone', ar: 'هاتف العميل' },
      client_email: { fr: 'Email client', en: 'Client Email', ar: 'بريد العميل' },
      payment_status: { fr: 'Statut de paiement', en: 'Payment Status', ar: 'حالة الدفع' },
      invoice_reference: { fr: 'Référence facture originale', en: 'Original Invoice Reference', ar: 'مرجع الفاتورة الأصلية' },
      products_table: { fr: 'Tableau des produits', en: 'Products Table', ar: 'جدول المنتجات' },
      product_reference: { fr: 'Référence produit', en: 'Product Reference', ar: 'مرجع المنتج' },
      product_description: { fr: 'Description produit', en: 'Product Description', ar: 'وصف المنتج' },
      vat_column: { fr: 'Colonne TVA', en: 'VAT Column', ar: 'عمود الضريبة' },
      discount_column: { fr: 'Colonne remise', en: 'Discount Column', ar: 'عمود الخصم' },
      return_reason: { fr: 'Motif de retour', en: 'Return Reason', ar: 'سبب الإرجاع' },
      totals_box: { fr: 'Encadré des totaux', en: 'Totals Box', ar: 'مربع الإجماليات' },
      stamp_duty: { fr: 'Droit de timbre', en: 'Stamp Duty', ar: 'رسوم الطوابع' },
      credit_status_section: { fr: 'Section statut du crédit', en: 'Credit Status Section', ar: 'قسم حالة الائتمان' },
      // Footer components
      decorative_corners: { fr: 'Coins décoratifs', en: 'Decorative Corners', ar: 'الزوايا الزخرفية' },
      bank_info: { fr: 'Informations bancaires', en: 'Bank Information', ar: 'المعلومات البنكية' },
      signature_area: { fr: 'Zone de signature', en: 'Signature Area', ar: 'منطقة التوقيع' },
      legal_mentions: { fr: 'Mentions légales', en: 'Legal Mentions', ar: 'الإشارات القانونية' },
      qr_code: { fr: 'QR Code', en: 'QR Code', ar: 'رمز QR' },
      stamp: { fr: 'Cachet', en: 'Stamp', ar: 'الختم' },
    };

    const enabledComponents = Object.entries(currentComponents)
      .filter(([_, enabled]) => enabled)
      .map(([id]) => componentDescriptions[id as keyof typeof componentDescriptions]?.[language] || id)
      .join(', ');

    const disabledComponents = Object.entries(currentComponents)
      .filter(([_, enabled]) => !enabled)
      .map(([id]) => componentDescriptions[id as keyof typeof componentDescriptions]?.[language] || id)
      .join(', ');

    const systemPrompt = `Tu es un assistant IA spécialisé dans la personnalisation des templates PDF pour les documents commerciaux.

${langInstructions[language]}

## Document actuel:
Type: ${docLabels[documentType][language]}

## Composants actuellement activés:
${enabledComponents || 'Aucun'}

## Composants actuellement désactivés:
${disabledComponents || 'Aucun'}

## Tes capacités:
1. **Modifier les composants**: Suggérer d'activer ou désactiver des éléments
2. **Conseiller sur la mise en page**: Recommander des améliorations visuelles
3. **Expliquer les composants**: Décrire à quoi sert chaque élément
4. **Bonnes pratiques**: Conseiller sur les standards professionnels des documents commerciaux

## Format de réponse pour les actions:
Quand tu suggères de modifier des composants, utilise ce format JSON:
{"toggleComponents": {"component_id": true/false, ...}}

Exemples d'actions:
- Activer le QR code: {"toggleComponents": {"qr_code": true}}
- Désactiver les coins décoratifs: {"toggleComponents": {"decorative_corners": false}}
- Plusieurs modifications: {"toggleComponents": {"qr_code": true, "stamp": true, "legal_mentions": true}}

## Composants disponibles:
### En-tête:
- logo: Logo de l'entreprise
- company_info: Bloc coordonnées entreprise (contient sous-éléments)
- company_name: Nom de l'entreprise
- company_address: Adresse de l'entreprise
- company_phone: Téléphone entreprise
- company_email: Email entreprise
- company_identifier: Matricule fiscal entreprise
- invoice_title / credit_note_title: Titre du document
- invoice_number / credit_note_number: Numéro du document
- invoice_date / credit_note_date: Date du document
- due_date: Date d'échéance (facture uniquement)
- credit_note_type: Type d'avoir
- status_badge: Badge de statut

### Contenu:
- client_info: Bloc informations client (contient sous-éléments)
- client_name: Nom du client
- client_address: Adresse du client
- client_identifier: Matricule fiscal client
- client_phone: Téléphone client
- client_email: Email client
- payment_status: Statut de paiement (facture)
- invoice_reference: Référence facture originale (avoir)
- products_table: Tableau des produits
- product_reference: Colonne référence
- product_description: Description produit
- vat_column: Colonne TVA
- discount_column: Colonne remise
- return_reason: Motif de retour (avoir)
- totals_box: Encadré des totaux
- stamp_duty: Droit de timbre
- credit_status_section: Section crédit (avoir)

### Pied de page:
- decorative_corners: Coins décoratifs
- bank_info: Informations bancaires
- signature_area: Zone signature
- legal_mentions: Mentions légales
- qr_code: QR Code
- stamp: Cachet

Sois concis et pratique dans tes réponses. Propose des améliorations concrètes.`;

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
    console.error("PDF AI Assistant error:", error);
    
    return new Response(JSON.stringify({ 
      error: "internal_error",
      message: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
