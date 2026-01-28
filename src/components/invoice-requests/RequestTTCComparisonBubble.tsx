import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle, TrendingUp, TrendingDown, Minus, GripVertical } from 'lucide-react';

interface RequestTTCComparisonBubbleProps {
  requestTTC: number;
  currentTTC: number;
  currency?: string;
}

export const RequestTTCComparisonBubble: React.FC<RequestTTCComparisonBubbleProps> = ({
  requestTTC,
  currentTTC,
  currency = 'TND',
}) => {
  const { t } = useLanguage();
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const initialPos = useRef({ x: 0, y: 0 });
  
  const difference = requestTTC - currentTTC;
  const isMatch = Math.abs(difference) < 0.001;
  const isOver = difference < -0.001;
  const isUnder = difference > 0.001;

  // Animate in on mount
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const formatAmount = (amount: number) => {
    return `${amount.toFixed(3)} ${currency}`;
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    initialPos.current = { x: position.x, y: position.y };
  }, [position]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    
    const deltaX = e.clientX - dragStartPos.current.x;
    const deltaY = e.clientY - dragStartPos.current.y;
    
    setPosition({
      x: initialPos.current.x + deltaX,
      y: initialPos.current.y + deltaY
    });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Touch events for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    const touch = e.touches[0];
    setIsDragging(true);
    dragStartPos.current = { x: touch.clientX, y: touch.clientY };
    initialPos.current = { x: position.x, y: position.y };
  }, [position]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging) return;
    e.preventDefault(); // Prevent scrolling while dragging
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - dragStartPos.current.x;
    const deltaY = touch.clientY - dragStartPos.current.y;
    
    setPosition({
      x: initialPos.current.x + deltaX,
      y: initialPos.current.y + deltaY
    });
  }, [isDragging]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleTouchEnd);
    }
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  const bubbleContent = (
    <div
      className={cn(
        "fixed select-none transition-opacity duration-300",
        isVisible ? "opacity-100" : "opacity-0",
        "z-[99999]"
      )}
      style={{ 
        bottom: `calc(24px - ${position.y}px)`,
        right: `calc(24px - ${position.x}px)`,
        touchAction: 'none',
        pointerEvents: 'auto'
      }}
    >
      <div
        className={cn(
          "rounded-xl shadow-2xl min-w-[280px] border-2 backdrop-blur-sm overflow-hidden transition-transform duration-200",
          isDragging && "scale-105",
          isMatch 
            ? "bg-green-500/10 border-green-500/50 text-green-700 dark:text-green-400"
            : "bg-red-500/10 border-red-500/50 text-red-700 dark:text-red-400"
        )}
      >
        {/* Drag handle header */}
        <div 
          className={cn(
            "flex items-center gap-2 px-3 py-2 cursor-grab active:cursor-grabbing",
            isMatch ? "bg-green-500/20" : "bg-red-500/20"
          )}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        >
          <GripVertical className="h-4 w-4" />
          <span className="text-sm font-medium">{t('ttc_comparison')}</span>
          <div className="ml-auto">
            {isMatch ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
          </div>
        </div>

        <div className="p-4 pt-2">
          {/* Request TTC */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm opacity-80">{t('request_ttc')}</span>
            <span className="text-lg font-bold">{formatAmount(requestTTC)}</span>
          </div>

          {/* Current TTC */}
          <div className="flex items-center justify-between text-sm mb-2 opacity-80">
            <span>{t('current_invoice_ttc')}</span>
            <span className="font-mono">{formatAmount(currentTTC)}</span>
          </div>

          {/* Difference */}
          <div 
            className={cn(
              "flex items-center justify-between pt-2 border-t",
              isMatch ? "border-green-500/30" : "border-red-500/30"
            )}
          >
            <span className="text-sm font-medium">{t('difference')}</span>
            <div className="flex items-center gap-1">
              {isOver && <TrendingDown className="h-4 w-4" />}
              {isUnder && <TrendingUp className="h-4 w-4" />}
              {isMatch && <Minus className="h-4 w-4" />}
              <span className="font-mono font-bold">
                {isOver ? '+' : isUnder ? '-' : ''}
                {formatAmount(Math.abs(difference))}
              </span>
            </div>
          </div>

          {/* Status message */}
          <div className="mt-3 text-xs text-center">
            {isMatch ? (
              <span className="text-green-600 dark:text-green-400 font-medium">
                ✓ {t('amounts_match_validation_enabled')}
              </span>
            ) : isOver ? (
              <span className="text-red-600 dark:text-red-400">
                {t('invoice_exceeds_request')}
              </span>
            ) : (
              <span className="text-red-600 dark:text-red-400">
                {t('invoice_below_request')}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // Use portal to render outside of any containing stacking context
  if (typeof document !== 'undefined') {
    return createPortal(bubbleContent, document.body);
  }
  
  return bubbleContent;
};
