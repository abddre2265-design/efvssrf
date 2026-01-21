import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bot, 
  X, 
  Send, 
  Sparkles, 
  ChevronDown,
  Loader2,
  Navigation,
  History,
  Trash2,
  Mic,
  MicOff,
  Volume2,
  VolumeX
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useDashboardStats } from '@/hooks/useDashboardStats';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  navigate?: string;
}

const CHAT_URL = `https://uzrkeuweietxkwubhbym.supabase.co/functions/v1/ai-assistant`;
const TTS_URL = `https://uzrkeuweietxkwubhbym.supabase.co/functions/v1/elevenlabs-tts`;
const ANON_KEY = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6cmtldXdlaWV0eGt3dWJoYnltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3NzU3MDMsImV4cCI6MjA4NDM1MTcwM30.gs9xYrFUdnFJnBGmfrJv2vlwsI8hWCjwjbUJhJRlF9g`;

export const AIFloatingAgent: React.FC = () => {
  const { language, isRTL } = useLanguage();
  const navigate = useNavigate();
  const stats = useDashboardStats();
  
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  
  // Voice states
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [speechSupported, setSpeechSupported] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Check for speech recognition support
  useEffect(() => {
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setSpeechSupported(!!SpeechRecognitionAPI);
  }, []);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, isMinimized]);

  // Load conversation history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('ai-agent-history');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setMessages(parsed.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })));
      } catch (e) {
        console.error('Failed to load AI history');
      }
    }
  }, []);

  // Save conversation history
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('ai-agent-history', JSON.stringify(messages.slice(-50)));
    }
  }, [messages]);

  const getWelcomeMessage = useCallback(() => {
    const messages = {
      fr: "Bonjour ! Je suis votre assistant IA. Comment puis-je vous aider aujourd'hui ? 🚀",
      en: "Hello! I'm your AI assistant. How can I help you today? 🚀",
      ar: "مرحبًا! أنا مساعدك الذكي. كيف يمكنني مساعدتك اليوم؟ 🚀"
    };
    return messages[language] || messages.fr;
  }, [language]);

  const handleOpen = () => {
    setIsOpen(true);
    setIsMinimized(false);
    
    if (messages.length === 0) {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: getWelcomeMessage(),
        timestamp: new Date()
      }]);
    }
  };

  const handleNavigate = (pageId: string) => {
    if (pageId === 'home') {
      navigate('/dashboard');
    } else {
      navigate(`/dashboard/${pageId}`);
    }
    setIsMinimized(true);
  };

  const extractNavigateCommand = (content: string): string | null => {
    const match = content.match(/\{"navigate":\s*"([^"]+)"\}/);
    return match ? match[1] : null;
  };

  const cleanContent = (content: string): string => {
    return content.replace(/\{"navigate":\s*"[^"]+"\}/g, '').trim();
  };

  // Text-to-Speech function using ElevenLabs
  const speakText = async (text: string) => {
    if (!voiceEnabled || !text.trim()) return;
    
    try {
      setIsSpeaking(true);
      
      const response = await fetch(TTS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify({ text: text.slice(0, 500) }), // Limit text length
      });

      if (!response.ok) {
        throw new Error('TTS request failed');
      }

      const data = await response.json();
      
      if (data.audioContent) {
        const audioUrl = `data:audio/mpeg;base64,${data.audioContent}`;
        
        if (audioRef.current) {
          audioRef.current.pause();
        }
        
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        
        audio.onended = () => setIsSpeaking(false);
        audio.onerror = () => setIsSpeaking(false);
        
        await audio.play();
      }
    } catch (error) {
      console.error('TTS error:', error);
      setIsSpeaking(false);
    }
  };

  // Stop speaking
  const stopSpeaking = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsSpeaking(false);
  };

  // Speech recognition
  const startListening = () => {
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;

    stopSpeaking(); // Stop any ongoing speech

    const recognition = new SpeechRecognitionAPI();
    recognitionRef.current = recognition;

    recognition.lang = language === 'ar' ? 'ar-SA' : language === 'en' ? 'en-US' : 'fr-FR';
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onstart = () => setIsListening(true);
    
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(result => result[0].transcript)
        .join('');
      setInputValue(transcript);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      // Auto-send if we have text
      if (inputValue.trim()) {
        setTimeout(() => handleSend(), 100);
      }
    };

    recognition.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  const streamChat = async (userMessage: string) => {
    setIsLoading(true);
    
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMsg]);
    
    let assistantContent = '';
    const assistantId = (Date.now() + 1).toString();
    
    try {
      const context = {
        invoicesCount: stats.invoicesCount,
        clientsCount: stats.clientsCount,
        productsCount: stats.productsCount,
        suppliersCount: stats.suppliersCount,
        unpaidAmount: stats.unpaidAmount,
        pendingPurchases: stats.pendingPurchases,
      };

      const response = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify({
          messages: messages.filter(m => m.id !== 'welcome').map(m => ({
            role: m.role,
            content: m.content
          })).concat([{ role: 'user', content: userMessage }]),
          language,
          context
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'AI request failed');
      }

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let streamDone = false;

      setMessages(prev => [...prev, {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: new Date()
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
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              setMessages(prev => prev.map(m => 
                m.id === assistantId 
                  ? { ...m, content: assistantContent }
                  : m
              ));
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Check for navigation command
      const navCommand = extractNavigateCommand(assistantContent);
      const cleanedContent = cleanContent(assistantContent);
      
      if (navCommand) {
        setMessages(prev => prev.map(m => 
          m.id === assistantId 
            ? { ...m, content: cleanedContent, navigate: navCommand }
            : m
        ));
      }

      // Speak the response if voice is enabled
      if (voiceEnabled && cleanedContent) {
        speakText(cleanedContent);
      }

    } catch (error) {
      console.error('AI chat error:', error);
      const errorMessage = language === 'fr' 
        ? "Désolé, une erreur s'est produite. Réessayez." 
        : language === 'ar'
        ? "عذرًا، حدث خطأ. حاول مرة أخرى."
        : "Sorry, an error occurred. Please try again.";
      
      setMessages(prev => [...prev, {
        id: assistantId,
        role: 'assistant',
        content: errorMessage,
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = () => {
    if (!inputValue.trim() || isLoading) return;
    streamChat(inputValue.trim());
    setInputValue('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearHistory = () => {
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: getWelcomeMessage(),
      timestamp: new Date()
    }]);
    localStorage.removeItem('ai-agent-history');
  };

  const placeholders = {
    fr: "Posez votre question...",
    en: "Ask your question...",
    ar: "اطرح سؤالك..."
  };

  return (
    <>
      {/* Hidden audio element */}
      <audio ref={audioRef} className="hidden" />
      
      {/* Floating Bubble Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleOpen}
            className="fixed bottom-6 right-6 z-50 w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center ai-agent-bubble cursor-pointer"
          >
            {/* Halo effect */}
            <div className="absolute inset-0 rounded-full bg-primary/20 ai-agent-halo" />
            
            {/* Particles */}
            <div className="absolute inset-0">
              {[...Array(3)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-2 h-2 bg-primary/60 rounded-full ai-particle"
                  style={{
                    left: `${30 + i * 20}%`,
                    animationDelay: `${i * 0.5}s`
                  }}
                />
              ))}
            </div>
            
            <Bot className="w-8 h-8 text-primary-foreground relative z-10" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ 
              opacity: 1, 
              y: 0, 
              scale: 1,
              height: isMinimized ? 'auto' : '500px'
            }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={cn(
              "fixed bottom-6 z-50 w-96 rounded-2xl overflow-hidden",
              "bg-card/95 backdrop-blur-2xl border border-border/50",
              "shadow-2xl",
              isRTL ? "left-6" : "right-6"
            )}
            style={{
              boxShadow: '0 0 40px hsl(var(--primary) / 0.2), 0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}
          >
            {/* Header */}
            <div className="relative bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 p-4 border-b border-border/50">
              <div className={cn(
                "absolute inset-0",
                (isLoading || isSpeaking) && "ai-agent-thinking opacity-30"
              )} />
              
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <motion.div 
                    className="relative"
                    animate={isLoading ? { rotate: 360 } : isSpeaking ? { scale: [1, 1.1, 1] } : {}}
                    transition={{ 
                      duration: isLoading ? 2 : 0.5, 
                      repeat: isLoading || isSpeaking ? Infinity : 0, 
                      ease: 'linear' 
                    }}
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                      {isLoading ? (
                        <Loader2 className="w-5 h-5 text-primary-foreground animate-spin" />
                      ) : isSpeaking ? (
                        <Volume2 className="w-5 h-5 text-primary-foreground" />
                      ) : isListening ? (
                        <Mic className="w-5 h-5 text-primary-foreground animate-pulse" />
                      ) : (
                        <Sparkles className="w-5 h-5 text-primary-foreground" />
                      )}
                    </div>
                    {(isLoading || isSpeaking) && (
                      <motion.div
                        className="absolute inset-0 rounded-full border-2 border-primary/50"
                        animate={{ scale: [1, 1.5], opacity: [1, 0] }}
                        transition={{ duration: 1, repeat: Infinity }}
                      />
                    )}
                  </motion.div>
                  
                  <div>
                    <h3 className="font-bold text-foreground">
                      {language === 'fr' ? 'Assistant IA' : language === 'ar' ? 'المساعد الذكي' : 'AI Assistant'}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {isLoading 
                        ? (language === 'fr' ? 'Réflexion...' : language === 'ar' ? 'جاري التفكير...' : 'Thinking...')
                        : isSpeaking
                        ? (language === 'fr' ? 'Parle...' : language === 'ar' ? 'يتكلم...' : 'Speaking...')
                        : isListening
                        ? (language === 'fr' ? 'Écoute...' : language === 'ar' ? 'يستمع...' : 'Listening...')
                        : (language === 'fr' ? 'En ligne' : language === 'ar' ? 'متصل' : 'Online')
                      }
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-1">
                  {/* Voice toggle */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-8 w-8",
                      voiceEnabled ? "text-primary" : "text-muted-foreground"
                    )}
                    onClick={() => {
                      if (isSpeaking) stopSpeaking();
                      setVoiceEnabled(!voiceEnabled);
                    }}
                    title={voiceEnabled ? 'Désactiver la voix' : 'Activer la voix'}
                  >
                    {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowHistory(!showHistory)}
                  >
                    <History className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={() => setIsMinimized(!isMinimized)}
                  >
                    <ChevronDown className={cn("w-4 h-4 transition-transform", isMinimized && "rotate-180")} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      stopSpeaking();
                      stopListening();
                      setIsOpen(false);
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Messages */}
            <AnimatePresence>
              {!isMinimized && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                >
                  {/* Stats Bar */}
                  {!stats.isLoading && (
                    <div className="px-4 py-2 bg-muted/30 border-b border-border/30 flex items-center gap-3 text-xs text-muted-foreground overflow-x-auto">
                      <span className="flex items-center gap-1 whitespace-nowrap">
                        📊 {stats.invoicesCount} {language === 'fr' ? 'factures' : language === 'ar' ? 'فواتير' : 'invoices'}
                      </span>
                      <span className="flex items-center gap-1 whitespace-nowrap">
                        👥 {stats.clientsCount} {language === 'fr' ? 'clients' : language === 'ar' ? 'عملاء' : 'clients'}
                      </span>
                      <span className="flex items-center gap-1 whitespace-nowrap">
                        💰 {stats.unpaidAmount.toFixed(2)} TND
                      </span>
                    </div>
                  )}

                  {/* History Panel */}
                  {showHistory && (
                    <div className="p-3 border-b border-border/50 bg-muted/30">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">
                          {language === 'fr' ? 'Historique' : language === 'ar' ? 'السجل' : 'History'}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-destructive hover:text-destructive"
                          onClick={clearHistory}
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          {language === 'fr' ? 'Effacer' : language === 'ar' ? 'مسح' : 'Clear'}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {messages.length - 1} {language === 'fr' ? 'messages' : language === 'ar' ? 'رسائل' : 'messages'}
                      </p>
                    </div>
                  )}
                  
                  <ScrollArea className="h-64 p-4">
                    <div className="space-y-4">
                      {messages.map((message) => (
                        <motion.div
                          key={message.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={cn(
                            "flex",
                            message.role === 'user' ? (isRTL ? 'justify-start' : 'justify-end') : (isRTL ? 'justify-end' : 'justify-start')
                          )}
                        >
                          <div className={cn(
                            "max-w-[85%] rounded-2xl px-4 py-2.5",
                            message.role === 'user' 
                              ? "bg-primary text-primary-foreground rounded-br-sm" 
                              : "bg-muted text-foreground rounded-bl-sm"
                          )}>
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                            
                            {/* Navigation button */}
                            {message.navigate && (
                              <Button
                                size="sm"
                                variant="secondary"
                                className="mt-2 h-7 text-xs"
                                onClick={() => handleNavigate(message.navigate!)}
                              >
                                <Navigation className="w-3 h-3 mr-1" />
                                {language === 'fr' ? 'Aller' : language === 'ar' ? 'اذهب' : 'Go'}
                              </Button>
                            )}
                          </div>
                        </motion.div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>

                  {/* Input */}
                  <div className="p-4 border-t border-border/50 bg-card/50">
                    <div className="flex gap-2">
                      {/* Microphone button */}
                      {speechSupported && (
                        <Button
                          size="icon"
                          variant={isListening ? "default" : "outline"}
                          onClick={isListening ? stopListening : startListening}
                          disabled={isLoading}
                          className={cn(
                            "shrink-0",
                            isListening && "bg-red-500 hover:bg-red-600 animate-pulse"
                          )}
                          title={isListening ? 'Arrêter' : 'Parler'}
                        >
                          {isListening ? (
                            <MicOff className="w-4 h-4" />
                          ) : (
                            <Mic className="w-4 h-4" />
                          )}
                        </Button>
                      )}
                      
                      <Input
                        ref={inputRef}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder={placeholders[language] || placeholders.fr}
                        disabled={isLoading || isListening}
                        className="flex-1 bg-input/50 border-border/50 focus:border-primary/50"
                      />
                      <Button
                        size="icon"
                        onClick={handleSend}
                        disabled={!inputValue.trim() || isLoading}
                        className="bg-primary hover:bg-primary/90"
                      >
                        {isLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                    
                    {/* Quick suggestions */}
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {[
                        language === 'fr' ? 'Factures impayées' : language === 'ar' ? 'الفواتير غير المسددة' : 'Unpaid invoices',
                        language === 'fr' ? 'Créer un client' : language === 'ar' ? 'إنشاء عميل' : 'Create client',
                        language === 'fr' ? 'Aide' : language === 'ar' ? 'مساعدة' : 'Help'
                      ].map((suggestion) => (
                        <button
                          key={suggestion}
                          onClick={() => {
                            setInputValue(suggestion);
                            setTimeout(() => handleSend(), 100);
                          }}
                          disabled={isLoading}
                          className="text-xs px-2.5 py-1 rounded-full bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

