import { InvoiceLineFormData } from './types';

/**
 * Compute the maximum quantity allowed per line index, taking into account:
 * - one global stock cap per product (across all invoice lines)
 * - multiple lines referencing the same product
 * - unlimited stock and allow-out-of-stock-sale rules
 * - edit mode where a product's current_stock already includes deductions from the original invoice
 * - reserved stock: for non-reservation lines, only the available stock (current_stock - reserved_stock) is usable
 */
export function computeMaxQuantityByIndex(
  lines: InvoiceLineFormData[],
  originalTotalsByProduct?: Map<string, number>,
  clientId?: string // Used to determine if reservation stock applies
): Array<number | null> {
  const totalsByProduct = new Map<string, number>();
  const metaByProduct = new Map<
    string,
    {
      unlimited_stock: boolean;
      allow_out_of_stock_sale: boolean;
      current_stock: number | null;
      reserved_stock: number;
    }
  >();

  for (const line of lines) {
    totalsByProduct.set(line.product_id, (totalsByProduct.get(line.product_id) || 0) + line.quantity);

    if (!metaByProduct.has(line.product_id)) {
      metaByProduct.set(line.product_id, {
        unlimited_stock: !!line.unlimited_stock,
        allow_out_of_stock_sale: !!line.allow_out_of_stock_sale,
        current_stock: line.current_stock,
        reserved_stock: line.reserved_stock ?? 0,
      });
    }
  }

  return lines.map((line) => {
    const meta = metaByProduct.get(line.product_id);
    if (!meta) return null;

    // Reservation lines have their own quantity limit
    if (line.fromReservation && line.reservationQuantity) {
      return line.reservationQuantity;
    }

    if (meta.unlimited_stock) return null;
    if (meta.allow_out_of_stock_sale) return null;
    if (meta.current_stock === null) return null;

    const originalTotal = originalTotalsByProduct?.get(line.product_id) ?? 0;
    
    // For non-reservation lines, available stock = current_stock - reserved_stock
    // This prevents selling reserved stock to other clients
    const availableStock = meta.current_stock - meta.reserved_stock;
    const capTotalForProduct = availableStock + originalTotal;

    const totalForProduct = totalsByProduct.get(line.product_id) || 0;
    const otherLinesTotal = totalForProduct - line.quantity;
    const maxForThisLine = capTotalForProduct - otherLinesTotal;

    // Keep invoice quantity sane (>=1). If stock is truly 0 and out-of-stock isn't allowed,
    // the UI will effectively block any further increase and clamp manual input.
    return Math.max(1, maxForThisLine);
  });
}

export function clampInvoiceLinesQuantityAtIndex(
  lines: InvoiceLineFormData[],
  index: number,
  originalTotalsByProduct?: Map<string, number>
): InvoiceLineFormData[] {
  const maxByIndex = computeMaxQuantityByIndex(lines, originalTotalsByProduct);
  const max = maxByIndex[index];
  if (max === null) return lines;

  const current = lines[index];
  if (!current) return lines;

  // Don't clamp reservation lines - they have fixed quantities
  if (current.fromReservation) return lines;

  const clamped = Math.min(Math.max(1, current.quantity), max);
  if (clamped === current.quantity) return lines;

  const next = [...lines];
  next[index] = { ...current, quantity: clamped };
  return next;
}
