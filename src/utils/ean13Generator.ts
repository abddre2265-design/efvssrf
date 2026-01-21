/**
 * Generates a valid EAN-13 barcode
 * Format: PPP-MMMM-NNNNN-C
 * - PPP: Country/company prefix (200-299 for internal use)
 * - MMMM: Manufacturer/organization code
 * - NNNNN: Product code
 * - C: Check digit
 */

/**
 * Calculate the check digit for EAN-13
 */
function calculateCheckDigit(digits: string): number {
  if (digits.length !== 12) {
    throw new Error('EAN-13 requires 12 digits before check digit');
  }

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(digits[i], 10);
    sum += digit * (i % 2 === 0 ? 1 : 3);
  }

  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit;
}

/**
 * Generate a unique EAN-13 barcode
 * Uses prefix 200-299 (internal use range) to avoid conflicts with real products
 */
export function generateEAN13(): string {
  // Use 200 prefix (internal use)
  const prefix = '200';
  
  // Generate timestamp-based component (4 digits from timestamp)
  const timestamp = Date.now().toString();
  const timestampPart = timestamp.slice(-4);
  
  // Generate random component (5 digits)
  const randomPart = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  
  // Combine to get 12 digits
  const base12 = prefix + timestampPart + randomPart;
  
  // Calculate and append check digit
  const checkDigit = calculateCheckDigit(base12);
  
  return base12 + checkDigit.toString();
}

/**
 * Validate an EAN-13 barcode
 */
export function validateEAN13(ean: string): boolean {
  if (!/^\d{13}$/.test(ean)) {
    return false;
  }

  const base12 = ean.slice(0, 12);
  const providedCheckDigit = parseInt(ean[12], 10);
  const calculatedCheckDigit = calculateCheckDigit(base12);

  return providedCheckDigit === calculatedCheckDigit;
}
