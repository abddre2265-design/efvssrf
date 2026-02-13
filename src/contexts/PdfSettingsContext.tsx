import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type DocumentType = 'invoice' | 'delivery-note';

export interface PdfComponent {
  id: string;
  labelKey: string;
  enabled: boolean;
  category: 'header' | 'content' | 'footer';
}

// Default components for Invoice PDF
const defaultInvoiceComponents: PdfComponent[] = [
  // Header
  { id: 'logo', labelKey: 'pdf_component_logo', enabled: true, category: 'header' },
  { id: 'company_info', labelKey: 'pdf_component_company_info', enabled: true, category: 'header' },
  { id: 'company_name', labelKey: 'pdf_component_company_name', enabled: true, category: 'header' },
  { id: 'company_address', labelKey: 'pdf_component_company_address', enabled: true, category: 'header' },
  { id: 'company_phone', labelKey: 'pdf_component_company_phone', enabled: true, category: 'header' },
  { id: 'company_email', labelKey: 'pdf_component_company_email', enabled: true, category: 'header' },
  { id: 'company_identifier', labelKey: 'pdf_component_company_identifier', enabled: true, category: 'header' },
  { id: 'invoice_title', labelKey: 'pdf_component_invoice_title', enabled: true, category: 'header' },
  { id: 'invoice_number', labelKey: 'pdf_component_invoice_number', enabled: true, category: 'header' },
  { id: 'invoice_date', labelKey: 'pdf_component_invoice_date', enabled: true, category: 'header' },
  { id: 'due_date', labelKey: 'pdf_component_due_date', enabled: true, category: 'header' },
  { id: 'status_badge', labelKey: 'pdf_component_status_badge', enabled: true, category: 'header' },
  // Content
  { id: 'client_info', labelKey: 'pdf_component_client_info', enabled: true, category: 'content' },
  { id: 'client_name', labelKey: 'pdf_component_client_name', enabled: true, category: 'content' },
  { id: 'client_address', labelKey: 'pdf_component_client_address', enabled: true, category: 'content' },
  { id: 'client_identifier', labelKey: 'pdf_component_client_identifier', enabled: true, category: 'content' },
  { id: 'client_phone', labelKey: 'pdf_component_client_phone', enabled: false, category: 'content' },
  { id: 'client_email', labelKey: 'pdf_component_client_email', enabled: false, category: 'content' },
  { id: 'payment_status', labelKey: 'pdf_component_payment_status', enabled: true, category: 'content' },
  { id: 'products_table', labelKey: 'pdf_component_products_table', enabled: true, category: 'content' },
  { id: 'product_reference', labelKey: 'pdf_component_product_reference', enabled: true, category: 'content' },
  { id: 'product_description', labelKey: 'pdf_component_product_description', enabled: true, category: 'content' },
  { id: 'vat_column', labelKey: 'pdf_component_vat_column', enabled: true, category: 'content' },
  { id: 'discount_column', labelKey: 'pdf_component_discount_column', enabled: true, category: 'content' },
  { id: 'totals_box', labelKey: 'pdf_component_totals_box', enabled: true, category: 'content' },
  { id: 'vat_breakdown', labelKey: 'pdf_component_vat_breakdown', enabled: true, category: 'content' },
  { id: 'custom_taxes', labelKey: 'pdf_component_custom_taxes', enabled: true, category: 'content' },
  { id: 'stamp_duty', labelKey: 'pdf_component_stamp_duty', enabled: true, category: 'content' },
  { id: 'withholding_tax', labelKey: 'pdf_component_withholding_tax', enabled: true, category: 'content' },
  // Footer
  { id: 'decorative_corners', labelKey: 'pdf_component_decorative_corners', enabled: true, category: 'footer' },
  { id: 'bank_info', labelKey: 'pdf_component_bank_info', enabled: true, category: 'footer' },
  { id: 'signature_area', labelKey: 'pdf_component_signature_area', enabled: true, category: 'footer' },
  { id: 'legal_mentions', labelKey: 'pdf_component_legal_mentions', enabled: false, category: 'footer' },
  { id: 'qr_code', labelKey: 'pdf_component_qr_code', enabled: false, category: 'footer' },
  { id: 'stamp', labelKey: 'pdf_component_stamp', enabled: false, category: 'footer' },
];

// Default components for Delivery Note PDF (similar to invoice but without stamp duty / net payable)
const defaultDeliveryNoteComponents: PdfComponent[] = [
  // Header
  { id: 'logo', labelKey: 'pdf_component_logo', enabled: true, category: 'header' },
  { id: 'company_info', labelKey: 'pdf_component_company_info', enabled: true, category: 'header' },
  { id: 'company_name', labelKey: 'pdf_component_company_name', enabled: true, category: 'header' },
  { id: 'company_address', labelKey: 'pdf_component_company_address', enabled: true, category: 'header' },
  { id: 'company_phone', labelKey: 'pdf_component_company_phone', enabled: true, category: 'header' },
  { id: 'company_email', labelKey: 'pdf_component_company_email', enabled: true, category: 'header' },
  { id: 'company_identifier', labelKey: 'pdf_component_company_identifier', enabled: true, category: 'header' },
  { id: 'delivery_note_title', labelKey: 'pdf_component_delivery_note_title', enabled: true, category: 'header' },
  { id: 'delivery_note_number', labelKey: 'pdf_component_delivery_note_number', enabled: true, category: 'header' },
  { id: 'delivery_note_date', labelKey: 'pdf_component_delivery_note_date', enabled: true, category: 'header' },
  // Content
  { id: 'client_info', labelKey: 'pdf_component_client_info', enabled: true, category: 'content' },
  { id: 'client_name', labelKey: 'pdf_component_client_name', enabled: true, category: 'content' },
  { id: 'client_address', labelKey: 'pdf_component_client_address', enabled: true, category: 'content' },
  { id: 'client_identifier', labelKey: 'pdf_component_client_identifier', enabled: true, category: 'content' },
  { id: 'client_phone', labelKey: 'pdf_component_client_phone', enabled: false, category: 'content' },
  { id: 'client_email', labelKey: 'pdf_component_client_email', enabled: false, category: 'content' },
  { id: 'invoice_reference', labelKey: 'pdf_component_invoice_reference', enabled: true, category: 'content' },
  { id: 'products_table', labelKey: 'pdf_component_products_table', enabled: true, category: 'content' },
  { id: 'product_reference', labelKey: 'pdf_component_product_reference', enabled: true, category: 'content' },
  { id: 'product_description', labelKey: 'pdf_component_product_description', enabled: true, category: 'content' },
  { id: 'vat_column', labelKey: 'pdf_component_vat_column', enabled: true, category: 'content' },
  { id: 'discount_column', labelKey: 'pdf_component_discount_column', enabled: true, category: 'content' },
  { id: 'totals_box', labelKey: 'pdf_component_totals_box', enabled: true, category: 'content' },
  { id: 'vat_breakdown', labelKey: 'pdf_component_vat_breakdown', enabled: true, category: 'content' },
  // Footer
  { id: 'decorative_corners', labelKey: 'pdf_component_decorative_corners', enabled: true, category: 'footer' },
  { id: 'signature_area', labelKey: 'pdf_component_signature_area', enabled: true, category: 'footer' },
  { id: 'legal_mentions', labelKey: 'pdf_component_legal_mentions', enabled: false, category: 'footer' },
];

interface PdfSettingsContextType {
  invoiceComponents: PdfComponent[];
  deliveryNoteComponents: PdfComponent[];
  setInvoiceComponents: React.Dispatch<React.SetStateAction<PdfComponent[]>>;
  setDeliveryNoteComponents: React.Dispatch<React.SetStateAction<PdfComponent[]>>;
  isComponentEnabled: (documentType: DocumentType, componentId: string) => boolean;
  toggleComponent: (documentType: DocumentType, componentId: string, enabled: boolean) => void;
  resetToDefault: (documentType: DocumentType) => void;
  getDefaultComponents: (documentType: DocumentType) => PdfComponent[];
}

const PdfSettingsContext = createContext<PdfSettingsContextType | undefined>(undefined);

const STORAGE_KEY_INVOICE = 'pdf_settings_invoice';
const STORAGE_KEY_DELIVERY_NOTE = 'pdf_settings_delivery_note';

export const PdfSettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [invoiceComponents, setInvoiceComponents] = useState<PdfComponent[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY_INVOICE);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return defaultInvoiceComponents;
      }
    }
    return defaultInvoiceComponents;
  });

  const [deliveryNoteComponents, setDeliveryNoteComponents] = useState<PdfComponent[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY_DELIVERY_NOTE);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return defaultDeliveryNoteComponents;
      }
    }
    return defaultDeliveryNoteComponents;
  });

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_INVOICE, JSON.stringify(invoiceComponents));
  }, [invoiceComponents]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_DELIVERY_NOTE, JSON.stringify(deliveryNoteComponents));
  }, [deliveryNoteComponents]);

  const isComponentEnabled = (documentType: DocumentType, componentId: string): boolean => {
    const components = documentType === 'invoice' 
      ? invoiceComponents 
      : deliveryNoteComponents;
    return components.find(c => c.id === componentId)?.enabled ?? false;
  };

  const toggleComponent = (documentType: DocumentType, componentId: string, enabled: boolean) => {
    const setComponents = documentType === 'invoice' 
      ? setInvoiceComponents 
      : setDeliveryNoteComponents;
    setComponents(prev => prev.map(comp => comp.id === componentId ? { ...comp, enabled } : comp));
  };

  const resetToDefault = (documentType: DocumentType) => {
    if (documentType === 'invoice') {
      setInvoiceComponents(defaultInvoiceComponents);
    } else {
      setDeliveryNoteComponents(defaultDeliveryNoteComponents);
    }
  };

  const getDefaultComponents = (documentType: DocumentType): PdfComponent[] => {
    return documentType === 'invoice' 
      ? defaultInvoiceComponents 
      : defaultDeliveryNoteComponents;
  };

  return (
    <PdfSettingsContext.Provider value={{
      invoiceComponents,
      deliveryNoteComponents,
      setInvoiceComponents,
      setDeliveryNoteComponents,
      isComponentEnabled,
      toggleComponent,
      resetToDefault,
      getDefaultComponents,
    }}>
      {children}
    </PdfSettingsContext.Provider>
  );
};

export const usePdfSettings = (): PdfSettingsContextType => {
  const context = useContext(PdfSettingsContext);
  if (!context) {
    throw new Error('usePdfSettings must be used within a PdfSettingsProvider');
  }
  return context;
};

export { defaultInvoiceComponents, defaultDeliveryNoteComponents };
