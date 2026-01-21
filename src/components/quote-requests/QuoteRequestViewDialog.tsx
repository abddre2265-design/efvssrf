import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { QuoteRequest, QuoteRequestItem, QuoteRequestMessage } from './types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { User, Building2, Mail, Phone, MapPin, MessageSquare, Package, Clock, Check, X } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface QuoteRequestViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: QuoteRequest | null;
  items: QuoteRequestItem[];
  messages: QuoteRequestMessage[];
}

export const QuoteRequestViewDialog: React.FC<QuoteRequestViewDialogProps> = ({
  open,
  onOpenChange,
  request,
  items,
  messages,
}) => {
  const { isRTL } = useLanguage();

  if (!request) return null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-200"><Clock className="mr-1 h-3 w-3" />En attente</Badge>;
      case 'processing':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-200"><Clock className="mr-1 h-3 w-3" />En cours</Badge>;
      case 'completed':
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200"><Check className="mr-1 h-3 w-3" />Terminé</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-200"><X className="mr-1 h-3 w-3" />Rejeté</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getClientName = () => {
    if (request.company_name) return request.company_name;
    if (request.first_name || request.last_name) {
      return `${request.first_name || ''} ${request.last_name || ''}`.trim();
    }
    return 'Client inconnu';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-3">
              <span>Demande {request.request_number}</span>
              {getStatusBadge(request.status)}
            </DialogTitle>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)]">
          <div className="space-y-6 pr-4">
            {/* Client Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  {request.company_name ? (
                    <Building2 className="h-4 w-4" />
                  ) : (
                    <User className="h-4 w-4" />
                  )}
                  Informations client
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Nom</p>
                    <p className="font-medium">{getClientName()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Type</p>
                    <p className="font-medium">{request.client_type}</p>
                  </div>
                  {request.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{request.email}</span>
                    </div>
                  )}
                  {request.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{request.phone_prefix} {request.phone}</span>
                    </div>
                  )}
                  {(request.address || request.governorate) && (
                    <div className="col-span-2 flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <span>
                        {[request.address, request.governorate, request.postal_code, request.country]
                          .filter(Boolean)
                          .join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Extracted Items */}
            {items.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Produits/Services demandés
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {items.map((item, index) => (
                      <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-medium">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{item.description}</p>
                          {item.quantity && (
                            <p className="text-sm text-muted-foreground">Quantité: {item.quantity}</p>
                          )}
                          {item.notes && (
                            <p className="text-sm text-muted-foreground mt-1">{item.notes}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* AI Summary */}
            {request.ai_extracted_needs && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Résumé de la demande</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{request.ai_extracted_needs}</p>
                </CardContent>
              </Card>
            )}

            {/* Conversation */}
            {messages.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Historique de la conversation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`p-3 rounded-lg ${
                          message.role === 'user'
                            ? 'bg-primary/10 ml-8'
                            : 'bg-muted mr-8'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium">
                            {message.role === 'user' ? 'Client' : 'Assistant IA'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(message.created_at), 'HH:mm', { locale: fr })}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
