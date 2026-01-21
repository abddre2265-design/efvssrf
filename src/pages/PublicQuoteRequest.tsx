import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Shield,
  Lock,
  AlertCircle,
  Check,
  Loader2,
  Send,
  User,
  Bot,
  Sparkles,
  FileQuestion,
  CheckCircle2,
  Search,
} from 'lucide-react';
import { ChatMessage, ConfirmedRequest, ExtractedItem } from '@/components/quote-requests/types';
import {
  ClientType,
  IDENTIFIER_TYPES,
  TUNISIA_GOVERNORATES,
  COUNTRY_PHONE_PREFIXES,
  COUNTRIES,
} from '@/components/clients/types';

interface LinkData {
  id: string;
  organization_id: string;
  access_token: string;
  access_code: string;
  is_active: boolean;
}

const PublicQuoteRequest: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  
  // Auth state
  const [isVerifying, setIsVerifying] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [linkData, setLinkData] = useState<LinkData | null>(null);
  const [accessCodeInput, setAccessCodeInput] = useState('');
  const [isCheckingCode, setIsCheckingCode] = useState(false);
  
  // Client form state
  const [clientType, setClientType] = useState<ClientType>('individual_local');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [identifierType, setIdentifierType] = useState('cin');
  const [identifierValue, setIdentifierValue] = useState('');
  const [country, setCountry] = useState('Tunisie');
  const [governorate, setGovernorate] = useState('');
  const [address, setAddress] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [phonePrefix, setPhonePrefix] = useState('+216');
  const [phone, setPhone] = useState('');
  const [whatsappPrefix, setWhatsappPrefix] = useState('+216');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [countrySearch, setCountrySearch] = useState('');
  
  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [confirmedRequest, setConfirmedRequest] = useState<ConfirmedRequest | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Verify token
  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setIsVerifying(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('quote_request_links')
          .select('*')
          .eq('access_token', token)
          .eq('is_active', true)
          .single();

        if (error || !data) {
          setIsVerifying(false);
          return;
        }

        setLinkData(data as LinkData);
        setIsVerifying(false);
      } catch (error) {
        console.error('Error verifying token:', error);
        setIsVerifying(false);
      }
    };

    verifyToken();
  }, [token]);

  // Auto scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Reset identifier type when client type changes
  useEffect(() => {
    const availableTypes = IDENTIFIER_TYPES[clientType];
    if (!availableTypes.includes(identifierType as any)) {
      setIdentifierType(availableTypes[0]);
      setIdentifierValue('');
    }
  }, [clientType]);

  // Reset country for local clients
  useEffect(() => {
    if (clientType !== 'foreign') {
      setCountry('Tunisie');
    }
  }, [clientType]);

  const verifyAccessCode = async () => {
    if (!accessCodeInput.trim() || !linkData) return;
    
    setIsCheckingCode(true);
    
    if (accessCodeInput.toUpperCase() === linkData.access_code.toUpperCase()) {
      setIsAuthorized(true);
      toast.success('Accès autorisé');
      // Start with AI greeting
      setTimeout(() => {
        const greeting: ChatMessage = {
          role: 'assistant',
          content: "Bonjour ! 👋 Je suis votre assistant pour les demandes de devis.\n\nComment puis-je vous aider aujourd'hui ? Décrivez-moi les produits ou services pour lesquels vous souhaitez un devis, et je vous poserai quelques questions pour bien comprendre vos besoins.",
        };
        setMessages([greeting]);
      }, 500);
    } else {
      toast.error('Code incorrect');
    }
    
    setIsCheckingCode(false);
  };

  const streamChat = useCallback(async (newMessages: ChatMessage[]) => {
    setIsStreaming(true);
    
    try {
      const resp = await fetch(`https://uzrkeuweietxkwubhbym.supabase.co/functions/v1/quote-request-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages: newMessages, language: 'fr' }),
      });

      if (!resp.ok || !resp.body) {
        throw new Error('Failed to start stream');
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let assistantContent = '';
      let streamDone = false;

      // Add empty assistant message
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

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
              assistantContent += content;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'assistant', content: assistantContent };
                return updated;
              });
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Check if the response contains a confirmation
      if (assistantContent.includes('CONFIRMED:')) {
        const jsonMatch = assistantContent.match(/CONFIRMED:(\{[\s\S]*\})/);
        if (jsonMatch) {
          try {
            const confirmed = JSON.parse(jsonMatch[1]) as ConfirmedRequest;
            setConfirmedRequest(confirmed);
            // Update the message to remove the JSON part
            const cleanContent = assistantContent.replace(/CONFIRMED:\{[\s\S]*\}/, 
              '✅ J\'ai bien compris votre demande ! Voici le résumé:\n\n' + 
              confirmed.items.map((item, i) => `${i + 1}. ${item.description}${item.quantity ? ` (Quantité: ${item.quantity})` : ''}`).join('\n') +
              '\n\nVeuillez vérifier vos coordonnées ci-dessus et cliquer sur "Envoyer ma demande" pour finaliser.');
            setMessages(prev => {
              const updated = [...prev];
              updated[updated.length - 1] = { role: 'assistant', content: cleanContent };
              return updated;
            });
          } catch (e) {
            console.error('Error parsing confirmed request:', e);
          }
        }
      }
    } catch (error) {
      console.error('Stream error:', error);
      toast.error('Erreur de connexion. Veuillez réessayer.');
      // Remove the empty assistant message
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsStreaming(false);
    }
  }, []);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isStreaming) return;

    const userMessage: ChatMessage = { role: 'user', content: inputMessage.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputMessage('');

    await streamChat(newMessages);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSubmitRequest = async () => {
    if (!confirmedRequest || !linkData) return;

    // Validate client info
    if (clientType === 'individual_local' && (!firstName.trim() || !lastName.trim())) {
      toast.error('Veuillez remplir votre nom et prénom');
      return;
    }
    if (clientType === 'business_local' && !companyName.trim()) {
      toast.error('Veuillez remplir le nom de votre entreprise');
      return;
    }
    if (clientType !== 'foreign' && !governorate) {
      toast.error('Veuillez sélectionner votre gouvernorat');
      return;
    }

    setIsSubmitting(true);

    try {
      // Generate request number
      const now = new Date();
      const requestNumber = `DQ-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${Date.now().toString().slice(-6)}`;

      // Create the quote request
      const { data: request, error: requestError } = await supabase
        .from('quote_requests')
        .insert({
          organization_id: linkData.organization_id,
          request_number: requestNumber,
          client_type: clientType,
          first_name: firstName || null,
          last_name: lastName || null,
          company_name: companyName || null,
          identifier_type: identifierType,
          identifier_value: identifierValue || null,
          country,
          governorate: governorate || null,
          address: address || null,
          postal_code: postalCode || null,
          phone_prefix: phonePrefix,
          phone: phone || null,
          whatsapp_prefix: whatsappPrefix,
          whatsapp: whatsapp || null,
          email: email || null,
          ai_extracted_needs: confirmedRequest.summary,
          status: 'pending',
        })
        .select()
        .single();

      if (requestError) throw requestError;

      // Create items
      if (confirmedRequest.items.length > 0) {
        const items = confirmedRequest.items.map((item, index) => ({
          quote_request_id: request.id,
          item_order: index + 1,
          description: item.description,
          quantity: item.quantity || null,
          notes: item.notes || null,
        }));

        const { error: itemsError } = await supabase
          .from('quote_request_items')
          .insert(items);

        if (itemsError) throw itemsError;
      }

      // Save conversation messages
      const messagesToSave = messages.map(msg => ({
        quote_request_id: request.id,
        role: msg.role,
        content: msg.content,
      }));

      const { error: messagesError } = await supabase
        .from('quote_request_messages')
        .insert(messagesToSave);

      if (messagesError) throw messagesError;

      setIsSubmitted(true);
      toast.success('Votre demande de devis a été envoyée !');
    } catch (error) {
      console.error('Error submitting request:', error);
      toast.error('Erreur lors de l\'envoi de la demande');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredCountries = COUNTRIES.filter(c =>
    c.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const isLocal = clientType !== 'foreign';

  // Loading state
  if (isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Vérification en cours...</p>
        </motion.div>
      </div>
    );
  }

  // Invalid token
  if (!linkData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto p-3 rounded-full bg-destructive/10 w-fit mb-4">
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
              <CardTitle>Lien invalide</CardTitle>
              <CardDescription>
                Ce lien de demande de devis n'est pas valide ou a été désactivé.
              </CardDescription>
            </CardHeader>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Access code verification
  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto p-3 rounded-full bg-primary/10 w-fit mb-4">
                <Shield className="h-8 w-8 text-primary" />
              </div>
              <CardTitle>Demande de devis</CardTitle>
              <CardDescription>
                Entrez le code d'accès pour continuer
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Code d'accès</Label>
                <div className="flex gap-2">
                  <Input
                    value={accessCodeInput}
                    onChange={(e) => setAccessCodeInput(e.target.value.toUpperCase())}
                    placeholder="XXXXXX"
                    className="font-mono text-lg tracking-widest text-center"
                    maxLength={6}
                    onKeyDown={(e) => e.key === 'Enter' && verifyAccessCode()}
                  />
                  <Button onClick={verifyAccessCode} disabled={isCheckingCode}>
                    {isCheckingCode ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Lock className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Success screen
  if (isSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto p-4 rounded-full bg-green-500/10 w-fit mb-4">
                <CheckCircle2 className="h-12 w-12 text-green-500" />
              </div>
              <CardTitle className="text-2xl">Demande envoyée !</CardTitle>
              <CardDescription className="text-base">
                Votre demande de devis a été envoyée avec succès. Nous vous contacterons dans les plus brefs délais.
              </CardDescription>
            </CardHeader>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Main form and chat
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-6"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-4">
            <FileQuestion className="h-5 w-5" />
            <span className="font-medium">Demande de devis</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">Demandez votre devis</h1>
          <p className="text-muted-foreground">
            Remplissez vos coordonnées et discutez avec notre assistant pour décrire vos besoins
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Client Form */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Vos coordonnées
                </CardTitle>
                <CardDescription>
                  Renseignez vos informations pour que nous puissions vous contacter
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px] pr-4">
                  <div className="space-y-6">
                    {/* Client Type */}
                    <div className="space-y-2">
                      <Label>Type de client *</Label>
                      <Select value={clientType} onValueChange={(v: ClientType) => setClientType(v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="individual_local">Particulier (Tunisie)</SelectItem>
                          <SelectItem value="business_local">Entreprise (Tunisie)</SelectItem>
                          <SelectItem value="foreign">Client étranger</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Name Fields */}
                    {clientType === 'individual_local' && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Prénom *</Label>
                          <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label>Nom *</Label>
                          <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
                        </div>
                      </div>
                    )}

                    {clientType === 'business_local' && (
                      <div className="space-y-2">
                        <Label>Raison sociale *</Label>
                        <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
                      </div>
                    )}

                    {clientType === 'foreign' && (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Prénom</Label>
                            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <Label>Nom</Label>
                            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Nom de l'entreprise</Label>
                          <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
                        </div>
                      </>
                    )}

                    {/* Identifier */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Type d'identifiant</Label>
                        <Select value={identifierType} onValueChange={setIdentifierType}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {IDENTIFIER_TYPES[clientType].map((type) => (
                              <SelectItem key={type} value={type}>
                                {type === 'cin' ? 'CIN' : type === 'tax_id' ? 'Matricule fiscal' : type === 'passport' ? 'Passeport' : type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Numéro</Label>
                        <Input value={identifierValue} onChange={(e) => setIdentifierValue(e.target.value)} />
                      </div>
                    </div>

                    {/* Country & Governorate */}
                    {isLocal ? (
                      <div className="space-y-2">
                        <Label>Gouvernorat *</Label>
                        <Select value={governorate} onValueChange={setGovernorate}>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner" />
                          </SelectTrigger>
                          <SelectContent>
                            {TUNISIA_GOVERNORATES.map((gov) => (
                              <SelectItem key={gov} value={gov}>{gov}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label>Pays *</Label>
                        <Select value={country} onValueChange={setCountry}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <div className="p-2">
                              <div className="relative">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                  placeholder="Rechercher..."
                                  value={countrySearch}
                                  onChange={(e) => setCountrySearch(e.target.value)}
                                  className="pl-8"
                                />
                              </div>
                            </div>
                            <ScrollArea className="h-[200px]">
                              {filteredCountries.map((c) => (
                                <SelectItem key={c} value={c}>{c}</SelectItem>
                              ))}
                            </ScrollArea>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Address */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Adresse</Label>
                        <Input value={address} onChange={(e) => setAddress(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Code postal</Label>
                        <Input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
                      </div>
                    </div>

                    {/* Phone */}
                    <div className="space-y-2">
                      <Label>Téléphone</Label>
                      <div className="flex gap-2">
                        <Select value={phonePrefix} onValueChange={setPhonePrefix}>
                          <SelectTrigger className="w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {COUNTRY_PHONE_PREFIXES.map((p) => (
                              <SelectItem key={p.code} value={p.code}>{p.flag} {p.code}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="flex-1"
                          placeholder="12345678"
                        />
                      </div>
                    </div>

                    {/* WhatsApp */}
                    <div className="space-y-2">
                      <Label>WhatsApp</Label>
                      <div className="flex gap-2">
                        <Select value={whatsappPrefix} onValueChange={setWhatsappPrefix}>
                          <SelectTrigger className="w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {COUNTRY_PHONE_PREFIXES.map((p) => (
                              <SelectItem key={p.code} value={p.code}>{p.flag} {p.code}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          value={whatsapp}
                          onChange={(e) => setWhatsapp(e.target.value)}
                          className="flex-1"
                          placeholder="12345678"
                        />
                      </div>
                    </div>

                    {/* Email */}
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="votre@email.com"
                      />
                    </div>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </motion.div>

          {/* AI Chat */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="h-full flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Décrivez vos besoins
                </CardTitle>
                <CardDescription>
                  Discutez avec notre assistant pour nous aider à comprendre exactement ce que vous recherchez
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                {/* Messages */}
                <ScrollArea className="flex-1 h-[450px] pr-4 mb-4">
                  <div className="space-y-4">
                    {messages.map((message, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
                      >
                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                          message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                        }`}>
                          {message.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                        </div>
                        <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                          message.role === 'user' 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-muted'
                        }`}>
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        </div>
                      </motion.div>
                    ))}
                    {isStreaming && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">L'assistant réfléchit...</span>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                </ScrollArea>

                {/* Input */}
                {!confirmedRequest ? (
                  <div className="flex gap-2">
                    <Textarea
                      ref={textareaRef}
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Décrivez les produits ou services souhaités..."
                      className="min-h-[60px] resize-none"
                      disabled={isStreaming}
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={!inputMessage.trim() || isStreaming}
                      size="icon"
                      className="h-auto"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                      <div className="flex items-center gap-2 text-green-600 mb-2">
                        <Check className="h-5 w-5" />
                        <span className="font-medium">Demande prête à être envoyée</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Vérifiez vos coordonnées et cliquez sur le bouton ci-dessous pour envoyer votre demande.
                      </p>
                    </div>
                    <Button
                      onClick={handleSubmitRequest}
                      disabled={isSubmitting}
                      className="w-full"
                      size="lg"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Envoi en cours...
                        </>
                      ) : (
                        <>
                          <Send className="mr-2 h-4 w-4" />
                          Envoyer ma demande
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default PublicQuoteRequest;
