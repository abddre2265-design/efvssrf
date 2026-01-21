import { useEffect, useCallback, useState } from 'react';

interface MenuItem {
  id: string;
  type: 'item' | 'group';
  groupId?: string;
}

interface UseSidebarKeyboardProps {
  menuItems: MenuItem[];
  currentPage: string;
  collapsed: boolean;
  openGroups: Record<string, boolean>;
  onNavigate: (pageId: string) => void;
  onToggleCollapse: () => void;
  onToggleGroup: (groupId: string) => void;
  onToggleSound: () => void;
}

export const useSidebarKeyboard = ({
  menuItems,
  currentPage,
  collapsed,
  openGroups,
  onNavigate,
  onToggleCollapse,
  onToggleGroup,
  onToggleSound,
}: UseSidebarKeyboardProps) => {
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [isKeyboardNavigating, setIsKeyboardNavigating] = useState(false);

  // Get visible items based on open groups
  const getVisibleItems = useCallback(() => {
    const visible: MenuItem[] = [];
    let currentGroupId: string | null = null;

    for (const item of menuItems) {
      if (item.type === 'group') {
        visible.push(item);
        currentGroupId = item.id;
      } else if (item.type === 'item') {
        if (!item.groupId || openGroups[item.groupId]) {
          visible.push(item);
        }
      }
    }
    return visible;
  }, [menuItems, openGroups]);

  const visibleItems = getVisibleItems();

  // Find current page index
  useEffect(() => {
    const index = visibleItems.findIndex(item => item.id === currentPage);
    if (index !== -1 && !isKeyboardNavigating) {
      setFocusedIndex(index);
    }
  }, [currentPage, visibleItems, isKeyboardNavigating]);

  // Keyboard event handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      // Ctrl/Cmd + B: Toggle sidebar collapse
      if (modKey && e.key === 'b') {
        e.preventDefault();
        onToggleCollapse();
        return;
      }

      // Ctrl/Cmd + M: Toggle sound
      if (modKey && e.key === 'm') {
        e.preventDefault();
        onToggleSound();
        return;
      }

      // Arrow navigation (only when not in collapsed mode for full navigation)
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setIsKeyboardNavigating(true);

        setFocusedIndex(prev => {
          const newIndex = e.key === 'ArrowDown'
            ? Math.min(prev + 1, visibleItems.length - 1)
            : Math.max(prev - 1, 0);
          return newIndex;
        });
        return;
      }

      // Enter or Space: Select focused item or toggle group
      if ((e.key === 'Enter' || e.key === ' ') && focusedIndex >= 0 && isKeyboardNavigating) {
        e.preventDefault();
        const focusedItem = visibleItems[focusedIndex];
        
        if (focusedItem) {
          if (focusedItem.type === 'group') {
            onToggleGroup(focusedItem.id);
          } else {
            onNavigate(focusedItem.id);
            setIsKeyboardNavigating(false);
          }
        }
        return;
      }

      // Escape: Exit keyboard navigation mode
      if (e.key === 'Escape') {
        setIsKeyboardNavigating(false);
        return;
      }

      // Number keys 1-9 for quick navigation to menu groups
      if (!modKey && e.key >= '1' && e.key <= '9') {
        const groupIndex = parseInt(e.key) - 1;
        const groups = menuItems.filter(item => item.type === 'group');
        if (groupIndex < groups.length) {
          e.preventDefault();
          const group = groups[groupIndex];
          onToggleGroup(group.id);
        }
        return;
      }

      // Alt + H: Go to Home
      if (e.altKey && e.key === 'h') {
        e.preventDefault();
        onNavigate('home');
        return;
      }

      // Alt + P: Go to Products
      if (e.altKey && e.key === 'p') {
        e.preventDefault();
        onNavigate('products');
        return;
      }

      // Alt + C: Go to Clients
      if (e.altKey && e.key === 'c') {
        e.preventDefault();
        onNavigate('clients');
        return;
      }

      // Alt + I: Go to Invoices
      if (e.altKey && e.key === 'i') {
        e.preventDefault();
        onNavigate('invoices');
        return;
      }

      // Alt + S: Go to Suppliers
      if (e.altKey && e.key === 's') {
        e.preventDefault();
        onNavigate('suppliers');
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    focusedIndex,
    visibleItems,
    isKeyboardNavigating,
    onNavigate,
    onToggleCollapse,
    onToggleGroup,
    onToggleSound,
    menuItems,
  ]);

  // Reset keyboard navigation on mouse interaction
  useEffect(() => {
    const handleMouseMove = () => {
      if (isKeyboardNavigating) {
        setIsKeyboardNavigating(false);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isKeyboardNavigating]);

  return {
    focusedIndex,
    isKeyboardNavigating,
    visibleItems,
  };
};

// Keyboard shortcuts info
export const keyboardShortcuts = [
  { keys: ['Ctrl', 'B'], action: 'toggle_sidebar' },
  { keys: ['Ctrl', 'M'], action: 'toggle_sound' },
  { keys: ['↑', '↓'], action: 'navigate_items' },
  { keys: ['Enter'], action: 'select_item' },
  { keys: ['1-9'], action: 'toggle_groups' },
  { keys: ['Alt', 'H'], action: 'go_home' },
  { keys: ['Alt', 'P'], action: 'go_products' },
  { keys: ['Alt', 'C'], action: 'go_clients' },
  { keys: ['Alt', 'I'], action: 'go_invoices' },
  { keys: ['Alt', 'S'], action: 'go_suppliers' },
  { keys: ['Esc'], action: 'exit_keyboard_nav' },
];
