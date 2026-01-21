import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { QuoteRequest } from './types';
import { formatCurrency } from '@/components/invoices/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Eye, MoreHorizontal, Check, X, Clock, Search, User, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr, enUS, ar } from 'date-fns/locale';

interface QuoteRequestTableProps {
  requests: QuoteRequest[];
  isLoading: boolean;
  onView: (request: QuoteRequest) => void;
  onStatusChange: (request: QuoteRequest, status: 'processing' | 'completed' | 'rejected') => void;
}

export const QuoteRequestTable: React.FC<QuoteRequestTableProps> = ({
  requests,
  isLoading,
  onView,
  onStatusChange,
}) => {
  const { t, language, isRTL } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');

  const getLocale = () => {
    switch (language) {
      case 'ar': return ar;
      case 'en': return enUS;
      default: return fr;
    }
  };

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

  const getClientName = (request: QuoteRequest) => {
    if (request.company_name) return request.company_name;
    if (request.first_name || request.last_name) {
      return `${request.first_name || ''} ${request.last_name || ''}`.trim();
    }
    return 'Client inconnu';
  };

  const filteredRequests = requests.filter(request => {
    const searchLower = searchQuery.toLowerCase();
    const clientName = getClientName(request).toLowerCase();
    const requestNumber = request.request_number.toLowerCase();
    const email = (request.email || '').toLowerCase();
    return (
      clientName.includes(searchLower) ||
      requestNumber.includes(searchLower) ||
      email.includes(searchLower)
    );
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>N° Demande</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRequests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Aucune demande de devis trouvée
                </TableCell>
              </TableRow>
            ) : (
              filteredRequests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell className="font-mono text-sm">
                    {request.request_number}
                  </TableCell>
                  <TableCell>
                    {format(new Date(request.request_date), 'dd/MM/yyyy HH:mm', { locale: getLocale() })}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {request.company_name ? (
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <User className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span>{getClientName(request)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {request.email && <div className="text-muted-foreground">{request.email}</div>}
                      {request.phone && <div className="text-muted-foreground">{request.phone_prefix} {request.phone}</div>}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(request.status)}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onView(request)}>
                          <Eye className="mr-2 h-4 w-4" />
                          Voir détails
                        </DropdownMenuItem>
                        {request.status === 'pending' && (
                          <DropdownMenuItem onClick={() => onStatusChange(request, 'processing')}>
                            <Clock className="mr-2 h-4 w-4" />
                            Marquer en cours
                          </DropdownMenuItem>
                        )}
                        {(request.status === 'pending' || request.status === 'processing') && (
                          <>
                            <DropdownMenuItem onClick={() => onStatusChange(request, 'completed')}>
                              <Check className="mr-2 h-4 w-4" />
                              Marquer terminé
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onStatusChange(request, 'rejected')} className="text-destructive">
                              <X className="mr-2 h-4 w-4" />
                              Rejeter
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
