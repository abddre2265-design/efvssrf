import React from 'react';
import { motion } from 'framer-motion';
import { FileText, FileX2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DocumentType, PdfComponent } from '@/pages/PdfSettings';

interface PdfTemplatePreviewProps {
  documentType: DocumentType;
  components: PdfComponent[];
}

export const PdfTemplatePreview: React.FC<PdfTemplatePreviewProps> = ({
  documentType,
  components,
}) => {
  const { t } = useLanguage();

  const isEnabled = (id: string) => components.find(c => c.id === id)?.enabled ?? false;

  const accentColor = documentType === 'invoice' ? '#0a84ff' : '#e53935';
  const gradientEnd = documentType === 'invoice' ? '#00c6ff' : '#ff6f60';
  const title = documentType === 'invoice' ? 'FACTURE' : 'AVOIR';

  return (
    <ScrollArea className="h-[600px] rounded-lg border bg-white">
      <div className="p-4">
        <div 
          className="relative bg-white shadow-lg mx-auto"
          style={{ 
            width: '100%', 
            maxWidth: '420px',
            minHeight: '594px',
            fontFamily: "'Orbitron', sans-serif",
            fontSize: '8px',
            padding: '20px',
            border: '1px solid #cfd8dc',
          }}
        >
          {/* Decorative corners */}
          {isEnabled('decorative_corners') && (
            <>
              <div style={{ position: 'absolute', top: 8, left: 8, width: 20, height: 20, border: `2px solid ${accentColor}`, borderRight: 'none', borderBottom: 'none' }} />
              <div style={{ position: 'absolute', top: 8, right: 8, width: 20, height: 20, border: `2px solid ${accentColor}`, borderLeft: 'none', borderBottom: 'none' }} />
              <div style={{ position: 'absolute', bottom: 60, left: 8, width: 20, height: 20, border: `2px solid ${accentColor}`, borderRight: 'none', borderTop: 'none' }} />
              <div style={{ position: 'absolute', bottom: 60, right: 8, width: 20, height: 20, border: `2px solid ${accentColor}`, borderLeft: 'none', borderTop: 'none' }} />
            </>
          )}

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `2px solid ${accentColor}`, paddingBottom: 10, marginBottom: 15 }}>
            <div style={{ lineHeight: 1.5 }}>
              {isEnabled('logo') && (
                <div style={{ width: 40, height: 25, background: '#e0e0e0', borderRadius: 4, marginBottom: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 6 }}>
                  LOGO
                </div>
              )}
              {isEnabled('company_info') && (
                <>
                  <div style={{ fontWeight: 700, fontSize: 10, color: accentColor, marginBottom: 3 }}>Nom Société</div>
                  <div>123 Rue Example</div>
                  <div>1000, Tunis</div>
                  <div>Tel : +216 XX XXX XXX</div>
                  <div>MF : 1234567/A/M/000</div>
                </>
              )}
            </div>

            <div style={{ textAlign: 'right' }}>
              {(isEnabled('invoice_title') || isEnabled('credit_note_title')) && (
                <div style={{ fontSize: 18, fontWeight: 700, color: accentColor, marginBottom: 3 }}>{title}</div>
              )}
              {(isEnabled('invoice_number') || isEnabled('credit_note_number')) && (
                <div style={{ fontSize: 9, fontWeight: 700, marginBottom: 3 }}>
                  {documentType === 'invoice' ? 'FAC-2025-00001' : 'AV-2025-00001'}
                </div>
              )}
              {(isEnabled('invoice_date') || isEnabled('credit_note_date')) && (
                <div style={{ marginBottom: 3 }}>Date : 21/01/2025</div>
              )}
              {isEnabled('due_date') && documentType === 'invoice' && (
                <div style={{ marginBottom: 3 }}>Échéance : 21/02/2025</div>
              )}
              {isEnabled('credit_note_type') && documentType === 'credit-note' && (
                <span style={{ 
                  display: 'inline-block',
                  background: 'linear-gradient(90deg, #1565c0, #42a5f5)',
                  color: '#fff',
                  padding: '3px 8px',
                  borderRadius: 15,
                  fontSize: 7,
                  marginRight: 3
                }}>
                  AVOIR ARGENT
                </span>
              )}
              {isEnabled('status_badge') && (
                <span style={{ 
                  display: 'inline-block',
                  background: `linear-gradient(90deg, ${accentColor}, ${gradientEnd})`,
                  color: '#fff',
                  padding: '3px 8px',
                  borderRadius: 15,
                  fontSize: 7
                }}>
                  VALIDÉE
                </span>
              )}
            </div>
          </div>

          {/* Client & Payment Info */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 15 }}>
            {isEnabled('client_info') && (
              <div style={{ 
                width: '48%', 
                border: `1px solid ${accentColor}`, 
                padding: 8, 
                position: 'relative',
                fontSize: 7
              }}>
                <div style={{ 
                  position: 'absolute', 
                  top: -6, 
                  left: 6, 
                  background: '#fff', 
                  padding: '0 4px',
                  fontSize: 7,
                  color: accentColor,
                  fontWeight: 600
                }}>
                  {documentType === 'invoice' ? 'FACTURÉ À' : 'CLIENT'}
                </div>
                <div style={{ fontWeight: 700, fontSize: 9, marginBottom: 3 }}>Client Example</div>
                <div>Adresse client</div>
                <div>MF : 9876543/B/M/000</div>
              </div>
            )}

            {isEnabled('payment_status') && documentType === 'invoice' && (
              <div style={{ 
                width: '48%', 
                border: `1px solid ${accentColor}`, 
                padding: 8, 
                position: 'relative',
                fontSize: 7
              }}>
                <div style={{ 
                  position: 'absolute', 
                  top: -6, 
                  left: 6, 
                  background: '#fff', 
                  padding: '0 4px',
                  fontSize: 7,
                  color: accentColor,
                  fontWeight: 600
                }}>
                  RÈGLEMENT & STATUT
                </div>
                <div>Paiement : <strong>IMPAYÉ</strong></div>
              </div>
            )}

            {isEnabled('invoice_reference') && documentType === 'credit-note' && (
              <div style={{ 
                width: '48%', 
                border: `1px solid ${accentColor}`, 
                padding: 8, 
                position: 'relative',
                fontSize: 7
              }}>
                <div style={{ 
                  position: 'absolute', 
                  top: -6, 
                  left: 6, 
                  background: '#fff', 
                  padding: '0 4px',
                  fontSize: 7,
                  color: accentColor,
                  fontWeight: 600
                }}>
                  FACTURE ORIGINALE
                </div>
                <div style={{ fontWeight: 700 }}>FAC-2025-00001</div>
                <div>Date : 15/01/2025</div>
              </div>
            )}
          </div>

          {/* Products Table */}
          {isEnabled('products_table') && (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 15 }}>
              <thead>
                <tr>
                  <th style={{ background: `linear-gradient(90deg, ${accentColor}, ${gradientEnd})`, color: '#fff', padding: 5, fontSize: 7, textAlign: 'left' }}>Description</th>
                  {isEnabled('product_reference') && <th style={{ background: `linear-gradient(90deg, ${accentColor}, ${gradientEnd})`, color: '#fff', padding: 5, fontSize: 7, textAlign: 'left' }}>Réf</th>}
                  <th style={{ background: `linear-gradient(90deg, ${accentColor}, ${gradientEnd})`, color: '#fff', padding: 5, fontSize: 7, textAlign: 'center' }}>Qté</th>
                  <th style={{ background: `linear-gradient(90deg, ${accentColor}, ${gradientEnd})`, color: '#fff', padding: 5, fontSize: 7, textAlign: 'right' }}>P.U HT</th>
                  {isEnabled('vat_column') && <th style={{ background: `linear-gradient(90deg, ${accentColor}, ${gradientEnd})`, color: '#fff', padding: 5, fontSize: 7, textAlign: 'center' }}>TVA</th>}
                  {isEnabled('discount_column') && <th style={{ background: `linear-gradient(90deg, ${accentColor}, ${gradientEnd})`, color: '#fff', padding: 5, fontSize: 7, textAlign: 'center' }}>Rem</th>}
                  {isEnabled('return_reason') && documentType === 'credit-note' && <th style={{ background: `linear-gradient(90deg, ${accentColor}, ${gradientEnd})`, color: '#fff', padding: 5, fontSize: 7, textAlign: 'left' }}>Motif</th>}
                  <th style={{ background: `linear-gradient(90deg, ${accentColor}, ${gradientEnd})`, color: '#fff', padding: 5, fontSize: 7, textAlign: 'right' }}>Total HT</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ background: '#f4faff' }}>
                  <td style={{ border: '1px solid #b0bec5', padding: 5, fontSize: 7 }}>
                    Produit Example
                    {isEnabled('product_description') && <div style={{ fontSize: 6, fontStyle: 'italic' }}>Description</div>}
                  </td>
                  {isEnabled('product_reference') && <td style={{ border: '1px solid #b0bec5', padding: 5, fontSize: 7 }}>REF001</td>}
                  <td style={{ border: '1px solid #b0bec5', padding: 5, fontSize: 7, textAlign: 'center' }}>2</td>
                  <td style={{ border: '1px solid #b0bec5', padding: 5, fontSize: 7, textAlign: 'right' }}>100.000 DT</td>
                  {isEnabled('vat_column') && <td style={{ border: '1px solid #b0bec5', padding: 5, fontSize: 7, textAlign: 'center' }}>19%</td>}
                  {isEnabled('discount_column') && <td style={{ border: '1px solid #b0bec5', padding: 5, fontSize: 7, textAlign: 'center' }}>-</td>}
                  {isEnabled('return_reason') && documentType === 'credit-note' && <td style={{ border: '1px solid #b0bec5', padding: 5, fontSize: 7 }}>Défectueux</td>}
                  <td style={{ border: '1px solid #b0bec5', padding: 5, fontSize: 7, textAlign: 'right' }}>200.000 DT</td>
                </tr>
              </tbody>
            </table>
          )}

          {/* Totals */}
          {isEnabled('totals_box') && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 15 }}>
              <div style={{ width: 150, border: `2px solid ${accentColor}`, padding: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 7, marginBottom: 3 }}>
                  <span>Total HT</span>
                  <span>200.000 DT</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 7, marginBottom: 3 }}>
                  <span>TVA</span>
                  <span>38.000 DT</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 7, marginBottom: 3 }}>
                  <span>Total TTC</span>
                  <span>238.000 DT</span>
                </div>
                {isEnabled('stamp_duty') && documentType === 'invoice' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 7, marginBottom: 3 }}>
                    <span>Timbre</span>
                    <span>1.000 DT</span>
                  </div>
                )}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  fontSize: 9, 
                  fontWeight: 700,
                  color: accentColor,
                  borderTop: `2px solid ${accentColor}`,
                  paddingTop: 3,
                  marginTop: 3
                }}>
                  <span>Net à payer</span>
                  <span>239.000 DT</span>
                </div>
              </div>
            </div>
          )}

          {/* Credit status section */}
          {isEnabled('credit_status_section') && documentType === 'credit-note' && (
            <div style={{ 
              marginBottom: 15, 
              padding: 8, 
              border: `2px dashed ${accentColor}`,
              background: '#fff5f5'
            }}>
              <div style={{ fontSize: 8, color: accentColor, fontWeight: 600, marginBottom: 5 }}>STATUT DU CRÉDIT</div>
              <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: 7 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: '#666' }}>Total</div>
                  <div style={{ fontWeight: 700 }}>238.000 DT</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: '#666' }}>Utilisé</div>
                  <div style={{ fontWeight: 700, color: '#2e7d32' }}>0.000 DT</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: '#666' }}>Disponible</div>
                  <div style={{ fontWeight: 700, color: '#2e7d32' }}>238.000 DT</div>
                </div>
              </div>
            </div>
          )}

          {/* Legal mentions */}
          {isEnabled('legal_mentions') && (
            <div style={{ 
              marginBottom: 15, 
              padding: 8, 
              background: '#f5f5f5',
              borderRadius: 4,
              fontSize: 6,
              color: '#666'
            }}>
              <strong>Mentions légales :</strong> Lorem ipsum dolor sit amet, consectetur adipiscing elit. 
              Sed do eiusmod tempor incididunt ut labore.
            </div>
          )}

          {/* QR Code */}
          {isEnabled('qr_code') && (
            <div style={{ 
              position: 'absolute',
              bottom: 70,
              right: 20,
              width: 50,
              height: 50,
              background: '#e0e0e0',
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 6
            }}>
              QR CODE
            </div>
          )}

          {/* Stamp */}
          {isEnabled('stamp') && (
            <div style={{ 
              position: 'absolute',
              bottom: 80,
              left: 20,
              width: 60,
              height: 60,
              border: '2px solid #666',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 6,
              color: '#666',
              transform: 'rotate(-15deg)'
            }}>
              CACHET
            </div>
          )}

          {/* Footer */}
          <div style={{ 
            position: 'absolute',
            bottom: 15,
            left: 20,
            right: 20,
            borderTop: `2px solid ${accentColor}`,
            paddingTop: 8,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            fontSize: 7
          }}>
            {isEnabled('bank_info') && (
              <div style={{ lineHeight: 1.5 }}>
                <div>IBAN : TN59 XXXX XXXX XXXX XXXX XXXX</div>
                <div>Banque Example</div>
              </div>
            )}

            {isEnabled('signature_area') && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: 80, borderBottom: '1px solid #333', height: 25, marginBottom: 3 }}></div>
                <div>Signature & cachet</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
};

export default PdfTemplatePreview;
