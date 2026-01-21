import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr, enUS, arSA } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  CalendarIcon,
  Loader2,
  CreditCard,
  Banknote,
  Receipt,
  FileText,
  Building2,
  Globe,
  Wallet,
  User,
  Search,
  Check,
  Plus,
} from 'lucide-react';
import { formatCurrency } from '@/components/invoices/types';
import { cn } from '@/lib/utils';

interface Client {
  id: string;
  client_type: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  account_balance: number;
}

interface ClientDepositDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDepositComplete: () => void;
  preselectedClient?: Client | null;
}

const PAYMENT_METHODS = [
  { value: 'cash', icon: Banknote, requiresReference: false },
  { value: 'card', icon: CreditCard, requiresReference: false },
  { value: 'check', icon: Receipt, requiresReference: true },
  { value: 'draft', icon: FileText, requiresReference: true },
  { value: 'iban_transfer', icon: Building2, requiresReference: true },
  { value: 'swift_transfer', icon: Globe, requiresReference: true },
  { value: 'bank_deposit', icon: Wallet, requiresReference: true },
];

export const ClientDepositDialog: React.FC<ClientDepositDialogProps> = ({
  open,
  onOpenChange,
  onDepositComplete,
  preselectedClient,
}) => {
  const { t, language, isRTL } = useLanguage();
  
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [clientSearchOpen, setClientSearchOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  
  // Form state
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [amount, setAmount] = useState<string>('');
  const [depositDate, setDepositDate] = useState<Date>(new Date());
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  const getDateLocale = () => {
    switch (language) {
      case 'ar': return arSA;
      case 'en': return enUS;
      default: return fr;
    }
  };

  // Fetch organization and clients
  useEffect(() => {
    if (open) {
      fetchOrganization();
      fetchClients();
      if (preselectedClient) {
        setSelectedClient(preselectedClient);
      }
    }
  }, [open, preselectedClient]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedClient(preselectedClient || null);
      setAmount('');
      setDepositDate(new Date());
      setPaymentMethod('');
      setReferenceNumber('');
      setNotes('');
      setClientSearch('');
    }
  }, [open, preselectedClient]);

  const fetchOrganization = async () => {
    const { data } = await supabase
      .from('organizations')
      .select('id')
      .maybeSingle();
    
    if (data) {
      setOrganizationId(data.id);
    }
  };

  const fetchClients = async () => {
    setIsLoadingClients(true);
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, client_type, first_name, last_name, company_name, account_balance')
        .eq('status', 'active')
        .order('company_name', { ascending: true });

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setIsLoadingClients(false);
    }
  };

  const getClientName = (client: Client) => {
    if (client.client_type === 'business_local') {
      return client.company_name || t('no_data');
    }
    return [client.first_name, client.last_name].filter(Boolean).join(' ') || t('no_data');
  };

  const filteredClients = clients.filter(client => {
    const name = getClientName(client).toLowerCase();
    return name.includes(clientSearch.toLowerCase());
  });

  const selectedMethod = PAYMENT_METHODS.find(m => m.value === paymentMethod);
  const requiresReference = selectedMethod?.requiresReference || false;

  const parsedAmount = parseFloat(amount) || 0;
  const newBalance = (selectedClient?.account_balance || 0) + parsedAmount;

  const canSave = selectedClient && 
    parsedAmount > 0 && 
    paymentMethod && 
    (!requiresReference || referenceNumber.trim()) && 
    organizationId;

  const handleSave = async () => {
    if (!canSave || !selectedClient || !organizationId) return;

    setIsSaving(true);
    try {
      // Create client account movement
      const { error: movementError } = await supabase
        .from('client_account_movements')
        .insert({
          client_id: selectedClient.id,
          organization_id: organizationId,
          movement_type: 'credit',
          amount: parsedAmount,
          balance_after: newBalance,
          source_type: 'direct_deposit',
          payment_method: paymentMethod,
          reference_number: referenceNumber.trim() || null,
          notes: notes.trim() || null,
          movement_date: format(depositDate, 'yyyy-MM-dd'),
        });

      if (movementError) throw movementError;

      toast.success(t('deposit_saved'));
      onOpenChange(false);
      onDepositComplete();
    } catch (error: any) {
      console.error('Error saving deposit:', error);
      toast.error(t('error_saving_deposit'));
    } finally {
      setIsSaving(false);
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    return t(`payment_method_${method}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            {t('add_client_deposit')}
          </DialogTitle>
          <DialogDescription>
            {t('add_client_deposit_description')}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          <div className="space-y-6 p-1">
            {/* Client Selection */}
            <div className="space-y-2">
              <Label>{t('client')} *</Label>
              <Popover open={clientSearchOpen} onOpenChange={setClientSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between"
                    disabled={!!preselectedClient}
                  >
                    {selectedClient ? (
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span>{getClientName(selectedClient)}</span>
                        <Badge variant="secondary" className="ml-2">
                          {formatCurrency(selectedClient.account_balance, 'TND')}
                        </Badge>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">{t('select_client')}</span>
                    )}
                    <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput 
                      placeholder={t('search_client')} 
                      value={clientSearch}
                      onValueChange={setClientSearch}
                    />
                    <CommandList>
                      <CommandEmpty>
                        {isLoadingClients ? t('loading') : t('no_clients')}
                      </CommandEmpty>
                      <CommandGroup>
                        {filteredClients.map((client) => (
                          <CommandItem
                            key={client.id}
                            value={client.id}
                            onSelect={() => {
                              setSelectedClient(client);
                              setClientSearchOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedClient?.id === client.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex items-center justify-between flex-1">
                              <span>{getClientName(client)}</span>
                              <Badge variant="outline" className="ml-2">
                                {formatCurrency(client.account_balance, 'TND')}
                              </Badge>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Current Balance Display */}
            {selectedClient && (
              <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('current_balance')}</span>
                  <span className="font-medium">
                    {formatCurrency(selectedClient.account_balance, 'TND')}
                  </span>
                </div>
                {parsedAmount > 0 && (
                  <>
                    <div className="flex justify-between text-sm text-green-600">
                      <span>+ {t('deposit')}</span>
                      <span>+{formatCurrency(parsedAmount, 'TND')}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-semibold">
                      <span>{t('new_balance')}</span>
                      <span className="text-green-600">{formatCurrency(newBalance, 'TND')}</span>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Amount & Date Row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('amount')} *</Label>
                <Input
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.000"
                />
              </div>

              <div className="space-y-2">
                <Label>{t('deposit_date')} *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(depositDate, 'dd/MM/yyyy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={depositDate}
                      onSelect={(date) => date && setDepositDate(date)}
                      locale={getDateLocale()}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <Label>{t('payment_method')} *</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue placeholder={t('select_payment_method')} />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((method) => {
                    const Icon = method.icon;
                    return (
                      <SelectItem key={method.value} value={method.value}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {getPaymentMethodLabel(method.value)}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Reference Number */}
            {requiresReference && (
              <div className="space-y-2">
                <Label>{t('reference_number')} *</Label>
                <Input
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder={t('enter_reference_number')}
                />
              </div>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <Label>{t('notes')}</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('deposit_notes_placeholder')}
                rows={3}
              />
            </div>
          </div>
        </ScrollArea>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSave} disabled={!canSave || isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('save_deposit')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
