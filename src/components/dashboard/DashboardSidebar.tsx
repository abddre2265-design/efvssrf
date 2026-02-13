import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Home, 
  Package, 
  Users, 
  Truck, 
  FileText, 
  CreditCard, 
  ChevronLeft, 
  ChevronRight, 
  ReceiptText, 
  ShoppingCart, 
  Wallet, 
  FileInput, 
  MessageSquareQuote,
  ClipboardList,
  PackageCheck,
  ChevronDown,
  Store,
  Receipt,
  FileBox,
  FolderSearch,
  PackageOpen,
  ScrollText,
  Boxes,
  Globe,
  FolderUp,
  FolderDown,
  BrainCircuit,
  BarChart3,
  Settings,
  Calculator,
  Ruler,
  MapPin,
  FolderCog,
  FileType,
  Mail,
  Calendar,
  Bell,
  UserCog,
  Archive,
  Shield,
  Volume2,
  VolumeX,
  Keyboard,
  X
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useSidebarSounds } from '@/hooks/useSidebarSounds';
import { useSidebarKeyboard, keyboardShortcuts } from '@/hooks/useSidebarKeyboard';

interface DashboardSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  currentPage: string;
  onNavigate: (page: string) => void;
}

interface MenuItem {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  labelKey: string;
}

interface MenuGroup {
  id: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  items: MenuItem[];
}

export const DashboardSidebar: React.FC<DashboardSidebarProps> = ({ 
  collapsed, 
  onToggle,
  currentPage,
  onNavigate 
}) => {
  const { t, isRTL } = useLanguage();
  const { playClickSound, playHoverSound, playExpandSound, playCollapseSound } = useSidebarSounds();
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Single items (not in a group)
  const singleItems: MenuItem[] = [
    { id: 'home', icon: Home, labelKey: 'home' },
  ];

  // Grouped items
  const menuGroups: MenuGroup[] = [
    {
      id: 'commercial',
      labelKey: 'commercial_management',
      icon: Store,
      items: [
        { id: 'products', icon: Package, labelKey: 'products' },
        { id: 'clients', icon: Users, labelKey: 'clients' },
        { id: 'suppliers', icon: Truck, labelKey: 'suppliers' },
      ],
    },
    {
      id: 'sales',
      labelKey: 'sales_group',
      icon: Receipt,
      items: [
        { id: 'invoices', icon: FileText, labelKey: 'invoices' },
        { id: 'sales-invoice-requests', icon: ClipboardList, labelKey: 'sales_invoice_requests' },
        { id: 'delivery-notes', icon: PackageCheck, labelKey: 'delivery_notes' },
        { id: 'payments', icon: CreditCard, labelKey: 'sales_payments' },
        { id: 'quote-requests', icon: MessageSquareQuote, labelKey: 'quote_requests' },
      ],
    },
    {
      id: 'purchases',
      labelKey: 'purchases_group',
      icon: ShoppingCart,
      items: [
        { id: 'purchase-invoices', icon: FileBox, labelKey: 'purchase_invoices' },
        { id: 'purchase-document-requests', icon: FolderSearch, labelKey: 'classification_requests' },
        { id: 'reception-notes', icon: PackageOpen, labelKey: 'reception_notes' },
        { id: 'purchase-orders', icon: ScrollText, labelKey: 'purchase_orders' },
        { id: 'supply', icon: Boxes, labelKey: 'procurement' },
        { id: 'purchase-payments', icon: Wallet, labelKey: 'purchase_payments' },
      ],
    },
    {
      id: 'international',
      labelKey: 'international_trade',
      icon: Globe,
      items: [
        { id: 'export-folders', icon: FolderUp, labelKey: 'export_folders' },
        { id: 'import-folders', icon: FolderDown, labelKey: 'import_folders_menu' },
      ],
    },
    {
      id: 'intelligence',
      labelKey: 'intelligence_reports',
      icon: BrainCircuit,
      items: [
        { id: 'ai-reports', icon: BarChart3, labelKey: 'ai_reports' },
      ],
    },
    {
      id: 'configuration',
      labelKey: 'configuration_group',
      icon: Settings,
      items: [
        { id: 'taxes', icon: Calculator, labelKey: 'taxes' },
        { id: 'product-units', icon: Ruler, labelKey: 'product_units' },
        { id: 'points-of-sale', icon: MapPin, labelKey: 'points_of_sale' },
        { id: 'document-families', icon: FolderCog, labelKey: 'document_families_menu' },
        { id: 'pdf-settings', icon: FileType, labelKey: 'pdf_settings' },
      ],
    },
  ];

  // Items after groups (independent buttons)
  const bottomItems: MenuItem[] = [
    { id: 'mailing', icon: Mail, labelKey: 'mailing' },
    { id: 'calendar', icon: Calendar, labelKey: 'calendar_deadlines' },
    { id: 'notifications', icon: Bell, labelKey: 'notification_center' },
    { id: 'users-roles', icon: UserCog, labelKey: 'users_roles' },
    { id: 'archives', icon: Archive, labelKey: 'archives' },
    { id: 'security-logs', icon: Shield, labelKey: 'security_logs' },
  ];

  // Track which groups are open
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    menuGroups.forEach(group => {
      if (group.items.some(item => item.id === currentPage)) {
        initial[group.id] = true;
      }
    });
    return initial;
  });

  // Build flat menu items for keyboard navigation
  const flatMenuItems = useMemo(() => {
    const items: { id: string; type: 'item' | 'group'; groupId?: string }[] = [];
    
    // Single items
    singleItems.forEach(item => {
      items.push({ id: item.id, type: 'item' });
    });
    
    // Groups and their items
    menuGroups.forEach(group => {
      items.push({ id: group.id, type: 'group' });
      group.items.forEach(item => {
        items.push({ id: item.id, type: 'item', groupId: group.id });
      });
    });
    
    // Bottom items
    bottomItems.forEach(item => {
      items.push({ id: item.id, type: 'item' });
    });
    
    return items;
  }, [singleItems, menuGroups, bottomItems]);

  const toggleGroup = useCallback((groupId: string) => {
    const isOpening = !openGroups[groupId];
    if (soundEnabled) {
      isOpening ? playExpandSound() : playCollapseSound();
    }
    setOpenGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  }, [openGroups, soundEnabled, playExpandSound, playCollapseSound]);

  const handleToggleSound = useCallback(() => {
    setSoundEnabled(prev => !prev);
  }, []);

  // Keyboard navigation hook
  const { focusedIndex, isKeyboardNavigating, visibleItems } = useSidebarKeyboard({
    menuItems: flatMenuItems,
    currentPage,
    collapsed,
    openGroups,
    onNavigate,
    onToggleCollapse: onToggle,
    onToggleGroup: toggleGroup,
    onToggleSound: handleToggleSound,
  });

  const handleItemClick = useCallback((itemId: string) => {
    if (soundEnabled) {
      playClickSound();
    }
    onNavigate(itemId);
  }, [soundEnabled, playClickSound, onNavigate]);

  const handleItemHover = useCallback(() => {
    if (soundEnabled) {
      playHoverSound();
    }
  }, [soundEnabled, playHoverSound]);

  const handleToggleSidebar = useCallback(() => {
    if (soundEnabled) {
      collapsed ? playExpandSound() : playCollapseSound();
    }
    onToggle();
  }, [collapsed, soundEnabled, playExpandSound, playCollapseSound, onToggle]);

  // Check if item is focused via keyboard
  const isItemFocused = useCallback((itemId: string) => {
    if (!isKeyboardNavigating) return false;
    const focusedItem = visibleItems[focusedIndex];
    return focusedItem?.id === itemId;
  }, [isKeyboardNavigating, visibleItems, focusedIndex]);


  const renderMenuItem = (item: MenuItem, indent: boolean = false) => {
    const isActive = currentPage === item.id;
    const isFocused = isItemFocused(item.id);
    const label = t(item.labelKey);
    
    const buttonContent = (
      <motion.div
        key={item.id}
        whileHover={{ x: isRTL ? -4 : 4 }}
        whileTap={{ scale: 0.98 }}
        onHoverStart={handleItemHover}
      >
        <Button
          variant="ghost"
          onClick={() => handleItemClick(item.id)}
          className={cn(
            "sidebar-menu-item w-full justify-start gap-3 h-11 relative overflow-hidden group",
            isRTL && "rtl flex-row-reverse",
            isActive && "sidebar-active-halo bg-primary/10",
            isFocused && "ring-2 ring-primary/50 bg-primary/5",
            collapsed && "justify-center px-2",
            indent && !collapsed && (isRTL ? "mr-4 w-[calc(100%-1rem)]" : "ml-4 w-[calc(100%-1rem)]")
          )}
        >
          {/* Active indicator bar */}
          <AnimatePresence>
            {isActive && (
              <motion.div
                layoutId="activeSidebarIndicator"
                className={cn(
                  "absolute top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-full",
                  isRTL ? "right-0" : "left-0"
                )}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              />
            )}
          </AnimatePresence>

          {/* Animated icon container */}
          <motion.div
            className="relative flex-shrink-0"
            animate={isActive ? {
              scale: [1, 1.1, 1],
            } : {}}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            {/* Icon glow effect */}
            {isActive && (
              <motion.div
                className="absolute inset-0 bg-primary/40 rounded-full blur-md"
                animate={{
                  opacity: [0.4, 0.8, 0.4],
                  scale: [1, 1.4, 1],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
            )}
            <item.icon className={cn(
              "w-5 h-5 relative z-10 icon-neon transition-all duration-300",
              isActive ? "text-primary active" : "text-muted-foreground group-hover:text-primary"
            )} />
          </motion.div>

          {/* Label */}
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
                className={cn(
                  "font-medium text-sm whitespace-nowrap overflow-hidden",
                  isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                )}
              >
                {label}
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </motion.div>
    );

    if (collapsed) {
      return (
        <Tooltip key={item.id} delayDuration={0}>
          <TooltipTrigger asChild>
            {buttonContent}
          </TooltipTrigger>
          <TooltipContent side={isRTL ? "left" : "right"} className="glass">
            {label}
          </TooltipContent>
        </Tooltip>
      );
    }

    return buttonContent;
  };

  const renderMenuGroup = (group: MenuGroup) => {
    const isOpen = openGroups[group.id] ?? false;
    const hasActiveItem = group.items.some(item => item.id === currentPage);
    const label = t(group.labelKey);

    const triggerContent = (
      <Button
        variant="ghost"
        className={cn(
          "sidebar-group-header w-full justify-start gap-3 h-11 relative overflow-hidden group",
          isRTL && "rtl flex-row-reverse",
          hasActiveItem && "bg-primary/5",
          collapsed && "justify-center px-2"
        )}
        onMouseEnter={handleItemHover}
      >
        <group.icon className={cn(
          "w-5 h-5 flex-shrink-0 icon-neon transition-all duration-300",
          hasActiveItem ? "text-primary active" : "text-muted-foreground group-hover:text-primary"
        )} />
        
        <AnimatePresence>
          {!collapsed && (
            <>
              <motion.span 
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className={cn(
                  "font-medium text-sm flex-1 whitespace-nowrap overflow-hidden",
                  isRTL ? "text-right" : "text-left",
                  hasActiveItem ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                )}
              >
                {label}
              </motion.span>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <ChevronDown className={cn(
                  "w-4 h-4 text-muted-foreground transition-transform duration-300",
                  isOpen && "rotate-180"
                )} />
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </Button>
    );

    return (
      <Collapsible
        key={group.id}
        open={isOpen && !collapsed}
        onOpenChange={() => !collapsed && toggleGroup(group.id)}
      >
        <CollapsibleTrigger asChild>
          {collapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                {triggerContent}
              </TooltipTrigger>
              <TooltipContent side={isRTL ? "left" : "right"} className="glass">
                <div className="font-semibold mb-1">{label}</div>
                <div className="text-xs text-muted-foreground">
                  {group.items.map(item => t(item.labelKey)).join(', ')}
                </div>
              </TooltipContent>
            </Tooltip>
          ) : (
            triggerContent
          )}
        </CollapsibleTrigger>

        <CollapsibleContent>
          <AnimatePresence>
            {isOpen && !collapsed && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="space-y-1 mt-1"
              >
                {group.items.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    {renderMenuItem(item, true)}
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </CollapsibleContent>
      </Collapsible>
    );
  };

  return (
    <TooltipProvider>
      <motion.aside
        initial={{ x: isRTL ? 100 : -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1, width: collapsed ? 64 : 256 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className={cn(
          "sidebar-futuristic h-full flex flex-col relative flex-shrink-0 overflow-hidden",
          isRTL && "rtl"
        )}
      >
        {/* Animated scan line */}
        <div className="sidebar-scan-line" />

        {/* Menu Items - Independent scrollable area */}
        <div className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-thin">
          {/* Single items at top */}
          {singleItems.map(item => renderMenuItem(item))}

          {/* Divider */}
          <div className="my-3 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

          {/* Grouped items */}
          {menuGroups.map(group => renderMenuGroup(group))}

          {/* Divider */}
          <div className="my-3 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

          {/* Bottom items */}
          {bottomItems.map(item => renderMenuItem(item))}
        </div>

        {/* Footer controls */}
        <div className="p-3 border-t border-border/30 space-y-2">
          {/* Keyboard shortcuts button */}
          <Dialog open={showShortcuts} onOpenChange={setShowShortcuts}>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "w-full justify-center h-9 opacity-60 hover:opacity-100 transition-opacity",
                      collapsed && "px-2"
                    )}
                  >
                    <Keyboard className="w-4 h-4 text-muted-foreground" />
                    {!collapsed && (
                      <span className={cn("text-xs text-muted-foreground", isRTL ? "mr-2" : "ml-2")}>
                        {t('keyboard_shortcuts')}
                      </span>
                    )}
                  </Button>
                </DialogTrigger>
              </TooltipTrigger>
              <TooltipContent side={isRTL ? "left" : "right"}>
                {t('keyboard_shortcuts')}
              </TooltipContent>
            </Tooltip>
            <DialogContent className="glass max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Keyboard className="w-5 h-5 text-primary" />
                  {t('keyboard_shortcuts')}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 mt-4">
                {keyboardShortcuts.map((shortcut, index) => (
                  <motion.div
                    key={shortcut.action}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center justify-between py-2 border-b border-border/30 last:border-0"
                  >
                    <span className="text-sm text-muted-foreground">
                      {t(shortcut.action)}
                    </span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, keyIndex) => (
                        <React.Fragment key={key}>
                          <kbd className="px-2 py-1 text-xs font-mono bg-muted rounded border border-border">
                            {key}
                          </kbd>
                          {keyIndex < shortcut.keys.length - 1 && (
                            <span className="text-muted-foreground text-xs">+</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>
              <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-xs text-muted-foreground text-center">
                  {navigator.platform.toUpperCase().indexOf('MAC') >= 0 
                    ? 'Utilisez ⌘ au lieu de Ctrl sur Mac'
                    : 'Use Ctrl for keyboard shortcuts'}
                </p>
              </div>
            </DialogContent>
          </Dialog>

          {/* Sound toggle */}
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToggleSound}
                className={cn(
                  "w-full justify-center h-9 opacity-60 hover:opacity-100 transition-opacity",
                  collapsed && "px-2"
                )}
              >
                {soundEnabled ? (
                  <Volume2 className="w-4 h-4 text-primary" />
                ) : (
                  <VolumeX className="w-4 h-4 text-muted-foreground" />
                )}
                {!collapsed && (
                  <span className={cn("text-xs text-muted-foreground", isRTL ? "mr-2" : "ml-2")}>
                    {soundEnabled ? t('sound_on') : t('sound_off')}
                  </span>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side={isRTL ? "left" : "right"}>
              {soundEnabled ? t('sound_on') : t('sound_off')} (Ctrl+M)
            </TooltipContent>
          </Tooltip>

          {/* Collapse Toggle */}
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToggleSidebar}
                className={cn(
                  "sidebar-collapse-btn w-full justify-center h-10 border border-border/30 hover:border-primary/50 transition-all duration-300",
                  collapsed && "px-2"
                )}
              >
                <motion.div
                  animate={{ 
                    rotate: collapsed ? (isRTL ? -180 : 180) : 0,
                  }}
                  transition={{ duration: 0.3 }}
                  className="flex items-center gap-2"
                >
                  {isRTL ? (
                    <ChevronRight className="w-5 h-5 text-primary" />
                  ) : (
                    <ChevronLeft className="w-5 h-5 text-primary" />
                  )}
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-sm text-muted-foreground"
                    >
                      {t('collapse_sidebar')}
                    </motion.span>
                  )}
                </motion.div>
              </Button>
            </TooltipTrigger>
            <TooltipContent side={isRTL ? "left" : "right"}>
              {collapsed ? t('expand_sidebar') : t('collapse_sidebar')} (Ctrl+B)
            </TooltipContent>
          </Tooltip>
        </div>
      </motion.aside>
    </TooltipProvider>
  );
};
