import React from 'react';
import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { PdfComponent } from '@/pages/PdfSettings';
import { cn } from '@/lib/utils';

interface PdfComponentsListProps {
  components: PdfComponent[];
  onToggle: (id: string, enabled: boolean) => void;
}

export const PdfComponentsList: React.FC<PdfComponentsListProps> = ({
  components,
  onToggle,
}) => {
  const { t, isRTL } = useLanguage();

  const headerComponents = components.filter(c => c.category === 'header');
  const contentComponents = components.filter(c => c.category === 'content');
  const footerComponents = components.filter(c => c.category === 'footer');

  const renderCategory = (title: string, items: PdfComponent[], categoryKey: string) => (
    <div key={categoryKey} className="space-y-3">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs font-semibold">
          {title}
        </Badge>
        <span className="text-xs text-muted-foreground">
          ({items.filter(i => i.enabled).length}/{items.length})
        </span>
      </div>
      <div className="space-y-2">
        {items.map((component, index) => (
          <motion.div
            key={component.id}
            initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.03 }}
            className={cn(
              "flex items-center justify-between p-3 rounded-lg transition-all duration-200",
              component.enabled 
                ? "bg-primary/5 border border-primary/20" 
                : "bg-muted/30 border border-transparent hover:border-muted"
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center transition-all",
                component.enabled 
                  ? "bg-primary/20 text-primary" 
                  : "bg-muted text-muted-foreground"
              )}>
                {component.enabled ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <X className="w-3.5 h-3.5" />
                )}
              </div>
              <Label 
                htmlFor={component.id}
                className={cn(
                  "cursor-pointer text-sm transition-colors",
                  component.enabled ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {t(component.labelKey)}
              </Label>
            </div>
            <Switch
              id={component.id}
              checked={component.enabled}
              onCheckedChange={(checked) => onToggle(component.id, checked)}
            />
          </motion.div>
        ))}
      </div>
    </div>
  );

  return (
    <ScrollArea className="h-[400px] pr-4">
      <div className="space-y-6">
        {renderCategory(t('pdf_category_header'), headerComponents, 'header')}
        <Separator />
        {renderCategory(t('pdf_category_content'), contentComponents, 'content')}
        <Separator />
        {renderCategory(t('pdf_category_footer'), footerComponents, 'footer')}
      </div>
    </ScrollArea>
  );
};

export default PdfComponentsList;
