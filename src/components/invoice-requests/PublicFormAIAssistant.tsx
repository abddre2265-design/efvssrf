import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { 
  X, 
  Send, 
  Loader2, 
  User, 
  CheckCircle2, 
  XCircle,
  Sparkles,
  MessageCircle,
  AlertTriangle,
  Clock
} from 'lucide-react';
import { format } from 'date-fns';
import { fr, enUS, arSA } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ClientData {
  id: string;
  client_type: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  identifier_type: string;
  identifier_value: string;
  country: string;
  governorate: string | null;
  address: string | null;
  postal_code: string | null;
  phone_prefix: string | null;
  phone: string | null;
  whatsapp_prefix: string | null;
  whatsapp: string | null;
  email: string | null;
}

interface PendingRequest {
  id: string;
  request_number: string;
  identifier_value: string;
  status: string;
  created_at: string;
  transaction_number: string;
  total_ttc: number;
  store_id: string | null;
  purchase_date: string;
}

interface PublicFormAIAssistantProps {
  organizationId: string;
  organizationName: string;
  onClientFound: (client: ClientData) => void;
  onPendingRequestsFound: (requests: PendingRequest[]) => void;
  onClose: () => void;
  clientValidated: boolean;
}

type AssistantState = 'greeting' | 'waiting_input' | 'searching' | 'client_found' | 'not_found' | 'confirmed' | 'manual';

export const PublicFormAIAssistant: React.FC<PublicFormAIAssistantProps> = ({
  organizationId,
  organizationName,
  onClientFound,
  onPendingRequestsFound,
  onClose,
  clientValidated,
}) => {
  const { t, language, isRTL } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [foundClient, setFoundClient] = useState<ClientData | null>(null);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const [state, setState] = useState<AssistantState>('greeting');
  const [searchAttempts, setSearchAttempts] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const getDateLocale = () => {
    switch (language) { case 'ar': return arSA; case 'en': return enUS; default: return fr; }
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Initial greeting
  useEffect(() => {
    initializeAssistant();
  }, []);

  const initializeAssistant = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('invoice-request-assistant', {
        body: {
          action: 'greeting',
          organizationId,
          organizationName,
          language,
        }
      });

      if (error) throw error;

      setMessages([{
        role: 'assistant',
        content: data.message
      }]);
      setState('waiting_input');
    } catch (error) {
      console.error('Error initializing assistant:', error);
      setMessages([{
        role: 'assistant',
        content: `${t('welcome_ai_fallback')} « ${organizationName} »${t('ai_fallback_suffix')}`
      }]);
      setState('waiting_input');
    } finally {
      setIsLoading(false);
    }
  };

  const extractIdentifier = (text: string): string | null => {
    const trimmed = text.trim();
    if (trimmed.length >= 6 && trimmed.length <= 30) {
      return trimmed;
    }
    return null;
  };

  const getFormatHelpMessage = (attempts: number): string => {
    if (attempts >= 3) {
      return t('fill_form_manually');
    }

    const formatBlock = `\n\n${t('accepted_formats_title')}\n\n${t('cin_format')}\n\n${t('tax_id_format')}\n\n${t('passport_format')}`;

    if (attempts === 2) {
      return `${t('are_you_foreign_client')}\n\n${formatBlock}\n\n${t('or_fill_manually_hint')}`;
    }

    return `${formatBlock}\n\n${t('please_retry')}`;
  };

  const searchClient = async (identifier: string) => {
    setIsLoading(true);
    setState('searching');
    setPendingRequests([]);

    try {
      const { data, error } = await supabase.functions.invoke('invoice-request-assistant', {
        body: {
          action: 'search',
          organizationId,
          organizationName,
          searchIdentifier: identifier,
          language,
        }
      });

      if (error) throw error;

      // Handle pending requests - open dialog automatically
      if (data.pendingRequests && data.pendingRequests.length > 0) {
        setPendingRequests(data.pendingRequests);
        onPendingRequestsFound(data.pendingRequests);
        const pendingMsg = data.pendingRequests.length === 1
          ? `${t('attention_pending_single')} (N° ${data.pendingRequests[0].request_number}).${t('window_opened_for_details')}`
          : `⚠️ **${t('attention')}:** ${data.pendingRequests.length} ${t('attention_pending_multiple')}${t('window_opened_for_details')}`;
        
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: pendingMsg
        }]);
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.message
      }]);

      if (data.action === 'client_found' && data.clientData) {
        setFoundClient(data.clientData);
        setState('client_found');
      } else {
        const attempts = searchAttempts + 1;
        setSearchAttempts(attempts);
        setState('not_found');
        
        // Show format help with examples
        if (data.showFormatHelp) {
          const formatHelpMessage = getFormatHelpMessage(attempts);
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: formatHelpMessage
          }]);
        }
      }
    } catch (error) {
      console.error('Error searching client:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: t('search_error')
      }]);
      setState('not_found');
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    const identifier = extractIdentifier(userMessage);
    if (identifier) {
      await searchClient(identifier);
    } else {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: t('enter_valid_identifier')
      }]);
    }
  };

  const handleConfirmClient = () => {
    if (foundClient) {
      setState('confirmed');
      setMessages(prev => [...prev, 
        { role: 'user', content: t('yes_its_me') },
        {
          role: 'assistant',
          content: t('perfect_prefilled')
        }
      ]);
      
      // Auto-fill form and minimize after short delay
      setTimeout(() => {
        onClientFound(foundClient);
        setFoundClient(null);
        setTimeout(() => setIsMinimized(true), 1000);
      }, 500);
    }
  };

  const handleRejectClient = () => {
    setFoundClient(null);
    const attempts = searchAttempts + 1;
    setSearchAttempts(attempts);
    setState('not_found');
    
    const formatHelp = getFormatHelpMessage(attempts);
    const message = `${t('i_understand_not_you')}\n\n${formatHelp}`;

    setMessages(prev => [...prev, 
      { role: 'user', content: t('not_me') },
      { role: 'assistant', content: message }
    ]);
  };

  // Close automatically when client is validated externally
  useEffect(() => {
    if (clientValidated && state !== 'confirmed') {
      setState('confirmed');
      setIsMinimized(true);
    }
  }, [clientValidated]);

  const getClientDisplayName = (client: ClientData) => {
    if (client.company_name) return client.company_name;
    return `${client.first_name || ''} ${client.last_name || ''}`.trim() || 'Client';
  };

  // Minimized bubble view
  if (isMinimized) {
    return (
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="fixed bottom-4 right-4 z-50"
      >
        <Button
          onClick={() => setIsMinimized(false)}
          className="h-14 w-14 rounded-full shadow-lg"
          size="icon"
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      className="fixed bottom-4 right-4 z-50 w-[380px] max-w-[calc(100vw-2rem)]"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <Card className="shadow-2xl border-2 border-primary/20 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold">{t('ai_assistant')}</h3>
                <p className="text-xs opacity-80">{t('automatic_recovery')}</p>
              </div>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-primary-foreground hover:bg-white/20"
                onClick={() => setIsMinimized(true)}
              >
                <MessageCircle className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-primary-foreground hover:bg-white/20"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="h-[300px] p-4" ref={scrollRef}>
          <div className="space-y-4">
            <AnimatePresence>
              {messages.map((message, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-md'
                        : 'bg-muted rounded-bl-md'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Pending requests info */}
            {pendingRequests.length > 0 && state !== 'confirmed' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-start"
              >
                <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-muted rounded-bl-md">
                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      <span className="font-medium text-sm text-amber-800 dark:text-amber-200">
                        {pendingRequests.length === 1 
                          ? t('pending_request_detected_single')
                          : `${pendingRequests.length} ${t('pending_requests_detected')}`
                        }
                      </span>
                    </div>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      {t('check_window_for_details')}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Client confirmation card */}
            {state === 'client_found' && foundClient && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-start"
              >
                <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-muted rounded-bl-md">
                  <div className="p-3 rounded-lg bg-background border">
                    <div className="flex items-center gap-2 mb-2">
                      <User className="h-4 w-4 text-primary" />
                      <span className="font-medium text-sm">
                        {getClientDisplayName(foundClient)}
                      </span>
                    </div>
                    {foundClient.email && (
                      <p className="text-xs text-muted-foreground">📧 {foundClient.email}</p>
                    )}
                    {foundClient.phone && (
                      <p className="text-xs text-muted-foreground">
                        📱 {foundClient.phone_prefix} {foundClient.phone}
                      </p>
                    )}
                    {foundClient.address && (
                      <p className="text-xs text-muted-foreground">📍 {foundClient.address}</p>
                    )}
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        onClick={handleConfirmClient}
                        className="flex-1"
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        {t('yes_its_me')}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleRejectClient}
                        className="flex-1"
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        {t('not_me')}
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-start"
              >
                <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">{t('searching_in_progress')}</span>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        {state !== 'client_found' && state !== 'confirmed' && (
          <div className="p-4 border-t bg-muted/30">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex gap-2"
            >
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t('enter_your_identifier')}
                disabled={isLoading}
                className="flex-1"
              />
              <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              {t('or_word')}{' '}
              <button
                type="button"
                onClick={onClose}
                className="text-primary underline hover:no-underline"
              >
                {t('fill_manually')}
              </button>
            </p>
          </div>
        )}

        {/* Confirmed state */}
        {state === 'confirmed' && (
          <div className="p-4 border-t bg-muted/30 text-center">
            <p className="text-sm text-muted-foreground">
              {t('form_prefilled')}
            </p>
          </div>
        )}
      </Card>
    </motion.div>
  );
};
