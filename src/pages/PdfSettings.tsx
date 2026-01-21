import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, FileX2, Eye, Settings2, Sparkles, Check, X, RotateCcw } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePdfSettings, DocumentType, PdfComponent } from '@/contexts/PdfSettingsContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { PdfTemplatePreview } from '@/components/pdf-settings/PdfTemplatePreview';
import { PdfComponentsList } from '@/components/pdf-settings/PdfComponentsList';
import { PdfAIAgent } from '@/components/pdf-settings/PdfAIAgent';

export type { DocumentType, PdfComponent } from '@/contexts/PdfSettingsContext';

const PdfSettings: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const { 
    invoiceComponents, 
    creditNoteComponents,
    deliveryNoteComponents,
    toggleComponent, 
    resetToDefault 
  } = usePdfSettings();
  
  const [activeTab, setActiveTab] = useState<DocumentType>('invoice');
  const [showAIAgent, setShowAIAgent] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);

  const currentComponents = activeTab === 'invoice' 
    ? invoiceComponents 
    : activeTab === 'credit-note' 
      ? creditNoteComponents 
      : deliveryNoteComponents;

  const handleToggleComponent = (componentId: string, enabled: boolean) => {
    toggleComponent(activeTab, componentId, enabled);
    // Refresh preview
    setPreviewKey(prev => prev + 1);
  };

  const handleResetToDefault = () => {
    resetToDefault(activeTab);
    setPreviewKey(prev => prev + 1);
  };

  const enabledCount = currentComponents.filter(c => c.enabled).length;
  const totalCount = currentComponents.length;

  return (
    <div className={`space-y-6 ${isRTL ? 'rtl' : ''}`}>
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent flex items-center gap-3">
            <Settings2 className="w-8 h-8 text-primary" />
            {t('pdf_settings_title')}
          </h1>
          <p className="text-muted-foreground mt-1">{t('pdf_settings_description')}</p>
        </div>
        <Button
          variant="outline"
          onClick={handleResetToDefault}
          className="gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          {t('reset_to_default')}
        </Button>
      </motion.div>

      {/* Tabs for document types */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as DocumentType)} className="w-full">
        <TabsList className="grid w-full max-w-lg grid-cols-3 glass">
          <TabsTrigger value="invoice" className="gap-2">
            <FileText className="w-4 h-4" />
            {t('sales_invoice')}
          </TabsTrigger>
          <TabsTrigger value="credit-note" className="gap-2">
            <FileX2 className="w-4 h-4" />
            {t('sales_credit_note')}
          </TabsTrigger>
          <TabsTrigger value="delivery-note" className="gap-2">
            <FileText className="w-4 h-4" />
            {t('delivery_note_template')}
          </TabsTrigger>
        </TabsList>
        </TabsList>

        <TabsContent value="invoice" className="mt-6">
          <PdfSettingsContent
            documentType="invoice"
            components={invoiceComponents}
            onToggleComponent={handleToggleComponent}
            showAIAgent={showAIAgent}
            setShowAIAgent={setShowAIAgent}
            previewKey={previewKey}
            enabledCount={enabledCount}
            totalCount={totalCount}
            t={t}
            isRTL={isRTL}
          />
        </TabsContent>

        <TabsContent value="credit-note" className="mt-6">
          <PdfSettingsContent
            documentType="credit-note"
            components={creditNoteComponents}
            onToggleComponent={handleToggleComponent}
            showAIAgent={showAIAgent}
            setShowAIAgent={setShowAIAgent}
            previewKey={previewKey}
            enabledCount={enabledCount}
            totalCount={totalCount}
            t={t}
            isRTL={isRTL}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

interface PdfSettingsContentProps {
  documentType: DocumentType;
  components: PdfComponent[];
  onToggleComponent: (id: string, enabled: boolean) => void;
  showAIAgent: boolean;
  setShowAIAgent: (show: boolean) => void;
  previewKey: number;
  enabledCount: number;
  totalCount: number;
  t: (key: string) => string;
  isRTL: boolean;
}

const PdfSettingsContent: React.FC<PdfSettingsContentProps> = ({
  documentType,
  components,
  onToggleComponent,
  showAIAgent,
  setShowAIAgent,
  previewKey,
  enabledCount,
  totalCount,
  t,
  isRTL,
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left column: Preview */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="glass h-full">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-primary" />
                <CardTitle className="text-lg">{t('pdf_preview')}</CardTitle>
              </div>
              <Badge variant="outline" className="text-xs">
                {t('live_preview')}
              </Badge>
            </div>
            <CardDescription>{t('pdf_preview_description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <PdfTemplatePreview 
              documentType={documentType} 
              components={components}
              key={previewKey}
            />
          </CardContent>
        </Card>
      </motion.div>

      {/* Right column: Components + AI Agent */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-6"
      >
        {/* Components list */}
        <Card className="glass">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-primary" />
                <CardTitle className="text-lg">{t('pdf_components')}</CardTitle>
              </div>
              <Badge variant="secondary">
                {enabledCount}/{totalCount} {t('enabled')}
              </Badge>
            </div>
            <CardDescription>{t('pdf_components_description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <PdfComponentsList 
              components={components} 
              onToggle={onToggleComponent}
            />
          </CardContent>
        </Card>

        {/* AI Agent toggle */}
        <Card className="glass border-primary/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <CardTitle className="text-lg">{t('pdf_ai_agent')}</CardTitle>
              </div>
              <Button
                variant={showAIAgent ? "default" : "outline"}
                size="sm"
                onClick={() => setShowAIAgent(!showAIAgent)}
                className="gap-2"
              >
                {showAIAgent ? <X className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                {showAIAgent ? t('close') : t('open')}
              </Button>
            </div>
            <CardDescription>{t('pdf_ai_agent_description')}</CardDescription>
          </CardHeader>
          {showAIAgent && (
            <CardContent>
              <PdfAIAgent 
                documentType={documentType} 
                components={components}
                onToggleComponent={onToggleComponent}
              />
            </CardContent>
          )}
        </Card>
      </motion.div>
    </div>
  );
};

export default PdfSettings;
