import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { CreditNote, CreditNoteLine } from './types';
import { formatCurrency } from '@/components/invoices/types';

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

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
}

interface CreditNoteLineWithProduct extends CreditNoteLine {
  product: {
    id: string;
    name: string;
    reference: string | null;
  } | null;
}

interface CreditNotePdfTemplateProps {
  creditNoteId: string;
  onReady?: () => void;
}

export const CreditNotePdfTemplate: React.FC<CreditNotePdfTemplateProps> = ({ 
  creditNoteId,
  onReady 
}) => {
  const [creditNote, setCreditNote] = useState<CreditNote | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [lines, setLines] = useState<CreditNoteLineWithProduct[]>([]);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [banks, setBanks] = useState<OrganizationBank[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch credit note
        const { data: cnData, error: cnError } = await supabase
          .from('credit_notes')
          .select('*')
          .eq('id', creditNoteId)
          .single();

        if (cnError) throw cnError;
        setCreditNote(cnData);

        // Fetch client
        const { data: clientData } = await supabase
          .from('clients')
          .select('*')
          .eq('id', cnData.client_id)
          .single();
        setClient(clientData);

        // Fetch invoice
        const { data: invoiceData } = await supabase
          .from('invoices')
          .select('id, invoice_number, invoice_date')
          .eq('id', cnData.invoice_id)
          .single();
        setInvoice(invoiceData);

        // Fetch organization
        const { data: orgData } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', cnData.organization_id)
          .single();
        setOrganization(orgData);

        // Fetch organization banks
        const { data: banksData } = await supabase
          .from('organization_banks')
          .select('iban, bank_name')
          .eq('organization_id', cnData.organization_id);
        setBanks(banksData || []);

        // Fetch credit note lines with products
        const { data: linesData } = await supabase
          .from('credit_note_lines')
          .select(`
            *,
            product:products(id, name, reference)
          `)
          .eq('credit_note_id', creditNoteId)
          .order('line_order', { ascending: true });
        setLines(linesData || []);

      } catch (error) {
        console.error('Error fetching credit note data:', error);
      } finally {
        setIsLoading(false);
        onReady?.();
      }
    };

    fetchData();
  }, [creditNoteId, onReady]);

  if (isLoading || !creditNote || !organization) {
    return (
      <div className="flex items-center justify-center min-h-[297mm]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#e53935]"></div>
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

  const getTypeLabel = () => {
    return creditNote.credit_note_type === 'financial' ? 'AVOIR ARGENT' : 'RETOUR PRODUIT';
  };

  const getStatusLabel = () => {
    switch (creditNote.status) {
      case 'validated': return 'VALIDÉ';
      case 'draft': return 'BROUILLON';
      case 'cancelled': return 'ANNULÉ';
      default: return 'CRÉÉ';
    }
  };

  const getReturnReasonLabel = (reason: string | null) => {
    if (!reason) return '-';
    const reasons: Record<string, string> = {
      'defective': 'Défectueux',
      'wrong_product': 'Mauvais produit',
      'customer_changed_mind': 'Changement d\'avis',
      'damaged_in_transit': 'Endommagé en transit',
      'quality_issue': 'Problème de qualité',
      'other_reason': 'Autre raison'
    };
    return reasons[reason] || reason;
  };

  // Use a red accent for credit notes instead of blue
  const accentColor = '#e53935';
  const gradientEnd = '#ff6f60';

  return (
    <div className="credit-note-pdf-container">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700&display=swap');
        
        .credit-note-pdf-container * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          font-family: 'Orbitron', sans-serif;
        }

        .credit-note-pdf-container {
          background: #fff;
          padding: 0;
        }

        .credit-note-pdf-page {
          width: 210mm;
          min-height: 297mm;
          margin: auto;
          padding: 30px;
          border: 1px solid #cfd8dc;
          position: relative;
          background: #fff;
        }

        .cn-corner {
          position: absolute;
          width: 40px;
          height: 40px;
          border: 3px solid ${accentColor};
        }
        .cn-tl { top: 10px; left: 10px; border-right: none; border-bottom: none; }
        .cn-tr { top: 10px; right: 10px; border-left: none; border-bottom: none; }
        .cn-bl { bottom: 80px; left: 10px; border-right: none; border-top: none; }
        .cn-br { bottom: 80px; right: 10px; border-left: none; border-top: none; }

        .cn-header {
          display: flex;
          justify-content: space-between;
          border-bottom: 2px solid ${accentColor};
          padding-bottom: 15px;
        }

        .cn-company {
          font-size: 12px;
          line-height: 1.6;
        }

        .cn-company span {
          font-weight: 700;
          font-size: 16px;
          color: ${accentColor};
          display: block;
          margin-bottom: 5px;
        }

        .cn-company-logo {
          max-width: 80px;
          max-height: 50px;
          object-fit: contain;
          margin-bottom: 8px;
        }

        .cn-box {
          text-align: right;
        }

        .cn-box h1 {
          font-size: 32px;
          color: ${accentColor};
          margin: 0;
        }

        .cn-badge {
          display: inline-block;
          background: linear-gradient(90deg, ${accentColor}, ${gradientEnd});
          color: #fff;
          padding: 6px 15px;
          border-radius: 30px;
          font-size: 12px;
          margin: 5px 0;
        }

        .cn-badge-type {
          display: inline-block;
          background: linear-gradient(90deg, #1565c0, #42a5f5);
          color: #fff;
          padding: 6px 15px;
          border-radius: 30px;
          font-size: 11px;
          margin: 5px 5px 5px 0;
        }

        .cn-info {
          display: flex;
          justify-content: space-between;
          margin: 25px 0;
          gap: 20px;
        }

        .cn-card {
          width: 48%;
          border: 1px solid ${accentColor};
          padding: 12px;
          position: relative;
        }

        .cn-card::before {
          content: attr(data-label);
          position: absolute;
          top: -8px;
          left: 10px;
          background: #fff;
          padding: 0 6px;
          font-size: 11px;
          color: ${accentColor};
          font-weight: 600;
        }

        .cn-card p {
          font-size: 12px;
          margin: 4px 0;
          line-height: 1.4;
        }

        .cn-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
        }

        .cn-table th {
          background: linear-gradient(90deg, ${accentColor}, ${gradientEnd});
          color: #fff;
          padding: 10px;
          font-size: 11px;
          text-align: left;
        }

        .cn-table th:last-child {
          text-align: right;
        }

        .cn-table td {
          border: 1px solid #b0bec5;
          padding: 8px;
          font-size: 11px;
        }

        .cn-table td:last-child {
          text-align: right;
        }

        .cn-table tbody tr:nth-child(even) {
          background: #fff5f5;
        }

        .cn-totals {
          display: flex;
          justify-content: flex-end;
          margin-top: 20px;
        }

        .cn-total-box {
          width: 300px;
          border: 2px solid ${accentColor};
          padding: 12px;
        }

        .cn-total-box p {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          margin: 5px 0;
        }

        .cn-grand {
          font-size: 15px;
          font-weight: 700;
          color: ${accentColor};
          border-top: 2px solid ${accentColor};
          padding-top: 5px;
          margin-top: 8px;
        }

        .cn-credit-section {
          margin-top: 20px;
          padding: 12px;
          border: 2px dashed ${accentColor};
          background: #fff5f5;
        }

        .cn-credit-section h3 {
          font-size: 13px;
          color: ${accentColor};
          margin-bottom: 10px;
        }

        .cn-credit-grid {
          display: flex;
          justify-content: space-between;
          gap: 20px;
        }

        .cn-credit-item {
          text-align: center;
        }

        .cn-credit-item span {
          display: block;
          font-size: 10px;
          color: #666;
          margin-bottom: 4px;
        }

        .cn-credit-item strong {
          font-size: 14px;
          color: #333;
        }

        .cn-credit-item.available strong {
          color: #2e7d32;
        }

        .cn-credit-item.blocked strong {
          color: #ef6c00;
        }

        .cn-footer {
          position: absolute;
          bottom: 20px;
          left: 30px;
          right: 30px;
          border-top: 2px solid ${accentColor};
          padding-top: 10px;
          font-size: 11px;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
        }

        .cn-footer-bank {
          line-height: 1.5;
        }

        .cn-footer-signature {
          text-align: center;
        }

        .cn-footer-signature-line {
          width: 150px;
          border-bottom: 1px solid #333;
          margin-bottom: 5px;
          height: 40px;
        }

        @media print {
          body { padding: 0; margin: 0; }
          .credit-note-pdf-page { border: none; }
        }
      `}</style>

      <div className="credit-note-pdf-page">
        {/* Decorative Corners */}
        <div className="cn-corner cn-tl"></div>
        <div className="cn-corner cn-tr"></div>
        <div className="cn-corner cn-bl"></div>
        <div className="cn-corner cn-br"></div>

        {/* Header */}
        <div className="cn-header">
          <div className="cn-company">
            {organization.logo_url && (
              <img 
                src={organization.logo_url} 
                alt="Logo" 
                className="cn-company-logo"
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

          <div className="cn-box">
            <h1>AVOIR</h1>
            <div style={{ fontSize: '14px', fontWeight: 700, margin: '5px 0' }}>
              {creditNote.credit_note_number}
            </div>
            <div style={{ fontSize: '12px', margin: '5px 0' }}>
              Date : {format(new Date(creditNote.credit_note_date), 'dd/MM/yyyy', { locale: fr })}
            </div>
            <span className="cn-badge-type">{getTypeLabel()}</span>
            <span className="cn-badge">{getStatusLabel()}</span>
          </div>
        </div>

        {/* Client & Invoice Info */}
        <div className="cn-info">
          <div className="cn-card" data-label="CLIENT">
            <p style={{ fontWeight: 700, fontSize: '14px' }}>{getClientName()}</p>
            {getClientAddress() && <p>{getClientAddress()}</p>}
            {client && (
              <p>{client.identifier_type} : {client.identifier_value}</p>
            )}
          </div>

          <div className="cn-card" data-label="FACTURE D'ORIGINE">
            {invoice ? (
              <>
                <p><strong>N° :</strong> {invoice.invoice_number}</p>
                <p><strong>Date :</strong> {format(new Date(invoice.invoice_date), 'dd/MM/yyyy', { locale: fr })}</p>
              </>
            ) : (
              <p>-</p>
            )}
            {creditNote.reason && (
              <p style={{ marginTop: '8px' }}><strong>Motif :</strong> {creditNote.reason}</p>
            )}
          </div>
        </div>

        {/* Products Table */}
        <table className="cn-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Réf</th>
              <th>Qté</th>
              <th>P.U HT</th>
              <th>TVA</th>
              {creditNote.credit_note_type === 'product_return' && <th>Motif</th>}
              <th>Total HT</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.id}>
                <td>
                  {line.product?.name || line.description || '-'}
                </td>
                <td>{line.product?.reference || '-'}</td>
                <td style={{ textAlign: 'center' }}>{line.quantity}</td>
                <td style={{ textAlign: 'right' }}>{formatCurrency(line.unit_price_ht, creditNote.currency)}</td>
                <td style={{ textAlign: 'center' }}>{line.vat_rate}%</td>
                {creditNote.credit_note_type === 'product_return' && (
                  <td style={{ fontSize: '10px' }}>{getReturnReasonLabel(line.return_reason)}</td>
                )}
                <td>{formatCurrency(line.line_total_ht, creditNote.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="cn-totals">
          <div className="cn-total-box">
            <p>
              <span>Total HT</span>
              <span>{formatCurrency(creditNote.subtotal_ht, creditNote.currency)}</span>
            </p>
            <p>
              <span>TVA</span>
              <span>{formatCurrency(creditNote.total_vat, creditNote.currency)}</span>
            </p>
            <p>
              <span>Total TTC</span>
              <span>{formatCurrency(creditNote.total_ttc, creditNote.currency)}</span>
            </p>
            {creditNote.stamp_duty_amount > 0 && (
              <p>
                <span>TIMBRE FISCAL</span>
                <span>{formatCurrency(creditNote.stamp_duty_amount, 'TND')}</span>
              </p>
            )}
            <p className="cn-grand">
              <span>MONTANT AVOIR</span>
              <span>{formatCurrency(creditNote.net_amount, creditNote.currency)}</span>
            </p>
          </div>
        </div>

        {/* Credit Status Section */}
        {creditNote.credit_generated > 0 && (
          <div className="cn-credit-section">
            <h3>STATUT DU CRÉDIT CLIENT</h3>
            <div className="cn-credit-grid">
              <div className="cn-credit-item">
                <span>Crédit Généré</span>
                <strong>{formatCurrency(creditNote.credit_generated, creditNote.currency)}</strong>
              </div>
              <div className="cn-credit-item available">
                <span>Crédit Disponible</span>
                <strong>{formatCurrency(creditNote.credit_available, creditNote.currency)}</strong>
              </div>
              <div className="cn-credit-item">
                <span>Crédit Utilisé</span>
                <strong>{formatCurrency(creditNote.credit_used, creditNote.currency)}</strong>
              </div>
              {creditNote.credit_blocked > 0 && (
                <div className="cn-credit-item blocked">
                  <span>Crédit Bloqué</span>
                  <strong>{formatCurrency(creditNote.credit_blocked, creditNote.currency)}</strong>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="cn-footer">
          <div className="cn-footer-bank">
            {banks.length > 0 && (
              <>
                <div><strong>IBAN :</strong> {banks[0].iban}</div>
                {banks[0].bank_name && <div><strong>Banque :</strong> {banks[0].bank_name}</div>}
              </>
            )}
          </div>
          <div className="cn-footer-signature">
            <div className="cn-footer-signature-line"></div>
            <div>Signature autorisée</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreditNotePdfTemplate;
