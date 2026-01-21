import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, User, Loader2, Sparkles, Code, Palette, Layout, Check } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { DocumentType, PdfComponent } from '@/pages/PdfSettings';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  toggleActions?: Record<string, boolean>;
}

interface PdfAIAgentProps {
  documentType: DocumentType;
  components: PdfComponent[];
  onToggleComponent: (id: string, enabled: boolean) => void;
}

const quickSuggestions = [
  { labelKey: 'pdf_ai_suggestion_layout', icon: Layout },
  { labelKey: 'pdf_ai_suggestion_colors', icon: Palette },
  { labelKey: 'pdf_ai_suggestion_code', icon: Code },
];

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const PdfAIAgent: React.FC<PdfAIAgentProps> = ({ 
  documentType, 
  components,
  onToggleComponent 
}) => {
  const { t, isRTL, language } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const welcomeMessage: Message = {
      id: 'welcome',
      role: 'assistant',
      content: t('pdf_ai_welcome').replace('{documentType}', documentType === 'invoice' ? t('sales_invoice') : t('sales_credit_note')),
      timestamp: new Date(),
    };
    setMessages([welcomeMessage]);
  }, [documentType, t]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const getCurrentComponentsState = useCallback(() => {
    const state: Record<string, boolean> = {};
    components.forEach(c => {
      state[c.id] = c.enabled;
    });
    return state;
  }, [components]);

  const extractToggleActions = (content: string): Record<string, boolean> | null => {
    const regex = /\{"toggleComponents":\s*(\{[^}]+\})\}/;
    const match = content.match(regex);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch {
        return null;
      }
    }
    return null;
  };

  const cleanContent = (content: string): string => {
    return content.replace(/\{"toggleComponents":\s*\{[^}]+\}\}/g, '').trim();
  };

  const applyToggleActions = (actions: Record<string, boolean>) => {
    Object.entries(actions).forEach(([componentId, enabled]) => {
      onToggleComponent(componentId, enabled);
    });
    toast({
      title: t('pdf_components_updated'),
      description: t('pdf_components_updated_description'),
    });
  };

  const streamChat = async (userMessage: string) => {
    const conversationHistory = messages
      .filter(m => m.id !== 'welcome')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    conversationHistory.push({ role: 'user', content: userMessage });

    const response = await fetch(`${SUPABASE_URL}/functions/v1/pdf-ai-assistant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        messages: conversationHistory,
        language,
        documentType,
        currentComponents: getCurrentComponentsState(),
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      if (response.status === 429) {
        throw new Error(errorData?.message || t('rate_limit_exceeded'));
      }
      if (response.status === 402) {
        throw new Error(errorData?.message || t('payment_required'));
      }
      throw new Error(errorData?.message || 'Failed to get AI response');
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = '';
    let fullContent = '';
    let streamDone = false;

    const assistantMessageId = `assistant-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    }]);

    while (!streamDone) {
      const { done, value } = await reader.read();
      if (done) break;

      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);

        if (line.endsWith('\r')) line = line.slice(0, -1);
        if (line.startsWith(':') || line.trim() === '') continue;
        if (!line.startsWith('data: ')) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === '[DONE]') {
          streamDone = true;
          break;
        }

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) {
            fullContent += content;
            setMessages(prev =>
              prev.map(m =>
                m.id === assistantMessageId
                  ? { ...m, content: cleanContent(fullContent) }
                  : m
              )
            );
          }
        } catch {
          textBuffer = line + '\n' + textBuffer;
          break;
        }
      }
    }

    // Check for toggle actions in the final content
    const toggleActions = extractToggleActions(fullContent);
    if (toggleActions) {
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantMessageId
            ? { ...m, content: cleanContent(fullContent), toggleActions }
            : m
        )
      );
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      await streamChat(userMessage.content);
    } catch (error) {
      console.error('AI Chat error:', error);
      toast({
        variant: 'destructive',
        title: t('error'),
        description: error instanceof Error ? error.message : t('genericError'),
      });
      // Remove the empty assistant message on error
      setMessages(prev => prev.filter(m => m.content !== ''));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickSuggestion = (labelKey: string) => {
    setInput(t(labelKey));
    inputRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-[400px] border rounded-lg bg-background/50">
      {/* Messages area */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          <AnimatePresence>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "flex gap-3",
                  message.role === 'user' ? (isRTL ? 'flex-row' : 'flex-row-reverse') : 'flex-row'
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                  message.role === 'assistant' 
                    ? "bg-primary/20 text-primary" 
                    : "bg-secondary text-secondary-foreground"
                )}>
                  {message.role === 'assistant' ? (
                    <Sparkles className="w-4 h-4" />
                  ) : (
                    <User className="w-4 h-4" />
                  )}
                </div>
                <div className="flex flex-col gap-2 max-w-[80%]">
                  <div className={cn(
                    "rounded-lg p-3",
                    message.role === 'assistant' 
                      ? "bg-muted" 
                      : "bg-primary text-primary-foreground"
                  )}>
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    <span className="text-[10px] opacity-60 mt-1 block">
                      {message.timestamp.toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  
                  {/* Apply button for toggle actions */}
                  {message.toggleActions && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="self-start gap-2"
                      onClick={() => applyToggleActions(message.toggleActions!)}
                    >
                      <Check className="w-3 h-3" />
                      {t('apply_changes')}
                    </Button>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-3"
            >
              <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="bg-muted rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">{t('thinking')}...</span>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </ScrollArea>

      {/* Quick suggestions */}
      {messages.length <= 1 && (
        <div className="px-4 py-2 border-t flex gap-2 flex-wrap">
          {quickSuggestions.map((suggestion) => (
            <Badge
              key={suggestion.labelKey}
              variant="outline"
              className="cursor-pointer hover:bg-primary/10 transition-colors"
              onClick={() => handleQuickSuggestion(suggestion.labelKey)}
            >
              <suggestion.icon className="w-3 h-3 mr-1" />
              {t(suggestion.labelKey)}
            </Badge>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="p-4 border-t flex gap-2">
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={t('pdf_ai_placeholder')}
          disabled={isLoading}
          className="flex-1"
        />
        <Button 
          size="icon" 
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default PdfAIAgent;
