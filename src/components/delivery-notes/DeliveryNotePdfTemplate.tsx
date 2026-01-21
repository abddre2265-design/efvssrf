import React, { useMemo } from 'react';
import { format } from 'date-fns';
import { fr, enUS, arSA } from 'date-fns/locale';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePdfSettings } from '@/contexts/PdfSettingsContext';
import { governorates } from '@/contexts/LanguageContext';

interface DeliveryNotePdfTemplateProps {
  deliveryNote: any;
  organization: any;
}

export const DeliveryNotePdfTemplate: React.FC<DeliveryNotePdfTemplateProps> = ({
  deliveryNote,
  organization,
}) => {
  const { t, language, isRTL } = useLanguage();
  const { isComponentEnabled } = usePdfSettings();
  
  // Helper to check if delivery note component is enabled (uses invoice settings as base)
  const isEnabled = (componentId: string): boolean => {
    return isComponentEnabled('delivery-note', componentId);
  };

  const getDateLocale = () => {
    switch (language) {
      case 'ar': return arSA;
      case 'en': return enUS;
      default: return fr;
    }
  };

  const getGovernorateName = (value: string | null) => {
    if (!value) return '';
    const gov = governorates.find(g => g.value === value);
    return gov ? gov[language] : value;
  };

  const getClientName = (): string => {
    const client = deliveryNote.client;
    if (!client) return '-';
    if (client.client_type === 'business_local' || client.client_type === 'foreign') {
      return client.company_name || '-';
    }
    return `${client.first_name || ''} ${client.last_name || ''}`.trim() || '-';
  };

  const formatCurrency = (amount: number): string => {
    return `${amount.toFixed(3)} ${deliveryNote.currency || 'TND'}`;
  };

  // VAT breakdown calculation
  const vatBreakdown = useMemo(() => {
    const breakdown: Record<number, { baseHt: number; vatAmount: number }> = {};
    
    deliveryNote.lines?.forEach((line: any) => {
      const rate = line.vat_rate || 0;
      if (!breakdown[rate]) {
        breakdown[rate] = { baseHt: 0, vatAmount: 0 };
      }
      breakdown[rate].baseHt += line.line_total_ht || 0;
      breakdown[rate].vatAmount += line.line_vat || 0;
    });

    return Object.entries(breakdown)
      .map(([rate, data]) => ({ rate: Number(rate), ...data }))
      .sort((a, b) => a.rate - b.rate);
  }, [deliveryNote.lines]);

  const styles = `
    .delivery-note-pdf {
      width: 210mm;
      min-height: 297mm;
      padding: 15mm;
      font-family: Arial, sans-serif;
      font-size: 10pt;
      color: #1a1a1a;
      background: white;
      direction: ${isRTL ? 'rtl' : 'ltr'};
    }
    .dn-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 2px solid #3b82f6;
    }
    .dn-logo-section {
      display: flex;
      align-items: center;
      gap: 15px;
    }
    .dn-logo {
      max-width: 80px;
      max-height: 80px;
      object-fit: contain;
    }
    .dn-company-info {
      font-size: 9pt;
      color: #666;
    }
    .dn-company-name {
      font-size: 14pt;
      font-weight: bold;
      color: #1a1a1a;
      margin-bottom: 5px;
    }
    .dn-title-section {
      text-align: ${isRTL ? 'left' : 'right'};
    }
    .dn-title {
      font-size: 20pt;
      font-weight: bold;
      color: #3b82f6;
      margin-bottom: 10px;
    }
    .dn-number {
      font-size: 12pt;
      font-weight: bold;
      background: #eff6ff;
      padding: 5px 15px;
      border-radius: 4px;
      display: inline-block;
      margin-bottom: 5px;
    }
    .dn-date {
      font-size: 9pt;
      color: #666;
    }
    .dn-client-section {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 20px;
    }
    .dn-section-title {
      font-size: 10pt;
      font-weight: bold;
      color: #3b82f6;
      margin-bottom: 10px;
      text-transform: uppercase;
    }
    .dn-client-name {
      font-size: 12pt;
      font-weight: bold;
      margin-bottom: 5px;
    }
    .dn-client-details {
      font-size: 9pt;
      color: #666;
    }
    .dn-invoice-ref {
      background: #fef3c7;
      border: 1px solid #f59e0b;
      border-radius: 4px;
      padding: 10px 15px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .dn-invoice-ref-label {
      font-size: 9pt;
      color: #92400e;
    }
    .dn-invoice-ref-number {
      font-size: 11pt;
      font-weight: bold;
      color: #92400e;
    }
    .dn-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    .dn-table th {
      background: #3b82f6;
      color: white;
      padding: 10px 8px;
      text-align: ${isRTL ? 'right' : 'left'};
      font-size: 9pt;
      font-weight: bold;
    }
    .dn-table th:last-child,
    .dn-table td:last-child {
      text-align: ${isRTL ? 'left' : 'right'};
    }
    .dn-table td {
      padding: 10px 8px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 9pt;
    }
    .dn-table tr:nth-child(even) {
      background: #f8fafc;
    }
    .dn-totals {
      display: flex;
      justify-content: space-between;
      gap: 20px;
      margin-top: 20px;
    }
    .dn-vat-breakdown {
      flex: 1;
    }
    .dn-vat-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9pt;
    }
    .dn-vat-table th,
    .dn-vat-table td {
      padding: 5px 8px;
      border: 1px solid #e2e8f0;
    }
    .dn-vat-table th {
      background: #f1f5f9;
      font-weight: bold;
    }
    .dn-totals-box {
      min-width: 250px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 15px;
    }
    .dn-total-row {
      display: flex;
      justify-content: space-between;
      padding: 5px 0;
      font-size: 9pt;
    }
    .dn-total-row.final {
      border-top: 2px solid #3b82f6;
      margin-top: 10px;
      padding-top: 10px;
      font-size: 12pt;
      font-weight: bold;
      color: #3b82f6;
    }
    .dn-footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
    }
    .dn-signatures {
      display: flex;
      justify-content: space-between;
      margin-top: 60px;
    }
    .dn-signature-box {
      text-align: center;
      min-width: 150px;
    }
    .dn-signature-line {
      border-top: 1px solid #1a1a1a;
      margin-top: 60px;
      padding-top: 10px;
      font-size: 9pt;
    }
    @media print {
      .delivery-note-pdf {
        width: 100%;
        padding: 10mm;
      }
    }
  `;

  return (
    <>
      <style>{styles}</style>
      <div className="delivery-note-pdf">
        {/* Header */}
        <div className="dn-header">
          <div className="dn-logo-section">
            {organization.logo_url && isEnabled('logo') && (
              <img src={organization.logo_url} alt="Logo" className="dn-logo" />
            )}
            {isEnabled('company_info') && (
              <div className="dn-company-info">
                {isEnabled('company_name') && (
                  <div className="dn-company-name">{organization.name}</div>
                )}
                {isEnabled('company_address') && organization.address && (
                  <div>{organization.address}</div>
                )}
                {isEnabled('company_address') && (
                  <div>
                    {organization.postal_code} {getGovernorateName(organization.governorate)}
                  </div>
                )}
                {isEnabled('company_phone') && organization.phone && (
                  <div>{t('phone')}: {organization.phone}</div>
                )}
                {isEnabled('company_email') && organization.email && (
                  <div>{t('email')}: {organization.email}</div>
                )}
                {isEnabled('company_identifier') && organization.identifier && (
                  <div>{t('taxId')}: {organization.identifier}</div>
                )}
              </div>
            )}
          </div>
          <div className="dn-title-section">
            <div className="dn-title">{t('delivery_note_title')}</div>
            <div className="dn-number">{deliveryNote.delivery_note_number}</div>
            <div className="dn-date">
              {t('date')}: {format(new Date(deliveryNote.delivery_date), 'PPP', { locale: getDateLocale() })}
            </div>
          </div>
        </div>

        {/* Invoice Reference */}
        <div className="dn-invoice-ref">
          <span className="dn-invoice-ref-label">{t('linked_invoice')}:</span>
          <span className="dn-invoice-ref-number">{deliveryNote.invoice?.invoice_number}</span>
        </div>

        {/* Client Section */}
        {isEnabled('client_info') && deliveryNote.client && (
          <div className="dn-client-section">
            <div className="dn-section-title">{t('client')}</div>
            {isEnabled('client_name') && (
              <div className="dn-client-name">{getClientName()}</div>
            )}
            <div className="dn-client-details">
              {isEnabled('client_address') && deliveryNote.client.address && (
                <div>{deliveryNote.client.address}</div>
              )}
              {isEnabled('client_address') && (
                <div>
                  {deliveryNote.client.postal_code} {getGovernorateName(deliveryNote.client.governorate)}
                </div>
              )}
              {isEnabled('client_identifier') && deliveryNote.client.identifier_value && (
                <div>{t('taxId')}: {deliveryNote.client.identifier_value}</div>
              )}
              {isEnabled('client_phone') && deliveryNote.client.phone && (
                <div>{t('phone')}: {deliveryNote.client.phone}</div>
              )}
              {isEnabled('client_email') && deliveryNote.client.email && (
                <div>{t('email')}: {deliveryNote.client.email}</div>
              )}
            </div>
          </div>
        )}

        {/* Products Table */}
        {isEnabled('products_table') && (
          <table className="dn-table">
            <thead>
              <tr>
                {isEnabled('product_reference') && <th>{t('reference')}</th>}
                <th>{t('product')}</th>
                <th style={{ textAlign: 'center' }}>{t('quantity')}</th>
                <th style={{ textAlign: isRTL ? 'left' : 'right' }}>{t('unit_price_ht')}</th>
                {isEnabled('vat_column') && <th style={{ textAlign: 'center' }}>{t('vat')}</th>}
                {isEnabled('discount_column') && <th style={{ textAlign: 'center' }}>{t('discount')}</th>}
                <th style={{ textAlign: isRTL ? 'left' : 'right' }}>{t('total_ht')}</th>
              </tr>
            </thead>
            <tbody>
              {deliveryNote.lines?.map((line: any, index: number) => (
                <tr key={line.id || index}>
                  {isEnabled('product_reference') && (
                    <td>{line.product?.reference || '-'}</td>
                  )}
                  <td>
                    {line.product?.name || line.description || '-'}
                    {isEnabled('product_description') && line.description && line.product?.name && (
                      <div style={{ fontSize: '8pt', color: '#666' }}>{line.description}</div>
                    )}
                  </td>
                  <td style={{ textAlign: 'center' }}>{line.quantity}</td>
                  <td style={{ textAlign: isRTL ? 'left' : 'right' }}>{formatCurrency(line.unit_price_ht)}</td>
                  {isEnabled('vat_column') && (
                    <td style={{ textAlign: 'center' }}>{line.vat_rate}%</td>
                  )}
                  {isEnabled('discount_column') && (
                    <td style={{ textAlign: 'center' }}>{line.discount_percent > 0 ? `${line.discount_percent}%` : '-'}</td>
                  )}
                  <td style={{ textAlign: isRTL ? 'left' : 'right' }}>{formatCurrency(line.line_total_ht)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Totals - NO stamp duty, NO net payable */}
        {isEnabled('totals_box') && (
          <div className="dn-totals">
            {/* VAT Breakdown */}
            {isEnabled('vat_breakdown') && vatBreakdown.length > 0 && (
              <div className="dn-vat-breakdown">
                <div className="dn-section-title">{t('vat_breakdown')}</div>
                <table className="dn-vat-table">
                  <thead>
                    <tr>
                      <th>{t('rate')}</th>
                      <th>{t('base_ht')}</th>
                      <th>{t('vat')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vatBreakdown.map((item) => (
                      <tr key={item.rate}>
                        <td>{item.rate}%</td>
                        <td>{formatCurrency(item.baseHt)}</td>
                        <td>{formatCurrency(item.vatAmount)}</td>
                      </tr>
                    ))}
                    <tr style={{ fontWeight: 'bold', background: '#e2e8f0' }}>
                      <td>{t('total')}</td>
                      <td>{formatCurrency(deliveryNote.subtotal_ht)}</td>
                      <td>{formatCurrency(deliveryNote.total_vat)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Totals Box - Only TTC */}
            <div className="dn-totals-box">
              <div className="dn-total-row">
                <span>{t('subtotal_ht')}</span>
                <span>{formatCurrency(deliveryNote.subtotal_ht)}</span>
              </div>
              <div className="dn-total-row">
                <span>{t('total_vat')}</span>
                <span>{formatCurrency(deliveryNote.total_vat)}</span>
              </div>
              {deliveryNote.total_discount > 0 && (
                <div className="dn-total-row" style={{ color: '#dc2626' }}>
                  <span>{t('total_discount')}</span>
                  <span>-{formatCurrency(deliveryNote.total_discount)}</span>
                </div>
              )}
              <div className="dn-total-row final">
                <span>{t('total_ttc')}</span>
                <span>{formatCurrency(deliveryNote.total_ttc)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Footer with signatures */}
        {isEnabled('signature_area') && (
          <div className="dn-footer">
            <div className="dn-signatures">
              <div className="dn-signature-box">
                <div className="dn-signature-line">{t('company_signature')}</div>
              </div>
              <div className="dn-signature-box">
                <div className="dn-signature-line">{t('client_signature')}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default DeliveryNotePdfTemplate;
