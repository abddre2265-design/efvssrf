import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Product {
  id: string;
  name: string;
  reference: string | null;
  price_ht: number;
  price_ttc: number;
  vat_rate: number;
  max_discount: number | null;
  current_stock: number | null;
  unlimited_stock: boolean;
  allow_out_of_stock_sale: boolean | null;
}

interface VatTarget {
  vatRate: number;
  targetHt: number | null;
  targetTtc: number | null;
}

interface GenerationParams {
  clientId: string;
  invoiceDate: string;
  invoiceNumber: { prefix: string; year: number; counter: number; number: string };
  maxLines: number;
  minPriceTtc: number;
  maxPriceTtc: number;
  allowedVatRates: number[];
  vatTargets: VatTarget[];
  stampDutyEnabled: boolean;
  stampDutyAmount: number;
  products: Product[];
  isForeignClient: boolean;
}

interface GeneratedLine {
  product_id: string;
  product_name: string;
  product_reference: string | null;
  quantity: number;
  unit_price_ht: number;
  vat_rate: number;
  discount_percent: number;
  max_discount: number;
  current_stock: number | null;
  unlimited_stock: boolean;
  allow_out_of_stock_sale: boolean;
  line_total_ht: number;
  line_total_ttc: number;
}

function calculateLineTtc(priceHt: number, vatRate: number, quantity: number, discountPercent: number, isForeign: boolean): { ht: number; ttc: number } {
  const lineHt = quantity * priceHt * (1 - discountPercent / 100);
  const lineVat = isForeign ? 0 : lineHt * (vatRate / 100);
  return { ht: lineHt, ttc: lineHt + lineVat };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const params: GenerationParams = await req.json();
    const {
      maxLines,
      minPriceTtc,
      maxPriceTtc,
      allowedVatRates,
      vatTargets,
      products,
      isForeignClient,
    } = params;

    // Filter products by allowed VAT rates and price range
    const eligibleProducts = products.filter(p => {
      if (!allowedVatRates.includes(p.vat_rate)) return false;
      if (p.price_ttc < minPriceTtc || p.price_ttc > maxPriceTtc) return false;
      return true;
    });

    if (eligibleProducts.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "no_eligible_products",
          message: "Aucun produit ne correspond aux critères (taux TVA, prix min/max)" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Group products by VAT rate
    const productsByVat = new Map<number, Product[]>();
    for (const p of eligibleProducts) {
      const existing = productsByVat.get(p.vat_rate) || [];
      existing.push(p);
      productsByVat.set(p.vat_rate, existing);
    }

    // Calculate target totals per VAT rate
    const targetsWithCalculated = vatTargets.map(target => {
      let targetHt = target.targetHt;
      let targetTtc = target.targetTtc;
      
      if (targetHt !== null && targetTtc === null) {
        targetTtc = isForeignClient ? targetHt : targetHt * (1 + target.vatRate / 100);
      } else if (targetTtc !== null && targetHt === null) {
        targetHt = isForeignClient ? targetTtc : targetTtc / (1 + target.vatRate / 100);
      }
      
      return { ...target, targetHt: targetHt || 0, targetTtc: targetTtc || 0 };
    });

    // Stock tracking during generation
    const stockUsed = new Map<string, number>();
    const generatedLines: GeneratedLine[] = [];
    let totalLinesGenerated = 0;

    // Generate lines for each VAT rate target
    for (const target of targetsWithCalculated) {
      if (target.targetHt <= 0) continue;
      
      const vatProducts = productsByVat.get(target.vatRate);
      if (!vatProducts || vatProducts.length === 0) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "no_products_for_vat",
            message: `Aucun produit disponible pour le taux TVA ${target.vatRate}%` 
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let remainingHt = target.targetHt;
      let attempts = 0;
      const maxAttempts = 1000;

      while (remainingHt > 0.01 && totalLinesGenerated < maxLines && attempts < maxAttempts) {
        attempts++;

        // Find products that can fit within remaining amount
        const availableProducts = vatProducts.filter(p => {
          // Check if product price fits
          if (p.price_ht > remainingHt * 1.1) return false; // Allow 10% tolerance
          
          // Check stock availability
          if (p.unlimited_stock) return true;
          if (p.allow_out_of_stock_sale) return true;
          
          const used = stockUsed.get(p.id) || 0;
          const available = (p.current_stock || 0) - used;
          return available > 0;
        });

        if (availableProducts.length === 0) {
          // No more products available, check if we got close enough
          if (remainingHt > target.targetHt * 0.2) { // More than 20% remaining
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: "insufficient_stock",
                message: `Stock insuffisant pour atteindre le montant cible TVA ${target.vatRate}%. Il manque ${remainingHt.toFixed(3)} DT HT.` 
              }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          break; // Close enough, continue with next VAT rate
        }

        // Select random product
        const product = availableProducts[Math.floor(Math.random() * availableProducts.length)];
        
        // Calculate optimal quantity and discount
        const maxDiscount = product.max_discount || 0;
        let bestQuantity = 1;
        let bestDiscount = 0;
        let bestDiff = Infinity;

        // Try different quantities and discounts
        const maxQuantity = product.unlimited_stock || product.allow_out_of_stock_sale 
          ? Math.min(100, Math.ceil(remainingHt / product.price_ht) + 5)
          : Math.min((product.current_stock || 0) - (stockUsed.get(product.id) || 0), Math.ceil(remainingHt / product.price_ht) + 5);

        for (let qty = 1; qty <= Math.max(1, maxQuantity); qty++) {
          for (let discount = 0; discount <= maxDiscount; discount += 0.5) {
            const { ht } = calculateLineTtc(product.price_ht, product.vat_rate, qty, discount, isForeignClient);
            const diff = Math.abs(ht - remainingHt);
            
            if (ht <= remainingHt * 1.05 && diff < bestDiff) { // Allow 5% overshoot
              bestDiff = diff;
              bestQuantity = qty;
              bestDiscount = discount;
            }
          }
        }

        // Validate stock one more time
        if (!product.unlimited_stock && !product.allow_out_of_stock_sale) {
          const used = stockUsed.get(product.id) || 0;
          const available = (product.current_stock || 0) - used;
          if (bestQuantity > available) {
            bestQuantity = Math.max(1, available);
          }
          if (bestQuantity <= 0) continue;
        }

        // Create line
        const { ht: lineHt, ttc: lineTtc } = calculateLineTtc(
          product.price_ht, 
          product.vat_rate, 
          bestQuantity, 
          bestDiscount, 
          isForeignClient
        );

        generatedLines.push({
          product_id: product.id,
          product_name: product.name,
          product_reference: product.reference,
          quantity: bestQuantity,
          unit_price_ht: product.price_ht,
          vat_rate: product.vat_rate,
          discount_percent: bestDiscount,
          max_discount: product.max_discount || 100,
          current_stock: product.current_stock,
          unlimited_stock: product.unlimited_stock,
          allow_out_of_stock_sale: product.allow_out_of_stock_sale || false,
          line_total_ht: lineHt,
          line_total_ttc: lineTtc,
        });

        // Update tracking
        stockUsed.set(product.id, (stockUsed.get(product.id) || 0) + bestQuantity);
        remainingHt -= lineHt;
        totalLinesGenerated++;
      }
    }

    if (generatedLines.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "no_lines_generated",
          message: "Impossible de générer des lignes de facture avec les contraintes données" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate totals
    let subtotalHt = 0;
    let totalVat = 0;
    let totalTtc = 0;

    for (const line of generatedLines) {
      subtotalHt += line.line_total_ht;
      const vat = isForeignClient ? 0 : line.line_total_ht * (line.vat_rate / 100);
      totalVat += vat;
      totalTtc += line.line_total_ht + vat;
    }

    // Compare with targets
    const targetSummary = targetsWithCalculated.map(t => {
      const linesForVat = generatedLines.filter(l => l.vat_rate === t.vatRate);
      const actualHt = linesForVat.reduce((sum, l) => sum + l.line_total_ht, 0);
      return {
        vatRate: t.vatRate,
        targetHt: t.targetHt,
        actualHt,
        difference: actualHt - t.targetHt,
        percentDiff: ((actualHt - t.targetHt) / t.targetHt * 100).toFixed(2),
      };
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        lines: generatedLines,
        summary: {
          subtotalHt,
          totalVat,
          totalTtc,
          lineCount: generatedLines.length,
          targetSummary,
        }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error generating invoice:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: "generation_error",
        message: error instanceof Error ? error.message : "Erreur lors de la génération" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
