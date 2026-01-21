import React from 'react';
import { motion } from 'framer-motion';
import { Check, X, ChevronRight } from 'lucide-react';
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

// Define parent-child relationships
const componentHierarchy: Record<string, string[]> = {
  company_info: ['company_name', 'company_address', 'company_phone', 'company_email', 'company_identifier'],
  client_info: ['client_name', 'client_address', 'client_identifier', 'client_phone', 'client_email'],
};

const childToParent: Record<string, string> = {};
Object.entries(componentHierarchy).forEach(([parent, children]) => {
  children.forEach(child => {
    childToParent[child] = parent;
  });
});

export const PdfComponentsList: React.FC<PdfComponentsListProps> = ({
  components,
  onToggle,
}) => {
  const { t, isRTL } = useLanguage();

  const headerComponents = components.filter(c => c.category === 'header');
  const contentComponents = components.filter(c => c.category === 'content');
  const footerComponents = components.filter(c => c.category === 'footer');

  const isChildComponent = (id: string) => id in childToParent;
  const isParentComponent = (id: string) => id in componentHierarchy;
  
  const isParentEnabled = (childId: string) => {
    const parentId = childToParent[childId];
    if (!parentId) return true;
    return components.find(c => c.id === parentId)?.enabled ?? true;
  };

  const renderComponent = (component: PdfComponent, index: number) => {
    const isChild = isChildComponent(component.id);
    const isParent = isParentComponent(component.id);
    const parentEnabled = isParentEnabled(component.id);
    
    return (
      <motion.div
        key={component.id}
        initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.02 }}
        className={cn(
          "flex items-center justify-between p-3 rounded-lg transition-all duration-200",
          isChild && (isRTL ? "mr-6 border-r-2 border-primary/20" : "ml-6 border-l-2 border-primary/20"),
          component.enabled && parentEnabled
            ? "bg-primary/5 border border-primary/20" 
            : "bg-muted/30 border border-transparent hover:border-muted",
          !parentEnabled && isChild && "opacity-50"
        )}
      >
        <div className="flex items-center gap-3">
          {isParent && (
            <ChevronRight className={cn(
              "w-4 h-4 text-muted-foreground transition-transform",
              component.enabled && "rotate-90"
            )} />
          )}
          <div className={cn(
            "w-6 h-6 rounded-full flex items-center justify-center transition-all",
            component.enabled && parentEnabled
              ? "bg-primary/20 text-primary" 
              : "bg-muted text-muted-foreground"
          )}>
            {component.enabled && parentEnabled ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <X className="w-3.5 h-3.5" />
            )}
          </div>
          <Label 
            htmlFor={component.id}
            className={cn(
              "cursor-pointer text-sm transition-colors",
              component.enabled && parentEnabled ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {t(component.labelKey)}
          </Label>
        </div>
        <Switch
          id={component.id}
          checked={component.enabled}
          onCheckedChange={(checked) => onToggle(component.id, checked)}
          disabled={isChild && !parentEnabled}
        />
      </motion.div>
    );
  };

  const renderCategory = (title: string, items: PdfComponent[], categoryKey: string) => {
    // Sort items: parents first, then their children immediately after
    const sortedItems: PdfComponent[] = [];
    const addedIds = new Set<string>();

    items.forEach(item => {
      if (addedIds.has(item.id)) return;
      
      // If this is a child, skip (it will be added after its parent)
      if (isChildComponent(item.id)) return;
      
      // Add this item
      sortedItems.push(item);
      addedIds.add(item.id);
      
      // If this is a parent, add its children
      if (isParentComponent(item.id)) {
        const children = componentHierarchy[item.id];
        children.forEach(childId => {
          const childComponent = items.find(c => c.id === childId);
          if (childComponent && !addedIds.has(childId)) {
            sortedItems.push(childComponent);
            addedIds.add(childId);
          }
        });
      }
    });

    return (
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
          {sortedItems.map((component, index) => renderComponent(component, index))}
        </div>
      </div>
    );
  };

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
