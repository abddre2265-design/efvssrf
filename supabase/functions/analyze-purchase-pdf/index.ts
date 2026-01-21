import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VATBreakdown {
  rate: number;
  base_ht: number;
  vat_amount: number;
}

interface ExtractedProduct {
  name: string;
  reference: string | null;
  ean: string | null;
  quantity: number;
  unit_price_ht: number;
  unit_price_ttc: number;
  vat_rate: number;
  discount_percent: number;
  line_total_ht: number;
  line_total_ttc: number;
  line_vat: number;
  product_type: 'physical' | 'service';
  unit: string;
  max_discount: number;
  unlimited_stock: boolean;
  allow_out_of_stock_sale: boolean;
  purchase_year: number;
}

interface ExtractedSupplier {
  name: string;
  identifier_type: string | null;
  identifier_value: string | null;
  address: string | null;
  phone: string | null;
  phone_prefix: string | null;
  email: string | null;
  country: string;
  governorate: string | null;
  postal_code: string | null;
  whatsapp: string | null;
  whatsapp_prefix: string | null;
  supplier_type: 'individual_local' | 'business_local' | 'foreign';
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  // Matching with existing suppliers
  is_existing?: boolean;
  existing_supplier_id?: string | null;
  match_confidence?: number | null;
  match_reason?: string | null;
}

interface ExtractedTotals {
  subtotal_ht: number;
  total_vat: number;
  total_discount: number;
  ht_after_discount: number;
  total_ttc: number;
  stamp_duty_amount: number;
  net_payable: number;
  currency: string;
  vat_breakdown: VATBreakdown[];
}

interface ExtractionResult {
  invoice_number: string | null;
  invoice_date: string | null;
  supplier: ExtractedSupplier | null;
  products: ExtractedProduct[];
  totals: ExtractedTotals;
  is_duplicate: boolean;
  duplicate_reason: string | null;
}

// Generate a reference if none provided
const generateReference = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'REF-';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Validate barcode format
const validateBarcode = (code: string): { valid: boolean; format: string | null } => {
  if (!code) return { valid: false, format: null };
  
  const formats: Record<string, RegExp> = {
    'EAN-13': /^\d{13}$/,
    'EAN-8': /^\d{8}$/,
    'UPC-A': /^\d{12}$/,
    'UPC-E': /^\d{8}$/,
    'ITF-14': /^\d{14}$/,
    'Code128': /^[\x00-\x7F]{4,}$/,
    'Code39': /^[0-9A-Z\-.$/+% ]{3,}$/,
    'Code93': /^[0-9A-Z\-.$/+% ]{3,}$/,
  };
  
  for (const [format, regex] of Object.entries(formats)) {
    if (regex.test(code)) {
      return { valid: true, format };
    }
  }
  return { valid: false, format: null };
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdf_url, organization_id } = await req.json();

    if (!pdf_url || !organization_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'PDF URL and organization ID are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Download the PDF file
    console.log('Fetching PDF from:', pdf_url);

    const parseSupabaseStorageLocation = (
      urlString: string,
      supabaseBaseUrl: string,
    ): { bucket: string; path: string } | null => {
      try {
        const url = new URL(urlString);
        const supaHost = new URL(supabaseBaseUrl).host;
        if (url.host !== supaHost) return null;

        const parts = url.pathname.split('/').filter(Boolean);
        const objectIndex = parts.findIndex((p) => p === 'object');
        if (objectIndex === -1) return null;

        const maybeAccess = parts[objectIndex + 1];
        const accessModes = new Set(['public', 'sign']);

        if (accessModes.has(maybeAccess)) {
          const bucket = parts[objectIndex + 2];
          const path = parts.slice(objectIndex + 3).join('/');
          if (!bucket || !path) return null;
          return { bucket, path: decodeURIComponent(path) };
        }

        const bucket = maybeAccess;
        const path = parts.slice(objectIndex + 2).join('/');
        if (!bucket || !path) return null;
        return { bucket, path: decodeURIComponent(path) };
      } catch (_e) {
        return null;
      }
    };

    let pdfBuffer: ArrayBuffer;

    const storageLoc = parseSupabaseStorageLocation(pdf_url, supabaseUrl);
    if (storageLoc) {
      console.log('Detected Supabase storage file:', storageLoc);

      const { data: fileData, error: downloadError } = await supabase.storage
        .from(storageLoc.bucket)
        .download(storageLoc.path);

      if (downloadError) {
        console.error('Storage download error:', downloadError);
        throw new Error(`Failed to download PDF from storage: ${downloadError.message}`);
      }

      pdfBuffer = await fileData.arrayBuffer();
    } else {
      let pdfResponse;
      try {
        pdfResponse = await fetch(pdf_url, {
          headers: {
            Accept: 'application/pdf',
          },
        });
      } catch (fetchError: unknown) {
        const errorMessage = fetchError instanceof Error ? fetchError.message : String(fetchError);
        console.error('Fetch error:', errorMessage);
        throw new Error(`Failed to connect to PDF URL: ${errorMessage}`);
      }

      if (!pdfResponse.ok) {
        console.error('PDF fetch failed with status:', pdfResponse.status, pdfResponse.statusText);
        throw new Error(`Failed to fetch PDF file: ${pdfResponse.status} ${pdfResponse.statusText}`);
      }

      pdfBuffer = await pdfResponse.arrayBuffer();
    }

    console.log('PDF size:', pdfBuffer.byteLength, 'bytes');
    
    // Convert to base64 - handle large files in chunks
    const uint8Array = new Uint8Array(pdfBuffer);
    let pdfBase64 = '';
    const chunkSize = 8192;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.slice(i, i + chunkSize);
      pdfBase64 += String.fromCharCode.apply(null, chunk as any);
    }
    pdfBase64 = btoa(pdfBase64);

    // Generate PDF hash for duplicate detection
    const hashBuffer = await crypto.subtle.digest('SHA-256', new Uint8Array(pdfBuffer));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const pdfHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    console.log('PDF hash:', pdfHash);

    // Check for duplicate PDF by hash
    const { data: existingDocs } = await supabase
      .from('purchase_documents')
      .select('id, invoice_number')
      .eq('pdf_hash', pdfHash)
      .eq('organization_id', organization_id)
      .limit(1);

    if (existingDocs && existingDocs.length > 0) {
      console.log('Duplicate PDF detected by hash');
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            is_duplicate: true,
            duplicate_reason: `Ce document a déjà été traité (Facture: ${existingDocs[0].invoice_number || 'Sans numéro'})`,
            invoice_number: null,
            invoice_date: null,
            supplier: null,
            products: [],
            totals: {
              subtotal_ht: 0,
              total_vat: 0,
              total_discount: 0,
              ht_after_discount: 0,
              total_ttc: 0,
              stamp_duty_amount: 0,
              net_payable: 0,
              currency: 'TND',
              vat_breakdown: []
            }
          },
          pdf_hash: pdfHash
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call Lovable AI Gateway for PDF analysis
    console.log('Calling AI for PDF analysis...');
    
    const prompt = `Tu es un expert en extraction de données de factures d'achat tunisiennes et internationales. Analyse ce document PDF avec une attention EXTRÊME aux détails.

═══════════════════════════════════════════════════════════════
RÈGLE #1 - IDENTIFICATION FOURNISSEUR vs CLIENT (CRITIQUE!)
═══════════════════════════════════════════════════════════════

Cette facture est une FACTURE D'ACHAT. Nous sommes l'ACHETEUR (celui qui paie).
Tu dois extraire les informations du FOURNISSEUR/VENDEUR (celui qui encaisse).

COMMENT IDENTIFIER LE FOURNISSEUR (VENDEUR):
✅ En HAUT de la facture, dans l'en-tête
✅ À côté du LOGO de l'entreprise
✅ Celui qui ÉMET la facture (mentionné comme "De:", "From:", "Vendeur:", "Émetteur:")
✅ Son matricule fiscal (MF) est généralement le PREMIER visible
✅ Ses coordonnées bancaires (RIB/IBAN) sont présentes pour recevoir le paiement
✅ Son nom apparaît dans le titre de la facture ou numéro de facture

À IGNORER (C'EST NOUS LE CLIENT/ACHETEUR):
❌ Tout ce qui est après "Facturé à:", "À:", "Client:", "Destinataire:", "Bill to:", "Livré à:", "Delivery to:"
❌ L'entité qui REÇOIT la facture

═══════════════════════════════════════════════════════════════
RÈGLE #2 - MATRICULE FISCAL (IDENTIFIANT) - OBLIGATOIRE!
═══════════════════════════════════════════════════════════════

CHERCHE ACTIVEMENT le matricule fiscal du FOURNISSEUR. Il est souvent noté comme:
- "M.F:", "MF:", "Matricule Fiscal:", "Mat. Fiscal:", "Matr. Fisc.:"
- "Tax ID:", "VAT Number:", "TVA:", "NIF:", "R.C:"
- Format tunisien typique: 7 chiffres + 1-3 lettres + 3 chiffres (ex: 1234567ABC000, 1234567/A/M/000)
- Peut être avec ou sans séparateurs (espaces, /, -)

SI tu trouves un MF:
- identifier_type = "MF"
- identifier_value = le matricule COMPLET tel qu'il apparaît

SI tu trouves une CIN (8 chiffres):
- identifier_type = "CIN"
- identifier_value = les 8 chiffres

IMPORTANT: NE LAISSE PAS identifier_value VIDE si un matricule est visible!

═══════════════════════════════════════════════════════════════

IMPORTANT: Réponds UNIQUEMENT avec un objet JSON valide, sans texte avant ou après.

{
  "invoice_number": "numéro de facture ou null",
  "invoice_date": "date au format YYYY-MM-DD ou null",
  "supplier": {
    "name": "nom du FOURNISSEUR/VENDEUR (raison sociale ou nom complet)",
    "company_name": "raison sociale du FOURNISSEUR si entreprise, sinon null",
    "first_name": "prénom du FOURNISSEUR si particulier, sinon null",
    "last_name": "nom de famille du FOURNISSEUR si particulier, sinon null",
    "identifier_type": "MF" ou "CIN" ou "PASSPORT" ou "RNE" ou null,
    "identifier_value": "matricule fiscal COMPLET ou CIN - NE PAS LAISSER VIDE SI VISIBLE!",
    "address": "adresse complète du FOURNISSEUR ou null",
    "postal_code": "code postal du FOURNISSEUR ou null",
    "phone": "téléphone du FOURNISSEUR (sans préfixe) ou null",
    "phone_prefix": "+216" ou autre préfixe,
    "email": "email du FOURNISSEUR ou null",
    "whatsapp": "whatsapp ou null",
    "whatsapp_prefix": "+216" ou autre préfixe,
    "country": "TN" pour Tunisie, sinon code ISO 2 lettres,
    "governorate": "gouvernorat tunisien ou null",
    "supplier_type": "business_local" si MF tunisien, "individual_local" si CIN, "foreign" si étranger
  },
  "products": [
    {
      "name": "nom du produit (obligatoire)",
      "reference": "référence produit ou null",
      "ean": "code EAN/barcode ou null",
      "quantity": 1,
      "unit_price_ht": 100.000,
      "unit_price_ttc": 119.000,
      "vat_rate": 19,
      "discount_percent": 0,
      "line_total_ht": 100.000,
      "line_total_ttc": 119.000,
      "line_vat": 19.000,
      "product_type": "physical" ou "service",
      "unit": "piece",
      "max_discount": 0,
      "unlimited_stock": false,
      "allow_out_of_stock_sale": false,
      "purchase_year": 2025
    }
  ],
  "totals": {
    "subtotal_ht": 100.000,
    "total_discount": 0,
    "ht_after_discount": 100.000,
    "total_vat": 19.000,
    "total_ttc": 119.000,
    "stamp_duty_amount": 1.000,
    "net_payable": 120.000,
    "currency": "TND",
    "vat_breakdown": [
      { "rate": 19, "base_ht": 100.000, "vat_amount": 19.000 }
    ]
  }
}

RÈGLES EXTRACTION:
1. MATRICULE FISCAL: Cherche PARTOUT dans l'en-tête du fournisseur. C'est CRITIQUE!
2. Gouvernorats tunisiens valides: Tunis, Ariana, Ben Arous, Manouba, Nabeul, Zaghouan, Bizerte, Béja, Jendouba, Le Kef, Siliana, Sousse, Monastir, Mahdia, Sfax, Kairouan, Kasserine, Sidi Bouzid, Gabès, Medenine, Tataouine, Gafsa, Tozeur, Kébili
3. TVA tunisienne: 0%, 7%, 13%, 19% - Défaut 19%
4. Timbre fiscal: 1 DT pour factures locales, 0 pour étrangers`;

    console.log('Prompt prepared, calling AI...');

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:application/pdf;base64,${pdfBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 8192,
        temperature: 0.1,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: 'Payment required. Please add credits to your workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log('AI response received');

    const responseText = aiData.choices?.[0]?.message?.content || '';
    console.log('AI raw response length:', responseText.length);

    // Parse JSON from response
    let extractedData: ExtractionResult;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Get invoice year for purchase_year default
        const invoiceYear = parsed.invoice_date 
          ? new Date(parsed.invoice_date).getFullYear() 
          : new Date().getFullYear();
        
        // Process and validate products
        const products: ExtractedProduct[] = (parsed.products || []).map((p: any) => {
          // Validate and clean EAN
          let cleanEan = p.ean || null;
          if (cleanEan) {
            const barcodeCheck = validateBarcode(cleanEan);
            if (!barcodeCheck.valid) {
              console.log(`Invalid barcode format for product "${p.name}": ${cleanEan}`);
              cleanEan = null; // Reject invalid barcodes
            }
          }
          
          // Calculate prices if missing
          const vatRate = p.vat_rate ?? 19;
          let unitPriceHt = p.unit_price_ht || 0;
          let unitPriceTtc = p.unit_price_ttc || 0;
          
          if (unitPriceHt && !unitPriceTtc) {
            unitPriceTtc = unitPriceHt * (1 + vatRate / 100);
          } else if (unitPriceTtc && !unitPriceHt) {
            unitPriceHt = unitPriceTtc / (1 + vatRate / 100);
          }
          
          const quantity = p.quantity || 1;
          const discountPercent = p.discount_percent || 0;
          const discountMultiplier = 1 - discountPercent / 100;
          
          const lineTotalHt = p.line_total_ht || (quantity * unitPriceHt * discountMultiplier);
          const lineVat = p.line_vat || (lineTotalHt * vatRate / 100);
          const lineTotalTtc = p.line_total_ttc || (lineTotalHt + lineVat);
          
          return {
            name: p.name || 'Produit sans nom',
            reference: p.reference || null,
            ean: cleanEan,
            quantity,
            unit_price_ht: unitPriceHt,
            unit_price_ttc: unitPriceTtc,
            vat_rate: vatRate,
            discount_percent: discountPercent,
            line_total_ht: lineTotalHt,
            line_total_ttc: lineTotalTtc,
            line_vat: lineVat,
            product_type: p.product_type === 'service' ? 'service' : 'physical',
            unit: p.unit || 'piece',
            max_discount: p.max_discount || 0,
            unlimited_stock: p.unlimited_stock || false,
            allow_out_of_stock_sale: p.allow_out_of_stock_sale || false,
            purchase_year: p.purchase_year || invoiceYear,
          };
        });
        
        // Process totals
        const isForeign = parsed.supplier?.supplier_type === 'foreign';
        const totals: ExtractedTotals = {
          subtotal_ht: parsed.totals?.subtotal_ht || 0,
          total_discount: parsed.totals?.total_discount || 0,
          ht_after_discount: parsed.totals?.ht_after_discount || 
            (parsed.totals?.subtotal_ht || 0) - (parsed.totals?.total_discount || 0),
          total_vat: parsed.totals?.total_vat || 0,
          total_ttc: parsed.totals?.total_ttc || 0,
          stamp_duty_amount: isForeign ? 0 : (parsed.totals?.stamp_duty_amount || 0),
          net_payable: parsed.totals?.net_payable || 0,
          currency: parsed.totals?.currency || 'USD',
          vat_breakdown: parsed.totals?.vat_breakdown || [],
        };
        
        // Recalculate net_payable if needed
        if (!totals.net_payable) {
          totals.net_payable = totals.total_ttc + (isForeign ? 0 : totals.stamp_duty_amount);
        }
        
        // Build VAT breakdown from products if not provided
        if (totals.vat_breakdown.length === 0 && products.length > 0) {
          const vatMap = new Map<number, { base_ht: number; vat_amount: number }>();
          for (const prod of products) {
            const existing = vatMap.get(prod.vat_rate) || { base_ht: 0, vat_amount: 0 };
            existing.base_ht += prod.line_total_ht;
            existing.vat_amount += prod.line_vat;
            vatMap.set(prod.vat_rate, existing);
          }
          totals.vat_breakdown = Array.from(vatMap.entries()).map(([rate, data]) => ({
            rate,
            base_ht: data.base_ht,
            vat_amount: data.vat_amount,
          }));
        }
        
        // Process supplier
        let supplier: ExtractedSupplier | null = parsed.supplier ? {
          name: parsed.supplier.name || parsed.supplier.company_name || 
                `${parsed.supplier.first_name || ''} ${parsed.supplier.last_name || ''}`.trim() || 'Fournisseur inconnu',
          company_name: parsed.supplier.company_name || null,
          first_name: parsed.supplier.first_name || null,
          last_name: parsed.supplier.last_name || null,
          identifier_type: parsed.supplier.identifier_type || null,
          identifier_value: parsed.supplier.identifier_value || null,
          address: parsed.supplier.address || null,
          postal_code: parsed.supplier.postal_code || null,
          phone: parsed.supplier.phone || null,
          phone_prefix: parsed.supplier.phone_prefix || '+216',
          email: parsed.supplier.email || null,
          whatsapp: parsed.supplier.whatsapp || null,
          whatsapp_prefix: parsed.supplier.whatsapp_prefix || '+216',
          country: parsed.supplier.country || 'TN',
          governorate: parsed.supplier.governorate || null,
          supplier_type: parsed.supplier.supplier_type || 'business_local',
          is_existing: false,
          existing_supplier_id: null,
          match_confidence: null,
          match_reason: null,
        } : null;
        
        // Intelligent supplier matching
        if (supplier) {
          console.log('Searching for existing supplier match...');
          
          const supplierName = supplier.name?.toLowerCase().trim() || '';
          const supplierCompanyName = supplier.company_name?.toLowerCase().trim() || '';
          const supplierIdentifier = supplier.identifier_value?.trim() || '';
          const supplierFirstName = supplier.first_name?.toLowerCase().trim() || '';
          const supplierLastName = supplier.last_name?.toLowerCase().trim() || '';
          
          // Fetch all active suppliers for the organization
          const { data: existingSuppliers, error: suppliersError } = await supabase
            .from('suppliers')
            .select('id, company_name, first_name, last_name, identifier_type, identifier_value, supplier_type, country, governorate, address, phone, phone_prefix, email')
            .eq('organization_id', organization_id)
            .eq('status', 'active');
          
          if (!suppliersError && existingSuppliers && existingSuppliers.length > 0) {
            let bestMatch: { supplier: any; confidence: number; reason: string } | null = null;
            
            for (const existingSupplier of existingSuppliers) {
              let confidence = 0;
              const reasons: string[] = [];
              
              // 1. Exact identifier match (highest priority - 100% confidence)
              if (supplierIdentifier && existingSupplier.identifier_value) {
                const normalizedExtracted = supplierIdentifier.replace(/[\s\.\-\/]/g, '').toUpperCase();
                const normalizedExisting = existingSupplier.identifier_value.replace(/[\s\.\-\/]/g, '').toUpperCase();
                
                if (normalizedExtracted === normalizedExisting) {
                  confidence = 100;
                  reasons.push(`MF identique: ${existingSupplier.identifier_value}`);
                } else if (normalizedExtracted.includes(normalizedExisting) || normalizedExisting.includes(normalizedExtracted)) {
                  confidence = Math.max(confidence, 85);
                  reasons.push(`MF similaire: ${existingSupplier.identifier_value}`);
                }
              }
              
              // 2. Company name matching
              if (confidence < 100 && supplierCompanyName && existingSupplier.company_name) {
                const existingCompanyName = existingSupplier.company_name.toLowerCase().trim();
                
                if (supplierCompanyName === existingCompanyName) {
                  confidence = Math.max(confidence, 95);
                  reasons.push(`Raison sociale identique`);
                } else if (supplierCompanyName.includes(existingCompanyName) || existingCompanyName.includes(supplierCompanyName)) {
                  confidence = Math.max(confidence, 80);
                  reasons.push(`Raison sociale similaire`);
                } else {
                  const extractedWords = supplierCompanyName.split(/[\s\-\.]+/).filter((w: string) => w.length > 2);
                  const existingWords = existingCompanyName.split(/[\s\-\.]+/).filter((w: string) => w.length > 2);
                  const commonWords = extractedWords.filter((w: string) => existingWords.some((ew: string) => ew.includes(w) || w.includes(ew)));
                  
                  if (commonWords.length >= 2 || (commonWords.length === 1 && extractedWords.length <= 2)) {
                    const matchRatio = commonWords.length / Math.max(extractedWords.length, existingWords.length);
                    const wordConfidence = Math.min(75, Math.round(matchRatio * 75));
                    if (wordConfidence > confidence) {
                      confidence = wordConfidence;
                      reasons.push(`Mots communs: ${commonWords.join(', ')}`);
                    }
                  }
                }
              }
              
              // 3. Individual name matching
              if (confidence < 100 && supplierFirstName && supplierLastName && existingSupplier.first_name && existingSupplier.last_name) {
                const existingFirstName = existingSupplier.first_name.toLowerCase().trim();
                const existingLastName = existingSupplier.last_name.toLowerCase().trim();
                
                if (supplierFirstName === existingFirstName && supplierLastName === existingLastName) {
                  confidence = Math.max(confidence, 95);
                  reasons.push(`Nom identique`);
                } else if (supplierLastName === existingLastName) {
                  confidence = Math.max(confidence, 80);
                  reasons.push(`Nom de famille identique`);
                }
              }
              
              // 4. Generic name matching
              if (confidence < 70 && supplierName) {
                const existingFullName = existingSupplier.company_name?.toLowerCase() || 
                  `${existingSupplier.first_name || ''} ${existingSupplier.last_name || ''}`.toLowerCase().trim();
                
                if (supplierName === existingFullName) {
                  confidence = Math.max(confidence, 90);
                  reasons.push(`Nom exact`);
                } else if (supplierName.includes(existingFullName) || existingFullName.includes(supplierName)) {
                  confidence = Math.max(confidence, 70);
                  reasons.push(`Nom partiel`);
                }
              }
              
              if (confidence >= 60 && (!bestMatch || confidence > bestMatch.confidence)) {
                bestMatch = { supplier: existingSupplier, confidence, reason: reasons.join(' | ') };
              }
            }
            
            if (bestMatch) {
              console.log(`Supplier match: ${bestMatch.supplier.company_name || bestMatch.supplier.first_name} (${bestMatch.confidence}%)`);
              
              supplier.is_existing = true;
              supplier.existing_supplier_id = bestMatch.supplier.id;
              supplier.match_confidence = bestMatch.confidence;
              supplier.match_reason = bestMatch.reason;
              
              // Enrich with existing data if missing
              if (!supplier.phone && bestMatch.supplier.phone) {
                supplier.phone = bestMatch.supplier.phone;
                supplier.phone_prefix = bestMatch.supplier.phone_prefix || '+216';
              }
              if (!supplier.email && bestMatch.supplier.email) {
                supplier.email = bestMatch.supplier.email;
              }
              if (!supplier.address && bestMatch.supplier.address) {
                supplier.address = bestMatch.supplier.address;
              }
              if (!supplier.governorate && bestMatch.supplier.governorate) {
                supplier.governorate = bestMatch.supplier.governorate;
              }
            }
          }
        }
        
        extractedData = {
          invoice_number: parsed.invoice_number || null,
          invoice_date: parsed.invoice_date || null,
          supplier,
          products,
          totals,
          is_duplicate: false,
          duplicate_reason: null,
        };
        
        console.log('Extraction processed:', {
          invoice_number: extractedData.invoice_number,
          supplier_name: extractedData.supplier?.name,
          supplier_company: extractedData.supplier?.company_name,
          supplier_identifier_type: extractedData.supplier?.identifier_type,
          supplier_identifier_value: extractedData.supplier?.identifier_value,
          supplier_type: extractedData.supplier?.supplier_type,
          supplier_address: extractedData.supplier?.address,
          supplier_phone: extractedData.supplier?.phone,
          supplier_email: extractedData.supplier?.email,
          supplier_governorate: extractedData.supplier?.governorate,
          supplier_matched: extractedData.supplier?.is_existing,
          match_confidence: extractedData.supplier?.match_confidence,
          products_count: extractedData.products.length,
          currency: extractedData.totals.currency,
          vat_rates: extractedData.totals.vat_breakdown.map(v => v.rate),
        });
        
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      extractedData = {
        invoice_number: null,
        invoice_date: null,
        supplier: null,
        products: [],
        totals: {
          subtotal_ht: 0,
          total_vat: 0,
          total_discount: 0,
          ht_after_discount: 0,
          total_ttc: 0,
          stamp_duty_amount: 0,
          net_payable: 0,
          currency: 'USD',
          vat_breakdown: []
        },
        is_duplicate: false,
        duplicate_reason: null
      };
    }

    // Check for duplicate based on supplier + invoice_number + invoice_date combination
    if (extractedData.invoice_number && extractedData.invoice_date && extractedData.supplier) {
      console.log('Checking for duplicate by supplier + invoice_number + date...');
      
      const supplierName = extractedData.supplier.name;
      const supplierIdentifier = extractedData.supplier.identifier_value;
      
      let supplierQuery = supabase
        .from('suppliers')
        .select('id, company_name, first_name, last_name, identifier_value')
        .eq('organization_id', organization_id);
      
      const conditions: string[] = [];
      if (supplierName) {
        conditions.push(`company_name.ilike.%${supplierName}%`);
        const nameParts = supplierName.split(' ');
        if (nameParts.length >= 1) {
          conditions.push(`first_name.ilike.%${nameParts[0]}%`);
        }
      }
      if (supplierIdentifier) {
        conditions.push(`identifier_value.eq.${supplierIdentifier}`);
      }
      
      if (conditions.length > 0) {
        const { data: matchingSuppliers } = await supplierQuery.or(conditions.join(','));
        
        if (matchingSuppliers && matchingSuppliers.length > 0) {
          const supplierIds = matchingSuppliers.map(s => s.id);
          
          const { data: duplicateDocs } = await supabase
            .from('purchase_documents')
            .select('id, invoice_number, invoice_date, supplier_id, suppliers!inner(company_name, first_name, last_name)')
            .eq('organization_id', organization_id)
            .eq('invoice_number', extractedData.invoice_number)
            .eq('invoice_date', extractedData.invoice_date)
            .in('supplier_id', supplierIds)
            .limit(1);
          
          if (duplicateDocs && duplicateDocs.length > 0) {
            const existingDoc = duplicateDocs[0];
            const existingSupplier = existingDoc.suppliers as any;
            const supplierDisplayName = existingSupplier?.company_name || 
              `${existingSupplier?.first_name || ''} ${existingSupplier?.last_name || ''}`.trim();
            
            console.log('Duplicate found by supplier + invoice_number + date');
            
            return new Response(
              JSON.stringify({
                success: true,
                data: {
                  is_duplicate: true,
                  duplicate_reason: `Ce document existe déjà: Facture N° ${existingDoc.invoice_number} du ${existingDoc.invoice_date} pour le fournisseur "${supplierDisplayName}"`,
                  invoice_number: extractedData.invoice_number,
                  invoice_date: extractedData.invoice_date,
                  supplier: extractedData.supplier,
                  products: [],
                  totals: {
                    subtotal_ht: 0,
                    total_vat: 0,
                    total_discount: 0,
                    ht_after_discount: 0,
                    total_ttc: 0,
                    stamp_duty_amount: 0,
                    net_payable: 0,
                    currency: 'TND',
                    vat_breakdown: []
                  }
                },
                pdf_hash: pdfHash
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: extractedData,
        pdf_hash: pdfHash
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error analyzing PDF:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to analyze PDF' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
