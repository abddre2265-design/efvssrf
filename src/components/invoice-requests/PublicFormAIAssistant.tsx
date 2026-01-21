import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { 
  Bot, 
  X, 
  Send, 
  Loader2, 
  User, 
  CheckCircle2, 
  XCircle,
  Sparkles,
  MessageCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  action?: string;
  clientData?: any;
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

interface PublicFormAIAssistantProps {
  organizationId: string;
  organizationName: string;
  onClientFound: (client: ClientData) => void;
  onClose: () => void;
}

export const PublicFormAIAssistant: React.FC<PublicFormAIAssistantProps> = ({
  organizationId,
  organizationName,
  onClientFound,
  onClose,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [foundClient, setFoundClient] = useState<ClientData | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initial greeting
  useEffect(() => {
    initializeAssistant();
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const initializeAssistant = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('invoice-request-assistant', {
        body: {
          messages: [],
          organizationId,
          organizationName,
          searchIdentifier: null
        }
      });

      if (error) throw error;

      setMessages([{
        role: 'assistant',
        content: data.message || `Bienvenue ! Si vous avez effectué un achat chez "${organizationName}", vous pouvez saisir votre identifiant fiscal (CIN, matricule fiscal ou passeport) pour récupérer automatiquement vos informations.`,
        action: 'greeting'
      }]);
    } catch (error) {
      console.error('Error initializing assistant:', error);
      setMessages([{
        role: 'assistant',
        content: `Bienvenue ! Si vous avez effectué un achat chez "${organizationName}", vous pouvez saisir votre identifiant (CIN, matricule fiscal ou passeport) pour récupérer automatiquement vos informations.`,
        action: 'greeting'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const extractIdentifier = (text: string): string | null => {
    // CIN: 8 digits
    const cinMatch = text.match(/\b\d{8}\b/);
    if (cinMatch) return cinMatch[0];

    // Tax ID formats
    const taxIdMatch = text.match(/\b\d{6,7}[A-Z]?\/[A-Z](?:\/[A-Z](?:\/[A-Z])?(?:\/\d{3})?)?\b/i);
    if (taxIdMatch) return taxIdMatch[0].toUpperCase();

    // If it's a short string that could be an identifier
    const trimmed = text.trim();
    if (trimmed.length >= 6 && trimmed.length <= 20 && !trimmed.includes(' ')) {
      return trimmed;
    }

    return null;
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      // Extract potential identifier from message
      const identifier = extractIdentifier(userMessage);

      const { data, error } = await supabase.functions.invoke('invoice-request-assistant', {
        body: {
          messages: [...messages, { role: 'user', content: userMessage }],
          organizationId,
          organizationName,
          searchIdentifier: identifier
        }
      });

      if (error) throw error;

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.message,
        action: data.action,
        clientData: data.clientData
      };

      setMessages(prev => [...prev, assistantMessage]);

      // If client found, store it for confirmation
      if (data.clientData && (data.action === 'client_found' || data.action === 'confirm_client')) {
        setFoundClient(data.clientData);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Désolé, une erreur s'est produite. Vous pouvez remplir le formulaire manuellement.",
        action: 'error'
      }]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleConfirmClient = () => {
    if (foundClient) {
      onClientFound(foundClient);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Parfait ! Vos informations ont été pré-remplies dans le formulaire. Vous pouvez les vérifier et compléter les détails de votre transaction.",
        action: 'fill_form'
      }]);
      setFoundClient(null);
      setTimeout(() => setIsMinimized(true), 1500);
    }
  };

  const handleRejectClient = () => {
    setFoundClient(null);
    setMessages(prev => [...prev, 
      { role: 'user', content: "Ce n'est pas moi" },
      {
        role: 'assistant',
        content: "Je comprends. Essayez avec un autre format d'identifiant (CIN, matricule fiscal ou passeport), ou vous pouvez remplir le formulaire manuellement.",
        action: 'not_found'
      }
    ]);
  };

  const getClientDisplayName = (client: ClientData) => {
    if (client.company_name) return client.company_name;
    return `${client.first_name || ''} ${client.last_name || ''}`.trim() || 'Client';
  };

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
                <h3 className="font-semibold">Assistant IA</h3>
                <p className="text-xs opacity-80">Récupération automatique</p>
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
                    
                    {/* Client confirmation buttons */}
                    {message.action === 'confirm_client' && foundClient && (
                      <div className="mt-3 p-3 rounded-lg bg-background/50 border">
                        <div className="flex items-center gap-2 mb-2">
                          <User className="h-4 w-4" />
                          <span className="font-medium text-sm">
                            {getClientDisplayName(foundClient)}
                          </span>
                        </div>
                        {foundClient.email && (
                          <p className="text-xs text-muted-foreground">{foundClient.email}</p>
                        )}
                        {foundClient.phone && (
                          <p className="text-xs text-muted-foreground">
                            {foundClient.phone_prefix} {foundClient.phone}
                          </p>
                        )}
                        <div className="flex gap-2 mt-3">
                          <Button
                            size="sm"
                            onClick={handleConfirmClient}
                            className="flex-1"
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Oui, c'est moi
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleRejectClient}
                            className="flex-1"
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Non
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-start"
              >
                <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">Recherche en cours...</span>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="p-4 border-t bg-muted/30">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="flex gap-2"
          >
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Saisissez votre identifiant..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Ou{' '}
            <button
              type="button"
              onClick={onClose}
              className="text-primary underline hover:no-underline"
            >
              remplir manuellement
            </button>
          </p>
        </div>
      </Card>
    </motion.div>
  );
};
