import { supabase } from '@/integrations/supabase/client';

/**
 * Recalculates the financial credit (avoir financier) for an invoice after
 * any credit note validation. The financial credit represents the overpayment:
 * 
 * Financial Credit = max(0, Paid Amount - Effective Net Payable)
 * 
 * Where Effective Net Payable = Original Net Payable - Total Credited
 * 
 * This function:
 * 1. Fetches the current invoice state
 * 2. Calculates if overpayment exists
 * 3. Compares with previously applied financial credit
 * 4. Creates/adjusts client account movements for the delta
 */
export async function recalculateFinancialCredit(
  invoiceId: string,
  t: (key: string) => string
): Promise<{ financialCredit: number; delta: number } | null> {
  try {
    // 1. Get invoice current state
    const { data: invoice, error: invError } = await supabase
      .from('invoices')
      .select('id, client_id, organization_id, net_payable, paid_amount, total_credited, invoice_number')
      .eq('id', invoiceId)
      .single();

    if (invError || !invoice) {
      console.error('Error fetching invoice for financial credit:', invError);
      return null;
    }

    // 2. Calculate effective net payable and financial credit
    const effectiveNetPayable = invoice.net_payable - (invoice.total_credited || 0);
    const financialCredit = Math.max(0, (invoice.paid_amount || 0) - effectiveNetPayable);

    // 3. Get previous financial credit movements for this invoice
    const { data: existingMovements } = await supabase
      .from('client_account_movements')
      .select('id, amount')
      .eq('client_id', invoice.client_id)
      .eq('source_type', 'financial_credit')
      .eq('source_id', invoiceId);

    const previousFinancialCredit = (existingMovements || []).reduce(
      (sum, m) => sum + (m.amount || 0),
      0
    );

    // 4. Calculate delta
    const delta = financialCredit - previousFinancialCredit;

    // No significant change
    if (Math.abs(delta) < 0.001) {
      return { financialCredit, delta: 0 };
    }

    // 5. Get current client balance
    const { data: client } = await supabase
      .from('clients')
      .select('account_balance')
      .eq('id', invoice.client_id)
      .single();

    if (!client) return null;

    const newBalance = (client.account_balance || 0) + delta;

    // 6. Create account movement for the delta
    const movementType = delta > 0 ? 'credit' : 'debit';
    const notes = delta > 0
      ? `${t('financial_credit') || 'Avoir financier'} — ${t('invoice') || 'Facture'} ${invoice.invoice_number}`
      : `${t('financial_credit_adjustment') || 'Ajustement avoir financier'} — ${t('invoice') || 'Facture'} ${invoice.invoice_number}`;

    await supabase
      .from('client_account_movements')
      .insert({
        client_id: invoice.client_id,
        organization_id: invoice.organization_id,
        amount: Math.abs(delta),
        balance_after: newBalance,
        movement_type: movementType,
        source_type: 'financial_credit',
        source_id: invoiceId,
        notes,
      });

    // The trigger update_client_balance_after_movement handles updating clients.account_balance

    return { financialCredit, delta };
  } catch (error) {
    console.error('Error recalculating financial credit:', error);
    return null;
  }
}
