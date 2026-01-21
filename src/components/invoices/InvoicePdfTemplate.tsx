import React, { useEffect, useState, useMemo } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { Invoice, formatCurrency } from './types';
import { usePdfSettings } from '@/contexts/PdfSettingsContext';

interface Organization {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  governorate: string;
  postal_code: string;
  phone: string;
  email: string | null;
  identifier_type: string | null;
  identifier: string | null;
  logo_url: string | null;
}

interface OrganizationBank {
  iban: string;
  bank_name: string | null;
}

interface Client {
  id: string;
  client_type: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  address: string | null;
  governorate: string | null;
  postal_code: string | null;
  country: string;
  identifier_type: string;
  identifier_value: string;
}

interface InvoiceLineWithProduct {
  id: string;
  invoice_id: string;
  product_id: string;
  description: string | null;
  quantity: number;
  unit_price_ht: number;
  vat_rate: number;
  discount_percent: number;
  line_total_ht: number;
  line_vat: number;
  line_total_ttc: number;
  line_order: number;
  created_at: string;
  product: {
    id: string;
    name: string;
    reference: string | null;
  } | null;
}

interface InvoicePdfTemplateProps {
  invoiceId: string;
  onReady?: () => void;
}

// Constants for pagination
const LINES_PER_FIRST_PAGE = 12;
const LINES_PER_CONTINUATION_PAGE = 20;

export const InvoicePdfTemplate: React.FC<InvoicePdfTemplateProps> = ({ 
  invoiceId,
  onReady 
}) => {
  const { isComponentEnabled } = usePdfSettings();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [lines, setLines] = useState<InvoiceLineWithProduct[]>([]);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [banks, setBanks] = useState<OrganizationBank[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Helper to check if a component is enabled
  const isEnabled = (componentId: string) => isComponentEnabled('invoice', componentId);
  
  // Check if parent is enabled for child visibility
  const isCompanyFieldVisible = (fieldId: string) => isEnabled('company_info') && isEnabled(fieldId);
  const isClientFieldVisible = (fieldId: string) => isEnabled('client_info') && isEnabled(fieldId);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch invoice
        const { data: invoiceData, error: invoiceError } = await supabase
          .from('invoices')
          .select('*')
          .eq('id', invoiceId)
          .single();

        if (invoiceError) throw invoiceError;
        setInvoice(invoiceData as Invoice);

        // Fetch client
        const { data: clientData } = await supabase
          .from('clients')
          .select('*')
          .eq('id', invoiceData.client_id)
          .single();
        setClient(clientData);

        // Fetch organization
        const { data: orgData } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', invoiceData.organization_id)
          .single();
        setOrganization(orgData);

        // Fetch organization banks
        const { data: banksData } = await supabase
          .from('organization_banks')
          .select('iban, bank_name')
          .eq('organization_id', invoiceData.organization_id);
        setBanks(banksData || []);

        // Fetch invoice lines with products
        const { data: linesData } = await supabase
          .from('invoice_lines')
          .select(`
            *,
            product:products(id, name, reference)
          `)
          .eq('invoice_id', invoiceId)
          .order('line_order', { ascending: true });
        setLines(linesData || []);

      } catch (error) {
        console.error('Error fetching invoice data:', error);
      } finally {
        setIsLoading(false);
        onReady?.();
      }
    };

    fetchData();
  }, [invoiceId, onReady]);

  // Calculate VAT breakdown by rate
  const vatBreakdown = useMemo(() => {
    const breakdown: { [rate: number]: { baseHt: number; vatAmount: number } } = {};
    
    lines.forEach(line => {
      const rate = line.vat_rate;
      if (!breakdown[rate]) {
        breakdown[rate] = { baseHt: 0, vatAmount: 0 };
      }
      breakdown[rate].baseHt += line.line_total_ht;
      breakdown[rate].vatAmount += line.line_vat;
    });
    
    return Object.entries(breakdown)
      .map(([rate, values]) => ({
        rate: Number(rate),
        baseHt: values.baseHt,
        vatAmount: values.vatAmount
      }))
      .sort((a, b) => a.rate - b.rate);
  }, [lines]);

  // Calculate pages for pagination
  const pages = useMemo(() => {
    if (lines.length === 0) return [[]] as InvoiceLineWithProduct[][];
    
    const result: InvoiceLineWithProduct[][] = [];
    let remaining = [...lines];
    
    // First page
    const firstPageLines = remaining.splice(0, LINES_PER_FIRST_PAGE);
    result.push(firstPageLines);
    
    // Continuation pages
    while (remaining.length > 0) {
      const pageLines = remaining.splice(0, LINES_PER_CONTINUATION_PAGE);
      result.push(pageLines);
    }
    
    return result;
  }, [lines]);

  const totalPages = pages.length;

  if (isLoading || !invoice || !organization) {
    return (
      <div className="flex items-center justify-center min-h-[297mm]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0a84ff]"></div>
      </div>
    );
  }

  const getClientName = () => {
    if (!client) return '-';
    if (client.company_name) return client.company_name;
    return `${client.first_name || ''} ${client.last_name || ''}`.trim() || '-';
  };

  const getClientAddress = () => {
    if (!client) return '';
    const parts = [
      client.address,
      client.governorate,
      client.postal_code,
      client.country
    ].filter(Boolean);
    return parts.join(', ');
  };

  const isForeign = invoice.client_type === 'foreign';

  const getPaymentStatusLabel = () => {
    switch (invoice.payment_status) {
      case 'paid': return 'PAYÉ';
      case 'partial': return 'PARTIEL';
      default: return 'IMPAYÉ';
    }
  };

  const getStatusLabel = () => {
    switch (invoice.status) {
      case 'validated': return 'VALIDÉE';
      case 'draft': return 'BROUILLON';
      default: return 'CRÉÉE';
    }
  };

  const styles = `
    @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700&display=swap');
    
    .invoice-pdf-container * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      font-family: 'Orbitron', sans-serif;
    }

    .invoice-pdf-container {
      background: #fff;
      padding: 0;
    }

    .invoice-pdf-page {
      width: 210mm;
      height: 297mm;
      margin: auto;
      padding: 25px 30px;
      border: 1px solid #cfd8dc;
      position: relative;
      background: #fff;
      page-break-after: always;
      overflow: hidden;
    }

    .invoice-pdf-page:last-child {
      page-break-after: auto;
    }

    .invoice-corner {
      position: absolute;
      width: 40px;
      height: 40px;
      border: 3px solid #0a84ff;
    }
    .invoice-tl { top: 10px; left: 10px; border-right: none; border-bottom: none; }
    .invoice-tr { top: 10px; right: 10px; border-left: none; border-bottom: none; }
    .invoice-bl { bottom: 10px; left: 10px; border-right: none; border-top: none; }
    .invoice-br { bottom: 10px; right: 10px; border-left: none; border-top: none; }

    .invoice-header {
      display: flex;
      justify-content: space-between;
      border-bottom: 2px solid #0a84ff;
      padding-bottom: 12px;
    }

    .invoice-company {
      font-size: 11px;
      line-height: 1.5;
    }

    .invoice-company span {
      font-weight: 700;
      font-size: 15px;
      color: #0a84ff;
      display: block;
      margin-bottom: 4px;
    }

    .invoice-company-logo {
      max-width: 70px;
      max-height: 45px;
      object-fit: contain;
      margin-bottom: 6px;
    }

    .invoice-box {
      text-align: right;
    }

    .invoice-box h1 {
      font-size: 32px;
      color: #0a84ff;
      margin: 0;
    }

    .invoice-badge {
      display: inline-block;
      background: linear-gradient(90deg, #0a84ff, #00c6ff);
      color: #fff;
      padding: 5px 12px;
      border-radius: 30px;
      font-size: 11px;
      margin: 4px 0;
    }

    .invoice-info {
      display: flex;
      justify-content: space-between;
      margin: 15px 0;
      gap: 15px;
    }

    .invoice-card {
      width: 48%;
      border: 1px solid #0a84ff;
      padding: 10px;
      position: relative;
    }

    .invoice-card::before {
      content: attr(data-label);
      position: absolute;
      top: -8px;
      left: 10px;
      background: #fff;
      padding: 0 6px;
      font-size: 10px;
      color: #0a84ff;
      font-weight: 600;
    }

    .invoice-card p {
      font-size: 11px;
      margin: 3px 0;
      line-height: 1.3;
    }

    .invoice-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
    }

    .invoice-table th {
      background: linear-gradient(90deg, #0a84ff, #00c6ff);
      color: #fff;
      padding: 8px;
      font-size: 10px;
      text-align: left;
    }

    .invoice-table th:last-child {
      text-align: right;
    }

    .invoice-table td {
      border: 1px solid #b0bec5;
      padding: 6px 8px;
      font-size: 10px;
    }

    .invoice-table td:last-child {
      text-align: right;
    }

    .invoice-table tbody tr:nth-child(even) {
      background: #f4faff;
    }

    .invoice-totals {
      display: flex;
      justify-content: space-between;
      margin-top: 15px;
      gap: 20px;
    }

    .invoice-vat-breakdown {
      width: 240px;
      border: 2px solid #0a84ff;
      padding: 10px;
    }

    .invoice-vat-breakdown-title {
      font-size: 11px;
      font-weight: 700;
      color: #0a84ff;
      margin-bottom: 8px;
      text-align: center;
      border-bottom: 1px solid #0a84ff;
      padding-bottom: 5px;
    }

    .invoice-vat-breakdown table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
    }

    .invoice-vat-breakdown th {
      background: #f4faff;
      padding: 4px 6px;
      text-align: left;
      font-weight: 600;
      border-bottom: 1px solid #b0bec5;
    }

    .invoice-vat-breakdown th:last-child,
    .invoice-vat-breakdown td:last-child {
      text-align: right;
    }

    .invoice-vat-breakdown td {
      padding: 4px 6px;
      border-bottom: 1px solid #e0e0e0;
    }

    .invoice-vat-breakdown tfoot td {
      font-weight: 700;
      border-top: 1px solid #0a84ff;
      background: #f4faff;
    }

    .invoice-total-box {
      width: 280px;
      border: 2px solid #0a84ff;
      padding: 10px;
    }

    .invoice-total-box p {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      margin: 4px 0;
    }

    .invoice-grand {
      font-size: 13px;
      font-weight: 700;
      color: #0a84ff;
      border-top: 2px solid #0a84ff;
      padding-top: 5px;
      margin-top: 6px;
    }

    .invoice-footer {
      position: absolute;
      bottom: 25px;
      left: 30px;
      right: 30px;
      border-top: 2px solid #0a84ff;
      padding-top: 8px;
      font-size: 10px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }

    .invoice-footer-bank {
      line-height: 1.4;
    }

    .invoice-footer-signature {
      text-align: center;
    }

    .invoice-footer-signature-line {
      width: 130px;
      border-bottom: 1px solid #333;
      margin-bottom: 4px;
      height: 35px;
    }

    .invoice-page-number {
      position: absolute;
      bottom: 8px;
      right: 30px;
      font-size: 9px;
      color: #666;
    }

    .invoice-continuation-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #0a84ff;
      padding-bottom: 10px;
      margin-bottom: 15px;
    }

    .invoice-continuation-header h2 {
      font-size: 18px;
      color: #0a84ff;
    }

    @media print {
      body { padding: 0; margin: 0; }
      .invoice-pdf-page { border: none; }
    }
  `;

  const renderTableHeader = () => (
    <thead>
      <tr>
        <th>Description</th>
        <th>Réf</th>
        <th>Qté</th>
        <th>P.U {isForeign ? '' : 'HT'}</th>
        {!isForeign && <th>TVA</th>}
        <th>Remise</th>
        <th>Total {isForeign ? '' : 'HT'}</th>
      </tr>
    </thead>
  );

  const renderTableRows = (pageLines: InvoiceLineWithProduct[]) => (
    <tbody>
      {pageLines.map((line) => (
        <tr key={line.id}>
          <td>
            {line.product?.name || '-'}
            {line.description && <div style={{ fontSize: '9px', fontStyle: 'italic' }}>{line.description}</div>}
          </td>
          <td>{line.product?.reference || '-'}</td>
          <td style={{ textAlign: 'center' }}>{line.quantity}</td>
          <td style={{ textAlign: 'right' }}>{formatCurrency(line.unit_price_ht, invoice.currency)}</td>
          {!isForeign && <td style={{ textAlign: 'center' }}>{line.vat_rate}%</td>}
          <td style={{ textAlign: 'center' }}>{line.discount_percent > 0 ? `${line.discount_percent}%` : '-'}</td>
          <td>{formatCurrency(line.line_total_ht, invoice.currency)}</td>
        </tr>
      ))}
    </tbody>
  );

  const renderTotals = () => (
    <div className="invoice-totals">
      {/* VAT Breakdown by Rate - Left side */}
      {isEnabled('vat_breakdown') && !isForeign && vatBreakdown.length > 0 && (
        <div className="invoice-vat-breakdown">
          <div className="invoice-vat-breakdown-title">RÉCAPITULATIF TVA</div>
          <table>
            <thead>
              <tr>
                <th>Taux</th>
                <th>Base HT</th>
                <th>TVA</th>
              </tr>
            </thead>
            <tbody>
              {vatBreakdown.map((item) => (
                <tr key={item.rate}>
                  <td>{item.rate}%</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(item.baseHt, invoice.currency)}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(item.vatAmount, invoice.currency)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td><strong>Total</strong></td>
                <td style={{ textAlign: 'right' }}>{formatCurrency(invoice.subtotal_ht, invoice.currency)}</td>
                <td style={{ textAlign: 'right' }}>{formatCurrency(invoice.total_vat, invoice.currency)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Totals Box - Right side */}
      {isEnabled('totals_box') && (
        <div className="invoice-total-box">
          {!isForeign && (
            <>
              <p>
                <span>Total HT</span>
                <span>{formatCurrency(invoice.subtotal_ht, invoice.currency)}</span>
              </p>
              <p>
                <span>TVA</span>
                <span>{formatCurrency(invoice.total_vat, invoice.currency)}</span>
              </p>
            </>
          )}
          
          {invoice.total_discount > 0 && (
            <p>
              <span>Remise</span>
              <span style={{ color: '#e53935' }}>-{formatCurrency(invoice.total_discount, invoice.currency)}</span>
            </p>
          )}
          
          {/* Withholding Tax / Retenue à la source - ABOVE Total TTC */}
          {isEnabled('withholding_tax') && invoice.withholding_applied && invoice.withholding_amount > 0 && (
            <p>
              <span>RETENUE À LA SOURCE ({invoice.withholding_rate}%)</span>
              <span style={{ color: '#e53935' }}>-{formatCurrency(invoice.withholding_amount, invoice.currency)}</span>
            </p>
          )}
          
          {!isForeign && (
            <p>
              <span>Total TTC</span>
              <span>{formatCurrency(invoice.total_ttc, invoice.currency)}</span>
            </p>
          )}
          
          {isEnabled('stamp_duty') && !isForeign && invoice.stamp_duty_enabled && (
            <p>
              <span>TIMBRE FISCAL</span>
              <span>{formatCurrency(invoice.stamp_duty_amount, 'TND')}</span>
            </p>
          )}
          
          <p className="invoice-grand">
            <span>NET À PAYER</span>
            <span>{formatCurrency(invoice.net_payable, invoice.currency)}</span>
          </p>
        </div>
      )}
    </div>
  );

  const renderFooter = () => (
    <div className="invoice-footer">
      {isEnabled('bank_info') && (
        <div className="invoice-footer-bank">
          {banks.length > 0 && (
            <>
              <div><strong>IBAN :</strong> {banks[0].iban}</div>
              {banks[0].bank_name && <div><strong>Banque :</strong> {banks[0].bank_name}</div>}
            </>
          )}
        </div>
      )}
      {isEnabled('signature_area') && (
        <div className="invoice-footer-signature">
          <div className="invoice-footer-signature-line"></div>
          <div>Signature autorisée</div>
        </div>
      )}
    </div>
  );

  const renderCorners = () => (
    isEnabled('decorative_corners') ? (
      <>
        <div className="invoice-corner invoice-tl"></div>
        <div className="invoice-corner invoice-tr"></div>
        <div className="invoice-corner invoice-bl"></div>
        <div className="invoice-corner invoice-br"></div>
      </>
    ) : null
  );

  return (
    <div className="invoice-pdf-container">
      <style>{styles}</style>

      {pages.map((pageLines, pageIndex) => (
        <div key={pageIndex} className="invoice-pdf-page">
          {renderCorners()}

          {pageIndex === 0 ? (
            <>
              {/* First page: Full header */}
              <div className="invoice-header">
                {isEnabled('company_info') && (
                  <div className="invoice-company">
                    {isEnabled('logo') && organization.logo_url && (
                      <img 
                        src={organization.logo_url} 
                        alt="Logo" 
                        className="invoice-company-logo"
                      />
                    )}
                    {isCompanyFieldVisible('company_name') && <span>{organization.name}</span>}
                    {isCompanyFieldVisible('company_address') && (
                      <>
                        {organization.address && <div>{organization.address}</div>}
                        <div>{organization.postal_code}, {organization.governorate}</div>
                      </>
                    )}
                    {isCompanyFieldVisible('company_phone') && <div>Tel : {organization.phone}</div>}
                    {isCompanyFieldVisible('company_email') && organization.email && <div>Email : {organization.email}</div>}
                    {isCompanyFieldVisible('company_identifier') && organization.identifier && (
                      <div>{organization.identifier_type} : {organization.identifier}</div>
                    )}
                  </div>
                )}

                <div className="invoice-box">
                  {isEnabled('invoice_title') && <h1>FACTURE</h1>}
                  {isEnabled('invoice_number') && (
                    <div style={{ fontSize: '13px', fontWeight: 700, margin: '4px 0' }}>
                      {invoice.invoice_number}
                    </div>
                  )}
                  {isEnabled('invoice_date') && (
                    <div style={{ fontSize: '11px', margin: '3px 0' }}>
                      Date : {format(new Date(invoice.invoice_date), 'dd/MM/yyyy', { locale: fr })}
                    </div>
                  )}
                  {isEnabled('due_date') && invoice.due_date && (
                    <div style={{ fontSize: '11px', margin: '3px 0' }}>
                      Échéance : {format(new Date(invoice.due_date), 'dd/MM/yyyy', { locale: fr })}
                    </div>
                  )}
                  {isEnabled('status_badge') && <span className="invoice-badge">{getStatusLabel()}</span>}
                </div>
              </div>

              {/* Client & Payment Info */}
              <div className="invoice-info">
                {isEnabled('client_info') && (
                  <div className="invoice-card" data-label="FACTURÉ À">
                    {isClientFieldVisible('client_name') && (
                      <p style={{ fontWeight: 700, fontSize: '12px' }}>{getClientName()}</p>
                    )}
                    {isClientFieldVisible('client_address') && getClientAddress() && <p>{getClientAddress()}</p>}
                    {isClientFieldVisible('client_identifier') && client && (
                      <p>{client.identifier_type} : {client.identifier_value}</p>
                    )}
                  </div>
                )}

                {isEnabled('payment_status') && (
                  <div className="invoice-card" data-label="RÈGLEMENT & STATUT">
                    <p>Paiement : <strong>{getPaymentStatusLabel()}</strong></p>
                    {invoice.paid_amount > 0 && (
                      <p>Montant payé : {formatCurrency(invoice.paid_amount, invoice.currency)}</p>
                    )}
                    {isForeign && (
                      <>
                        <p>Devise : {invoice.currency}</p>
                        {invoice.exchange_rate !== 1 && (
                          <p>Taux de change : {invoice.exchange_rate}</p>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Continuation pages: Compact header */
            <div className="invoice-continuation-header">
              <h2>FACTURE {invoice.invoice_number} (suite)</h2>
              <div style={{ fontSize: '11px', color: '#666' }}>
                {getClientName()}
              </div>
            </div>
          )}

          {/* Products Table */}
          <table className="invoice-table">
            {renderTableHeader()}
            {renderTableRows(pageLines)}
          </table>

          {/* Only show totals and footer on last page */}
          {pageIndex === totalPages - 1 && (
            <>
              {renderTotals()}
              {renderFooter()}
            </>
          )}

          {/* Page number */}
          {totalPages > 1 && (
            <div className="invoice-page-number">
              Page {pageIndex + 1} / {totalPages}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default InvoicePdfTemplate;
