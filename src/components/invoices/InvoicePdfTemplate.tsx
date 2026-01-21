import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { Invoice, InvoiceLine, formatCurrency } from './types';

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

export const InvoicePdfTemplate: React.FC<InvoicePdfTemplateProps> = ({ 
  invoiceId,
  onReady 
}) => {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [lines, setLines] = useState<InvoiceLineWithProduct[]>([]);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [banks, setBanks] = useState<OrganizationBank[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
        setInvoice(invoiceData);

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

  return (
    <div className="invoice-pdf-container">
      <style>{`
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
          min-height: 297mm;
          margin: auto;
          padding: 30px;
          border: 1px solid #cfd8dc;
          position: relative;
          background: #fff;
        }

        .invoice-corner {
          position: absolute;
          width: 40px;
          height: 40px;
          border: 3px solid #0a84ff;
        }
        .invoice-tl { top: 10px; left: 10px; border-right: none; border-bottom: none; }
        .invoice-tr { top: 10px; right: 10px; border-left: none; border-bottom: none; }
        .invoice-bl { bottom: 80px; left: 10px; border-right: none; border-top: none; }
        .invoice-br { bottom: 80px; right: 10px; border-left: none; border-top: none; }

        .invoice-header {
          display: flex;
          justify-content: space-between;
          border-bottom: 2px solid #0a84ff;
          padding-bottom: 15px;
        }

        .invoice-company {
          font-size: 12px;
          line-height: 1.6;
        }

        .invoice-company span {
          font-weight: 700;
          font-size: 16px;
          color: #0a84ff;
          display: block;
          margin-bottom: 5px;
        }

        .invoice-company-logo {
          max-width: 80px;
          max-height: 50px;
          object-fit: contain;
          margin-bottom: 8px;
        }

        .invoice-box {
          text-align: right;
        }

        .invoice-box h1 {
          font-size: 36px;
          color: #0a84ff;
          margin: 0;
        }

        .invoice-badge {
          display: inline-block;
          background: linear-gradient(90deg, #0a84ff, #00c6ff);
          color: #fff;
          padding: 6px 15px;
          border-radius: 30px;
          font-size: 12px;
          margin: 5px 0;
        }

        .invoice-info {
          display: flex;
          justify-content: space-between;
          margin: 25px 0;
          gap: 20px;
        }

        .invoice-card {
          width: 48%;
          border: 1px solid #0a84ff;
          padding: 12px;
          position: relative;
        }

        .invoice-card::before {
          content: attr(data-label);
          position: absolute;
          top: -8px;
          left: 10px;
          background: #fff;
          padding: 0 6px;
          font-size: 11px;
          color: #0a84ff;
          font-weight: 600;
        }

        .invoice-card p {
          font-size: 12px;
          margin: 4px 0;
          line-height: 1.4;
        }

        .invoice-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
        }

        .invoice-table th {
          background: linear-gradient(90deg, #0a84ff, #00c6ff);
          color: #fff;
          padding: 10px;
          font-size: 11px;
          text-align: left;
        }

        .invoice-table th:last-child {
          text-align: right;
        }

        .invoice-table td {
          border: 1px solid #b0bec5;
          padding: 8px;
          font-size: 11px;
        }

        .invoice-table td:last-child {
          text-align: right;
        }

        .invoice-table tbody tr:nth-child(even) {
          background: #f4faff;
        }

        .invoice-totals {
          display: flex;
          justify-content: flex-end;
          margin-top: 20px;
        }

        .invoice-total-box {
          width: 300px;
          border: 2px solid #0a84ff;
          padding: 12px;
        }

        .invoice-total-box p {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          margin: 5px 0;
        }

        .invoice-grand {
          font-size: 15px;
          font-weight: 700;
          color: #0a84ff;
          border-top: 2px solid #0a84ff;
          padding-top: 5px;
          margin-top: 8px;
        }

        .invoice-footer {
          position: absolute;
          bottom: 20px;
          left: 30px;
          right: 30px;
          border-top: 2px solid #0a84ff;
          padding-top: 10px;
          font-size: 11px;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
        }

        .invoice-footer-bank {
          line-height: 1.5;
        }

        .invoice-footer-signature {
          text-align: center;
        }

        .invoice-footer-signature-line {
          width: 150px;
          border-bottom: 1px solid #333;
          margin-bottom: 5px;
          height: 40px;
        }

        @media print {
          body { padding: 0; margin: 0; }
          .invoice-pdf-page { border: none; }
        }
      `}</style>

      <div className="invoice-pdf-page">
        {/* Decorative Corners */}
        <div className="invoice-corner invoice-tl"></div>
        <div className="invoice-corner invoice-tr"></div>
        <div className="invoice-corner invoice-bl"></div>
        <div className="invoice-corner invoice-br"></div>

        {/* Header */}
        <div className="invoice-header">
          <div className="invoice-company">
            {organization.logo_url && (
              <img 
                src={organization.logo_url} 
                alt="Logo" 
                className="invoice-company-logo"
              />
            )}
            <span>{organization.name}</span>
            {organization.address && <div>{organization.address}</div>}
            <div>{organization.postal_code}, {organization.governorate}</div>
            <div>Tel : {organization.phone}</div>
            {organization.email && <div>Email : {organization.email}</div>}
            {organization.identifier && (
              <div>{organization.identifier_type} : {organization.identifier}</div>
            )}
          </div>

          <div className="invoice-box">
            <h1>FACTURE</h1>
            <div style={{ fontSize: '14px', fontWeight: 700, margin: '5px 0' }}>
              {invoice.invoice_number}
            </div>
            <div style={{ fontSize: '12px', margin: '5px 0' }}>
              Date : {format(new Date(invoice.invoice_date), 'dd/MM/yyyy', { locale: fr })}
            </div>
            {invoice.due_date && (
              <div style={{ fontSize: '12px', margin: '5px 0' }}>
                Échéance : {format(new Date(invoice.due_date), 'dd/MM/yyyy', { locale: fr })}
              </div>
            )}
            <span className="invoice-badge">{getStatusLabel()}</span>
          </div>
        </div>

        {/* Client & Payment Info */}
        <div className="invoice-info">
          <div className="invoice-card" data-label="FACTURÉ À">
            <p style={{ fontWeight: 700, fontSize: '14px' }}>{getClientName()}</p>
            {getClientAddress() && <p>{getClientAddress()}</p>}
            {client && (
              <p>{client.identifier_type} : {client.identifier_value}</p>
            )}
          </div>

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
        </div>

        {/* Products Table */}
        <table className="invoice-table">
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
          <tbody>
            {lines.map((line) => (
              <tr key={line.id}>
                <td>
                  {line.product?.name || '-'}
                  {line.description && <div style={{ fontSize: '10px', fontStyle: 'italic' }}>{line.description}</div>}
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
        </table>

        {/* Totals */}
        <div className="invoice-totals">
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
            
            {!isForeign && (
              <p>
                <span>Total TTC</span>
                <span>{formatCurrency(invoice.total_ttc, invoice.currency)}</span>
              </p>
            )}
            
            {!isForeign && invoice.stamp_duty_enabled && (
              <p>
                <span>TIMBRE FISCAL</span>
                <span>{formatCurrency(invoice.stamp_duty_amount, 'TND')}</span>
              </p>
            )}
            
            {/* Withholding Tax / Retenue à la source */}
            {invoice.withholding_applied && invoice.withholding_amount > 0 && (
              <p>
                <span>RETENUE À LA SOURCE ({invoice.withholding_rate}%)</span>
                <span style={{ color: '#e53935' }}>-{formatCurrency(invoice.withholding_amount, invoice.currency)}</span>
              </p>
            )}
            
            <p className="invoice-grand">
              <span>NET À PAYER</span>
              <span>{formatCurrency(invoice.net_payable, invoice.currency)}</span>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="invoice-footer">
          <div className="invoice-footer-bank">
            {banks.length > 0 && (
              <>
                <div><strong>IBAN :</strong> {banks[0].iban}</div>
                {banks[0].bank_name && <div><strong>Banque :</strong> {banks[0].bank_name}</div>}
              </>
            )}
          </div>
          <div className="invoice-footer-signature">
            <div className="invoice-footer-signature-line"></div>
            <div>Signature autorisée</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoicePdfTemplate;
