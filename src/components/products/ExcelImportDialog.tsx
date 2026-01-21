import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileSpreadsheet, 
  Download, 
  Upload, 
  AlertCircle, 
  CheckCircle2, 
  X,
  Info,
  Loader2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useLanguage } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { VAT_RATES, UNITS } from './types';

interface ExcelImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

interface ImportRow {
  rowNumber: number;
  reference?: string;
  ean?: string;
  name: string;
  productType: 'physical' | 'service';
  vatRate: number;
  priceHt: number;
  priceTtc: number;
  unit?: string;
  purchaseYear: number;
  maxDiscount?: number;
  unlimitedStock: boolean;
  allowOutOfStockSale: boolean;
  currentStock?: number;
  isValid: boolean;
  errors: string[];
}

export const ExcelImportDialog: React.FC<ExcelImportDialogProps> = ({
  open,
  onOpenChange,
  onImported,
}) => {
  const { t, language } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedData, setParsedData] = useState<ImportRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [fileName, setFileName] = useState('');

  const downloadTemplate = () => {
    const headers = [
      'Référence / Reference / المرجع',
      'EAN / Code-barres / الباركود',
      'Nom du produit * / Product Name * / اسم المنتج *',
      'Type (physique/service) * / Type (physical/service) * / النوع *',
      'Taux TVA (0/7/13/19) * / VAT Rate * / نسبة الضريبة *',
      'Prix HT * / Price excl. tax * / السعر بدون ضريبة *',
      'Unité / Unit / الوحدة',
      'Année * / Year * / السنة *',
      'Remise max (%) / Max discount (%) / الخصم الأقصى',
      'Stock illimité (oui/non) / Unlimited stock (yes/no) / مخزون غير محدود',
      'Vente hors stock (oui/non) / Out of stock sale (yes/no) / البيع بدون مخزون',
      'Stock actuel / Current stock / المخزون الحالي'
    ];

    const examples = [
      ['REF-001', '1234567890123', 'Ordinateur portable', 'physique', 19, 1500.000, 'pièce', 2024, 10, 'non', 'non', 50],
      ['REF-002', '', 'Clavier sans fil', 'physique', 19, 45.000, 'pièce', 2024, 15, 'non', 'oui', 200],
      ['', '9876543210123', 'Souris optique', 'physique', 19, 25.000, 'pièce', 2024, 20, 'non', 'non', 0],
      ['SRV-001', '', 'Maintenance informatique', 'service', 19, 80.000, 'heure', 2024, 5, 'oui', '', ''],
      ['SRV-002', '', 'Formation Excel', 'service', 7, 150.000, 'jour', 2024, '', 'oui', '', ''],
      ['REF-003', '5555555555555', 'Câble HDMI 2m', 'physique', 19, 12.500, 'pièce', 2024, 25, 'non', 'non', 100],
      ['', '', 'Écran 27 pouces', 'physique', 19, 350.000, 'pièce', 2024, 10, 'non', 'non', 25],
      ['REF-004', '', 'Papier A4 (ramette)', 'physique', 7, 8.500, 'pack', 2024, 30, 'non', 'oui', 500],
    ];

    const instructions = [
      [''],
      ['=== INSTRUCTIONS / تعليمات ==='],
      [''],
      ['* Les champs marqués d\'une étoile (*) sont obligatoires / Fields marked with * are required / الحقول المحددة بنجمة (*) إلزامية'],
      [''],
      ['Type de produit / Product type / نوع المنتج:'],
      ['  - physique / physical / مادي : Produit avec stock'],
      ['  - service / service / خدمة : Service (stock illimité par défaut)'],
      [''],
      ['Taux TVA / VAT Rate / نسبة الضريبة: 0, 7, 13, ou 19'],
      [''],
      ['Prix HT / Price excl. tax / السعر: Le prix TTC sera calculé automatiquement'],
      [''],
      ['Unités disponibles / Available units / الوحدات المتاحة:'],
      ['  pièce/piece, kg, g, l, ml, m, cm, m2, m3, heure/hour, jour/day, semaine/week, mois/month, pack, boîte/box, palette/pallet, rouleau/roll, feuille/sheet'],
      [''],
      ['Stock illimité / Unlimited stock / مخزون غير محدود:'],
      ['  - oui/yes/نعم : Pas de gestion de stock'],
      ['  - non/no/لا : Stock géré (défaut pour produits physiques)'],
      [''],
      ['Référence : Si vide, sera générée automatiquement / If empty, will be auto-generated / إذا فارغ، سيتم إنشاؤه تلقائيًا'],
    ];

    const wb = XLSX.utils.book_new();
    
    // Data sheet
    const wsData = XLSX.utils.aoa_to_sheet([headers, ...examples]);
    wsData['!cols'] = headers.map(() => ({ wch: 30 }));
    XLSX.utils.book_append_sheet(wb, wsData, 'Produits');

    // Instructions sheet
    const wsInstructions = XLSX.utils.aoa_to_sheet(instructions);
    wsInstructions['!cols'] = [{ wch: 100 }];
    XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');

    XLSX.writeFile(wb, 'modele_import_produits.xlsx');
    toast.success(t('templateDownloaded'));
  };

  const parseExcelFile = async (file: File) => {
    setIsLoading(true);
    setFileName(file.name);

    try {
      // First, fetch existing products from database for duplicate check
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error(t('notAuthenticated'));
        setIsLoading(false);
        return;
      }

      const { data: org } = await supabase
        .from('organizations')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      let existingProducts: { name: string; reference: string | null; ean: string | null }[] = [];
      if (org) {
        const { data: products } = await supabase
          .from('products')
          .select('name, reference, ean')
          .eq('organization_id', org.id);
        existingProducts = products || [];
      }

      const existingNames = new Set(existingProducts.map(p => p.name.toLowerCase()));
      const existingRefs = new Set(existingProducts.filter(p => p.reference).map(p => p.reference!.toLowerCase()));
      const existingEans = new Set(existingProducts.filter(p => p.ean).map(p => p.ean!.toLowerCase()));

      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      if (jsonData.length < 2) {
        toast.error(t('emptyExcelFile'));
        setParsedData([]);
        return;
      }

      const rows: ImportRow[] = [];
      const currentYear = new Date().getFullYear();

      // Track duplicates within the file
      const fileNames = new Map<string, number>();
      const fileRefs = new Map<string, number>();
      const fileEans = new Map<string, number>();

      // First pass: collect all names, refs, eans from file
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.every(cell => cell === undefined || cell === '')) continue;
        
        const name = String(row[2] || '').trim().toLowerCase();
        const reference = String(row[0] || '').trim().toLowerCase();
        const ean = String(row[1] || '').trim().toLowerCase();

        if (name) {
          fileNames.set(name, (fileNames.get(name) || 0) + 1);
        }
        if (reference) {
          fileRefs.set(reference, (fileRefs.get(reference) || 0) + 1);
        }
        if (ean) {
          fileEans.set(ean, (fileEans.get(ean) || 0) + 1);
        }
      }

      // Second pass: parse and validate
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.every(cell => cell === undefined || cell === '')) continue;

        const errors: string[] = [];
        
        // Parse values
        const name = String(row[2] || '').trim();
        const nameLower = name.toLowerCase();
        const reference = String(row[0] || '').trim();
        const referenceLower = reference.toLowerCase();
        const ean = String(row[1] || '').trim();
        const eanLower = ean.toLowerCase();
        const typeRaw = String(row[3] || '').toLowerCase().trim();
        const vatRateRaw = Number(row[4]);
        const priceHtRaw = Number(row[5]);
        const unitRaw = String(row[6] || '').toLowerCase().trim();
        const yearRaw = Number(row[7]) || currentYear;
        const maxDiscountRaw = row[8] !== undefined && row[8] !== '' ? Number(row[8]) : undefined;
        const unlimitedRaw = String(row[9] || '').toLowerCase().trim();
        const outOfStockRaw = String(row[10] || '').toLowerCase().trim();
        const stockRaw = row[11] !== undefined && row[11] !== '' ? Number(row[11]) : undefined;

        // Check for duplicates in database
        if (name && existingNames.has(nameLower)) {
          errors.push(t('nameExistsInDb'));
        }
        if (reference && existingRefs.has(referenceLower)) {
          errors.push(t('referenceExistsInDb'));
        }
        if (ean && existingEans.has(eanLower)) {
          errors.push(t('eanExistsInDb'));
        }

        // Check for duplicates within the file
        if (name && (fileNames.get(nameLower) || 0) > 1) {
          errors.push(t('duplicateNameInFile'));
        }
        if (reference && (fileRefs.get(referenceLower) || 0) > 1) {
          errors.push(t('duplicateReferenceInFile'));
        }
        if (ean && (fileEans.get(eanLower) || 0) > 1) {
          errors.push(t('duplicateEanInFile'));
        }

        // Determine product type
        let productType: 'physical' | 'service' = 'physical';
        if (['service', 'خدمة'].includes(typeRaw)) {
          productType = 'service';
        } else if (!['physique', 'physical', 'مادي', 'produit'].includes(typeRaw) && typeRaw !== '') {
          errors.push(t('invalidProductType'));
        }

        // Validate name
        if (!name) {
          errors.push(t('productNameRequired'));
        }

        // Validate VAT rate
        if (!VAT_RATES.includes(vatRateRaw)) {
          errors.push(t('invalidVatRate'));
        }

        // Validate price
        if (isNaN(priceHtRaw) || priceHtRaw < 0) {
          errors.push(t('invalidPrice'));
        }

        // Map unit
        let unit: string | undefined;
        const unitMappings: Record<string, string> = {
          'pièce': 'piece', 'piece': 'piece', 'قطعة': 'piece',
          'kg': 'kg', 'kilogramme': 'kg', 'كيلوغرام': 'kg',
          'g': 'g', 'gramme': 'g', 'غرام': 'g',
          'l': 'l', 'litre': 'l', 'لتر': 'l',
          'ml': 'ml', 'millilitre': 'ml', 'مليلتر': 'ml',
          'm': 'm', 'mètre': 'm', 'متر': 'm',
          'cm': 'cm', 'centimètre': 'cm', 'سنتيمتر': 'cm',
          'm2': 'm2', 'mètre carré': 'm2', 'متر مربع': 'm2',
          'm3': 'm3', 'mètre cube': 'm3', 'متر مكعب': 'm3',
          'heure': 'hour', 'hour': 'hour', 'ساعة': 'hour',
          'jour': 'day', 'day': 'day', 'يوم': 'day',
          'semaine': 'week', 'week': 'week', 'أسبوع': 'week',
          'mois': 'month', 'month': 'month', 'شهر': 'month',
          'pack': 'pack', 'عبوة': 'pack',
          'boîte': 'box', 'box': 'box', 'صندوق': 'box',
          'palette': 'pallet', 'pallet': 'pallet', 'منصة': 'pallet',
          'rouleau': 'roll', 'roll': 'roll', 'لفة': 'roll',
          'feuille': 'sheet', 'sheet': 'sheet', 'ورقة': 'sheet',
        };
        if (unitRaw && unitMappings[unitRaw]) {
          unit = unitMappings[unitRaw];
        } else if (unitRaw && UNITS.includes(unitRaw)) {
          unit = unitRaw;
        }

        // Determine unlimited stock
        const unlimitedStock = productType === 'service' || 
          ['oui', 'yes', 'نعم', 'true', '1'].includes(unlimitedRaw);

        // Determine out of stock sale
        const allowOutOfStockSale = ['oui', 'yes', 'نعم', 'true', '1'].includes(outOfStockRaw);

        // Validate stock for physical products
        if (!unlimitedStock && stockRaw === undefined) {
          errors.push(t('stockRequired'));
        }

        // Validate max discount
        if (maxDiscountRaw !== undefined && (maxDiscountRaw < 0 || maxDiscountRaw > 100)) {
          errors.push(t('invalidMaxDiscount'));
        }

        // Calculate TTC
        const priceTtc = priceHtRaw * (1 + vatRateRaw / 100);

        rows.push({
          rowNumber: i + 1,
          reference: reference || undefined,
          ean: ean || undefined,
          name,
          productType,
          vatRate: vatRateRaw,
          priceHt: priceHtRaw,
          priceTtc,
          unit,
          purchaseYear: yearRaw,
          maxDiscount: maxDiscountRaw,
          unlimitedStock,
          allowOutOfStockSale,
          currentStock: unlimitedStock ? undefined : (stockRaw ?? 0),
          isValid: errors.length === 0,
          errors,
        });
      }

      setParsedData(rows);

      if (rows.length === 0) {
        toast.error(t('noValidRows'));
      } else {
        const validCount = rows.filter(r => r.isValid).length;
        toast.info(`${validCount}/${rows.length} ${t('validProducts')}`);
      }
    } catch (error) {
      console.error('Excel parse error:', error);
      toast.error(t('excelParseError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.match(/\.(xlsx|xls)$/i)) {
        toast.error(t('invalidExcelFormat'));
        return;
      }
      parseExcelFile(file);
    }
  };

  const handleImport = async () => {
    const validRows = parsedData.filter(r => r.isValid);
    if (validRows.length === 0) {
      toast.error(t('noValidRowsToImport'));
      return;
    }

    setIsImporting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: org } = await supabase
        .from('organizations')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!org) {
        toast.error(t('noOrganization'));
        return;
      }

      const products = validRows.map(row => ({
        organization_id: org.id,
        reference: row.reference || null,
        ean: row.ean || null,
        name: row.name,
        product_type: row.productType,
        vat_rate: row.vatRate,
        price_ht: row.priceHt,
        price_ttc: row.priceTtc,
        unit: row.unit || null,
        purchase_year: row.purchaseYear,
        max_discount: row.maxDiscount ?? null,
        unlimited_stock: row.unlimitedStock,
        allow_out_of_stock_sale: row.unlimitedStock ? null : row.allowOutOfStockSale,
        current_stock: row.unlimitedStock ? null : (row.currentStock ?? 0),
        status: 'active' as const,
      }));

      const { error } = await supabase
        .from('products')
        .insert(products);

      if (error) throw error;

      toast.success(`${validRows.length} ${t('productsImported')}`);
      onImported();
      onOpenChange(false);
      resetState();
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(t('importError'));
    } finally {
      setIsImporting(false);
    }
  };

  const resetState = () => {
    setParsedData([]);
    setFileName('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const validCount = parsedData.filter(r => r.isValid).length;
  const invalidCount = parsedData.filter(r => !r.isValid).length;

  return (
    <Dialog open={open} onOpenChange={(open) => { onOpenChange(open); if (!open) resetState(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 glass-strong overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b border-border/50">
          <DialogTitle className="text-xl gradient-text flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            {t('importFromExcel')}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[calc(90vh-180px)] max-h-[600px]">
          <div className="p-6 space-y-6">
            {/* Instructions */}
            <Alert className="border-primary/50 bg-primary/5">
              <Info className="h-4 w-4" />
              <AlertTitle>{t('importInstructions')}</AlertTitle>
              <AlertDescription className="mt-2 space-y-2">
                <p>{t('importStep1')}</p>
                <p>{t('importStep2')}</p>
                <p>{t('importStep3')}</p>
              </AlertDescription>
            </Alert>

            {/* Download Template */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between p-4 bg-muted/30 rounded-lg border border-border/50">
              <div>
                <h4 className="font-medium">{t('downloadTemplate')}</h4>
                <p className="text-sm text-muted-foreground">{t('templateDescription')}</p>
              </div>
              <Button onClick={downloadTemplate} variant="outline" className="gap-2">
                <Download className="w-4 h-4" />
                {t('download')}
              </Button>
            </div>

            <Separator />

            {/* Upload Section */}
            <div className="space-y-4">
              <h4 className="font-medium">{t('uploadExcelFile')}</h4>
              
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
              />

              <motion.div
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border/50 hover:border-primary/50 rounded-xl p-8 text-center cursor-pointer transition-colors"
              >
                {isLoading ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-10 h-10 animate-spin text-primary" />
                    <p className="text-muted-foreground">{t('parsingFile')}</p>
                  </div>
                ) : fileName ? (
                  <div className="flex flex-col items-center gap-3">
                    <FileSpreadsheet className="w-10 h-10 text-green-500" />
                    <p className="font-medium">{fileName}</p>
                    <p className="text-sm text-muted-foreground">{t('clickToChange')}</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <Upload className="w-10 h-10 text-muted-foreground" />
                    <p className="text-muted-foreground">{t('dragOrClick')}</p>
                    <p className="text-xs text-muted-foreground">{t('acceptedFormats')}: .xlsx, .xls</p>
                  </div>
                )}
              </motion.div>
            </div>

            {/* Preview Table */}
            <AnimatePresence>
              {parsedData.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-4"
                >
                  <Separator />
                  
                  {/* Summary */}
                  <div className="flex flex-wrap gap-3">
                    <Badge variant="outline" className="text-sm py-1 px-3">
                      {parsedData.length} {t('totalRows')}
                    </Badge>
                    <Badge className="bg-green-500/20 text-green-600 dark:text-green-400 border border-green-500/50 text-sm py-1 px-3">
                      <CheckCircle2 className="w-4 h-4 mr-1" />
                      {validCount} {t('valid')}
                    </Badge>
                    {invalidCount > 0 && (
                      <Badge className="bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/50 text-sm py-1 px-3">
                        <AlertCircle className="w-4 h-4 mr-1" />
                        {invalidCount} {t('invalid')}
                      </Badge>
                    )}
                  </div>

                  {/* Table */}
                  <div className="rounded-lg border border-border/50 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead className="w-16">#</TableHead>
                          <TableHead>{t('status')}</TableHead>
                          <TableHead>{t('productName')}</TableHead>
                          <TableHead>{t('productType')}</TableHead>
                          <TableHead className="text-right">{t('priceHT')}</TableHead>
                          <TableHead className="text-center">{t('vatRate')}</TableHead>
                          <TableHead className="text-center">{t('stock')}</TableHead>
                          <TableHead>{t('errors')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parsedData.map((row, index) => (
                          <motion.tr
                            key={index}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: index * 0.02 }}
                            className={`border-b border-border/30 ${
                              row.isValid ? '' : 'bg-red-500/5'
                            }`}
                          >
                            <TableCell className="font-mono text-xs">{row.rowNumber}</TableCell>
                            <TableCell>
                              {row.isValid ? (
                                <CheckCircle2 className="w-5 h-5 text-green-500" />
                              ) : (
                                <AlertCircle className="w-5 h-5 text-red-500" />
                              )}
                            </TableCell>
                            <TableCell className="font-medium max-w-[200px] truncate">
                              {row.name || '-'}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {row.productType === 'service' ? t('service') : t('physicalProduct')}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {isNaN(row.priceHt) ? '-' : row.priceHt.toFixed(3)}
                            </TableCell>
                            <TableCell className="text-center">
                              {VAT_RATES.includes(row.vatRate) ? `${row.vatRate}%` : '-'}
                            </TableCell>
                            <TableCell className="text-center">
                              {row.unlimitedStock ? (
                                <Badge variant="secondary" className="text-xs">{t('unlimited')}</Badge>
                              ) : (
                                row.currentStock ?? '-'
                              )}
                            </TableCell>
                            <TableCell className="max-w-[200px]">
                              {row.errors.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {row.errors.map((err, i) => (
                                    <Badge key={i} variant="destructive" className="text-xs">
                                      {err}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </TableCell>
                          </motion.tr>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="flex justify-between items-center gap-3 p-4 border-t border-border/50 bg-muted/30">
          <Button 
            variant="ghost" 
            onClick={resetState}
            disabled={isImporting || parsedData.length === 0}
            className="gap-2"
          >
            <X className="w-4 h-4" />
            {t('reset')}
          </Button>
          
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={isImporting}
            >
              {t('cancel')}
            </Button>
            <Button 
              onClick={handleImport}
              disabled={isImporting || validCount === 0}
              className="gap-2 min-w-[140px]"
            >
              {isImporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              {isImporting ? t('importing') : `${t('import')} (${validCount})`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
