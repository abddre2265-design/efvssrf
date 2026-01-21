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
import { 
  ClientType, 
  IDENTIFIER_TYPES, 
  TUNISIA_GOVERNORATES,
  validateCIN,
  validateTaxId 
} from './types';

interface ClientExcelImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

interface ImportRow {
  rowNumber: number;
  clientType: ClientType;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  identifierType: string;
  identifierValue: string;
  country: string;
  governorate?: string;
  address?: string;
  postalCode?: string;
  phonePrefix?: string;
  phone?: string;
  whatsappPrefix?: string;
  whatsapp?: string;
  email?: string;
  isValid: boolean;
  errors: string[];
}

export const ClientExcelImportDialog: React.FC<ClientExcelImportDialogProps> = ({
  open,
  onOpenChange,
  onImported,
}) => {
  const { t, language, isRTL } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedData, setParsedData] = useState<ImportRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [fileName, setFileName] = useState('');

  const downloadTemplate = () => {
    const headers = [
      'Type de client * / Client Type * / نوع العميل *',
      'Prénom / First Name / الاسم الأول',
      'Nom / Last Name / اسم العائلة',
      'Raison sociale / Company Name / الاسم التجاري',
      'Type identifiant * / ID Type * / نوع التعريف *',
      'Valeur identifiant * / ID Value * / رقم التعريف *',
      'Pays / Country / البلد',
      'Gouvernorat / Governorate / الولاية',
      'Adresse / Address / العنوان',
      'Code postal / Postal Code / الرمز البريدي',
      'Préfixe tél / Phone Prefix / بادئة الهاتف',
      'Téléphone / Phone / الهاتف',
      'Préfixe WhatsApp / WhatsApp Prefix / بادئة واتساب',
      'WhatsApp',
      'Email'
    ];

    const examples = [
      // Local individual with CIN
      ['physique_local', 'Ahmed', 'Ben Ali', '', 'cin', '12345678', 'Tunisie', 'Tunis', '15 Rue de la Liberté', '1000', '+216', '55123456', '+216', '55123456', 'ahmed.benali@email.tn'],
      // Local individual with passport
      ['physique_local', 'Fatma', 'Trabelsi', '', 'passeport', 'TN123456', 'Tunisie', 'Sfax', 'Avenue Habib Bourguiba', '3000', '+216', '98765432', '', '', 'fatma.trabelsi@email.tn'],
      // Local individual with tax ID
      ['physique_local', 'Mohamed', 'Jebali', '', 'matricule_fiscal', '1234567/A', 'Tunisie', 'Sousse', '', '4000', '+216', '22334455', '+216', '22334455', ''],
      // Local business
      ['morale_local', '', '', 'Société ABC SARL', 'matricule_fiscal', '7654321/B', 'Tunisie', 'Ariana', 'Zone Industrielle', '2080', '+216', '71234567', '', '', 'contact@abc-sarl.tn'],
      // Local business with extended tax ID
      ['morale_local', '', '', 'Tech Solutions SA', 'matricule_fiscal', '1234567A/P/M/000', 'Tunisie', 'La Manouba', 'Parc Technologique', '2010', '+216', '70123456', '', '', 'info@techsolutions.tn'],
      // Foreign client - individual
      ['etranger', 'Jean', 'Dupont', '', 'passeport', 'FR123456789', 'France', '', '25 Rue de Paris', '75001', '+33', '612345678', '+33', '612345678', 'jean.dupont@email.fr'],
      // Foreign client - company
      ['etranger', '', '', 'International Corp Ltd', 'tva_ue', 'DE123456789', 'Allemagne', '', 'Berliner Strasse 10', '10115', '+49', '301234567', '', '', 'contact@intcorp.de'],
      // Foreign client - SSN
      ['etranger', 'John', 'Smith', '', 'ssn', '123-45-6789', 'États-Unis', '', '123 Main Street', '10001', '+1', '2125551234', '', '', 'john.smith@email.com'],
    ];

    const instructions = [
      [''],
      ['=== INSTRUCTIONS / تعليمات ==='],
      [''],
      ['* Les champs marqués d\'une étoile (*) sont obligatoires / Fields marked with * are required / الحقول المحددة بنجمة (*) إلزامية'],
      [''],
      ['TYPE DE CLIENT / Client Type / نوع العميل:'],
      ['  - physique_local / individual_local : Personne physique en Tunisie'],
      ['  - morale_local / business_local : Personne morale en Tunisie (société)'],
      ['  - etranger / foreign : Client étranger (particulier ou entreprise)'],
      [''],
      ['NOM / Name / الاسم:'],
      ['  - Personne physique local : Prénom ET Nom obligatoires'],
      ['  - Personne morale local : Raison sociale obligatoire'],
      ['  - Étranger : Prénom/Nom OU Raison sociale'],
      [''],
      ['TYPE D\'IDENTIFIANT / ID Type / نوع التعريف:'],
      ['  Personne physique local:'],
      ['    - cin : Carte d\'identité nationale (8 chiffres)'],
      ['    - passeport : Numéro de passeport'],
      ['    - matricule_fiscal : Matricule fiscal'],
      [''],
      ['  Personne morale local:'],
      ['    - matricule_fiscal : Matricule fiscal uniquement'],
      [''],
      ['  Client étranger:'],
      ['    - passeport : Numéro de passeport'],
      ['    - tax_id : Tax ID / Numéro fiscal'],
      ['    - ssn : Social Security Number (USA)'],
      ['    - tva_ue : TVA intracommunautaire (UE)'],
      ['    - business_number_ca : Business Number (Canada)'],
      ['    - registre_commerce : Registre du commerce'],
      ['    - carte_identite : Carte d\'identité nationale'],
      ['    - passeport_diplomatique : Passeport diplomatique'],
      ['    - id_interne : ID interne système'],
      [''],
      ['FORMAT MATRICULE FISCAL / Tax ID Format:'],
      ['  - NNNNNNN/X (ex: 1234567/A)'],
      ['  - NNNNNN/X (ex: 123456/B)'],
      ['  - NNNNNNNX/X/X/NNN (ex: 1234567A/P/M/000)'],
      [''],
      ['FORMAT CIN / CIN Format:'],
      ['  - 8 chiffres exactement (ex: 12345678)'],
      [''],
      ['GOUVERNORAT (obligatoire pour clients locaux):'],
      ['  Ariana, Béja, Ben Arous, Bizerte, Gabès, Gafsa, Jendouba, Kairouan,'],
      ['  Kasserine, Kébili, Le Kef, Mahdia, La Manouba, Médenine, Monastir,'],
      ['  Nabeul, Sfax, Sidi Bouzid, Siliana, Sousse, Tataouine, Tozeur, Tunis, Zaghouan'],
      [''],
      ['PRÉFIXES TÉLÉPHONIQUES COURANTS:'],
      ['  +216 (Tunisie), +33 (France), +1 (USA/Canada), +44 (UK),'],
      ['  +49 (Allemagne), +39 (Italie), +34 (Espagne), +212 (Maroc)'],
    ];

    const wb = XLSX.utils.book_new();
    
    // Data sheet
    const wsData = XLSX.utils.aoa_to_sheet([headers, ...examples]);
    wsData['!cols'] = headers.map(() => ({ wch: 25 }));
    XLSX.utils.book_append_sheet(wb, wsData, 'Clients');

    // Instructions sheet
    const wsInstructions = XLSX.utils.aoa_to_sheet(instructions);
    wsInstructions['!cols'] = [{ wch: 100 }];
    XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');

    XLSX.writeFile(wb, 'modele_import_clients.xlsx');
    toast.success(t('templateDownloaded'));
  };

  const parseExcelFile = async (file: File) => {
    setIsLoading(true);
    setFileName(file.name);

    try {
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

      // Skip header row
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.every(cell => cell === undefined || cell === '')) continue;

        const errors: string[] = [];
        
        // Parse client type
        const typeRaw = String(row[0] || '').toLowerCase().trim();
        let clientType: ClientType = 'individual_local';
        
        const typeMap: Record<string, ClientType> = {
          'physique_local': 'individual_local',
          'individual_local': 'individual_local',
          'morale_local': 'business_local',
          'business_local': 'business_local',
          'etranger': 'foreign',
          'foreign': 'foreign',
        };
        
        if (typeMap[typeRaw]) {
          clientType = typeMap[typeRaw];
        } else {
          errors.push(t('invalid_client_type'));
        }

        // Parse name fields
        const firstName = String(row[1] || '').trim() || undefined;
        const lastName = String(row[2] || '').trim() || undefined;
        const companyName = String(row[3] || '').trim() || undefined;

        // Validate name based on type
        if (clientType === 'individual_local') {
          if (!firstName || !lastName) {
            errors.push(t('name_required_individual'));
          }
        } else if (clientType === 'business_local') {
          if (!companyName) {
            errors.push(t('company_name_required'));
          }
        } else if (clientType === 'foreign') {
          if (!(firstName && lastName) && !companyName) {
            errors.push(t('name_or_company_required'));
          }
        }

        // Parse identifier
        const identifierTypeRaw = String(row[4] || '').toLowerCase().trim();
        const identifierValue = String(row[5] || '').trim();

        // Map identifier types
        const idTypeMap: Record<string, string> = {
          'cin': 'cin',
          'carte_identite': 'national_id',
          'passeport': 'passport',
          'passport': 'passport',
          'matricule_fiscal': 'tax_id',
          'tax_id': 'tax_id',
          'ssn': 'ssn',
          'tva_ue': 'vat_eu',
          'vat_eu': 'vat_eu',
          'business_number_ca': 'business_number_ca',
          'registre_commerce': 'trade_register',
          'trade_register': 'trade_register',
          'passeport_diplomatique': 'diplomatic_passport',
          'diplomatic_passport': 'diplomatic_passport',
          'id_interne': 'internal_id',
          'internal_id': 'internal_id',
          'national_id': 'national_id',
        };

        const identifierType = idTypeMap[identifierTypeRaw] || identifierTypeRaw;

        // Validate identifier type for client type
        const allowedTypes = IDENTIFIER_TYPES[clientType];
        if (!allowedTypes.includes(identifierType as any)) {
          errors.push(t('invalid_identifier_type_for_client'));
        }

        // Validate identifier value
        if (!identifierValue) {
          errors.push(t('identifier_required'));
        } else if (identifierType === 'cin' && !validateCIN(identifierValue)) {
          errors.push(t('cin_invalid'));
        } else if (identifierType === 'tax_id' && !validateTaxId(identifierValue)) {
          errors.push(t('tax_id_invalid'));
        }

        // Parse address
        const country = String(row[6] || 'Tunisie').trim();
        const governorate = String(row[7] || '').trim() || undefined;
        const address = String(row[8] || '').trim() || undefined;
        const postalCode = String(row[9] || '').trim() || undefined;

        // Validate governorate for local clients
        if (clientType !== 'foreign') {
          if (!governorate) {
            errors.push(t('governorate_required'));
          } else if (!TUNISIA_GOVERNORATES.includes(governorate)) {
            errors.push(t('invalid_governorate'));
          }
        }

        // Parse contact
        const phonePrefix = String(row[10] || '').trim() || undefined;
        const phone = String(row[11] || '').trim() || undefined;
        const whatsappPrefix = String(row[12] || '').trim() || undefined;
        const whatsapp = String(row[13] || '').trim() || undefined;
        const email = String(row[14] || '').trim() || undefined;

        // Validate email if provided
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          errors.push(t('invalid_email'));
        }

        rows.push({
          rowNumber: i + 1,
          clientType,
          firstName,
          lastName,
          companyName,
          identifierType,
          identifierValue,
          country: clientType === 'foreign' ? country : 'Tunisie',
          governorate,
          address,
          postalCode,
          phonePrefix,
          phone,
          whatsappPrefix,
          whatsapp,
          email,
          isValid: errors.length === 0,
          errors,
        });
      }

      setParsedData(rows);

      if (rows.length === 0) {
        toast.error(t('noValidRows'));
      } else {
        const validCount = rows.filter(r => r.isValid).length;
        toast.info(`${validCount}/${rows.length} ${t('valid_clients')}`);
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
      toast.error(t('no_valid_clients_to_import'));
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

      // Check for duplicate identifiers
      const identifierValues = validRows.map(r => r.identifierValue);
      const { data: existingClients } = await supabase
        .from('clients')
        .select('identifier_value')
        .eq('organization_id', org.id)
        .in('identifier_value', identifierValues);

      const existingIdentifiers = new Set(existingClients?.map(c => c.identifier_value) || []);
      const duplicates = validRows.filter(r => existingIdentifiers.has(r.identifierValue));

      if (duplicates.length > 0) {
        toast.error(`${duplicates.length} ${t('clients_already_exist')}`);
        // Mark duplicates as invalid
        setParsedData(prev => prev.map(row => {
          if (existingIdentifiers.has(row.identifierValue)) {
            return {
              ...row,
              isValid: false,
              errors: [...row.errors, t('identifier_already_exists')]
            };
          }
          return row;
        }));
        setIsImporting(false);
        return;
      }

      const clients = validRows.map(row => ({
        organization_id: org.id,
        client_type: row.clientType,
        first_name: row.firstName || null,
        last_name: row.lastName || null,
        company_name: row.companyName || null,
        identifier_type: row.identifierType,
        identifier_value: row.identifierValue,
        country: row.country,
        governorate: row.governorate || null,
        address: row.address || null,
        postal_code: row.postalCode || null,
        phone_prefix: row.phonePrefix || null,
        phone: row.phone || null,
        whatsapp_prefix: row.whatsappPrefix || null,
        whatsapp: row.whatsapp || null,
        email: row.email || null,
        status: 'active' as const,
      }));

      const { error } = await supabase
        .from('clients')
        .insert(clients);

      if (error) throw error;

      toast.success(`${validRows.length} ${t('clients_imported')}`);
      onImported();
      onOpenChange(false);
      resetState();
    } catch (error: any) {
      console.error('Import error:', error);
      if (error.code === '23505') {
        toast.error(t('identifier_already_exists'));
      } else {
        toast.error(t('importError'));
      }
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

  const getClientName = (row: ImportRow): string => {
    if (row.companyName) return row.companyName;
    return `${row.firstName || ''} ${row.lastName || ''}`.trim() || '-';
  };

  const validCount = parsedData.filter(r => r.isValid).length;
  const invalidCount = parsedData.filter(r => !r.isValid).length;

  return (
    <Dialog open={open} onOpenChange={(open) => { onOpenChange(open); if (!open) resetState(); }}>
      <DialogContent className="max-w-5xl max-h-[90vh] p-0 glass-strong overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader className="p-6 pb-4 border-b border-border/50">
          <DialogTitle className="text-xl gradient-text flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            {t('import_clients_excel')}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[calc(90vh-180px)] max-h-[600px]">
          <div className="p-6 space-y-6">
            {/* Instructions */}
            <Alert className="border-primary/50 bg-primary/5">
              <Info className="h-4 w-4" />
              <AlertTitle>{t('importInstructions')}</AlertTitle>
              <AlertDescription className="mt-2 space-y-2">
                <p>{t('import_client_step1')}</p>
                <p>{t('import_client_step2')}</p>
                <p>{t('import_client_step3')}</p>
              </AlertDescription>
            </Alert>

            {/* Download Template */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between p-4 bg-muted/30 rounded-lg border border-border/50">
              <div>
                <h4 className="font-medium">{t('downloadTemplate')}</h4>
                <p className="text-sm text-muted-foreground">{t('template_clients_description')}</p>
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

                  {/* Data Table */}
                  <div className="border border-border/50 rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>{t('status')}</TableHead>
                          <TableHead>{t('client_type')}</TableHead>
                          <TableHead>{t('client_name')}</TableHead>
                          <TableHead>{t('identifier')}</TableHead>
                          <TableHead>{t('country')}</TableHead>
                          <TableHead>{t('phone')}</TableHead>
                          <TableHead>{t('errors')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parsedData.map((row) => (
                          <TableRow 
                            key={row.rowNumber}
                            className={row.isValid ? '' : 'bg-red-500/5'}
                          >
                            <TableCell className="text-muted-foreground">{row.rowNumber}</TableCell>
                            <TableCell>
                              {row.isValid ? (
                                <CheckCircle2 className="w-5 h-5 text-green-500" />
                              ) : (
                                <X className="w-5 h-5 text-red-500" />
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {t(row.clientType === 'individual_local' ? 'individual_local' : 
                                   row.clientType === 'business_local' ? 'business_local' : 'foreign_client')}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium">{getClientName(row)}</TableCell>
                            <TableCell className="font-mono text-sm">{row.identifierValue || '-'}</TableCell>
                            <TableCell>{row.country}</TableCell>
                            <TableCell>{row.phone ? `${row.phonePrefix || ''} ${row.phone}` : '-'}</TableCell>
                            <TableCell>
                              {row.errors.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {row.errors.map((err, idx) => (
                                    <Badge key={idx} variant="destructive" className="text-xs">
                                      {err}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </ScrollArea>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border/50 flex justify-between gap-4">
          <Button
            variant="outline"
            onClick={resetState}
            disabled={parsedData.length === 0 || isImporting}
          >
            {t('reset')}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </Button>
            <Button
              onClick={handleImport}
              disabled={validCount === 0 || isImporting}
              className="gap-2"
            >
              {isImporting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isImporting ? t('importing') : `${t('import')} (${validCount})`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
