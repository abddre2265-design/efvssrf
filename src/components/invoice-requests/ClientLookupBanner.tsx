import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { User, Building2, CheckCircle2, UserPlus, Search, Loader2, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ClientLookupResult, LookedUpClient, PendingClientData } from '@/hooks/useClientLookup';

interface ClientLookupBannerProps {
  isLooking: boolean;
  lookupResult: ClientLookupResult | null;
  onReplaceClient?: () => void;
  onRetryLookup?: () => void;
  showReplaceButton?: boolean;
}

export const ClientLookupBanner: React.FC<ClientLookupBannerProps> = ({
  isLooking,
  lookupResult,
  onReplaceClient,
  onRetryLookup,
  showReplaceButton = true,
}) => {
  const { t, isRTL } = useLanguage();

  const getClientDisplayName = (client: LookedUpClient | PendingClientData | null): string => {
    if (!client) return '-';
    return client.company_name || 
      `${client.first_name || ''} ${client.last_name || ''}`.trim() || 
      '-';
  };

  const getClientIcon = (clientType: string | undefined) => {
    if (clientType === 'business_local' || clientType === 'company') {
      return <Building2 className="h-5 w-5" />;
    }
    return <User className="h-5 w-5" />;
  };

  if (isLooking) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
      >
        <Alert className="border-primary/30 bg-primary/5">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <AlertTitle className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            {t('client_lookup_in_progress')}
          </AlertTitle>
          <AlertDescription className="text-muted-foreground">
            {t('client_lookup_description')}
          </AlertDescription>
        </Alert>
      </motion.div>
    );
  }

  if (!lookupResult) return null;

  // Client found
  if (lookupResult.found && lookupResult.client) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
      >
        <Alert className="border-green-500/30 bg-green-500/5">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <div className="flex-1">
            <AlertTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
              {t('client_found_auto_assigned')}
              <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                {t('existing_client')}
              </Badge>
            </AlertTitle>
            <AlertDescription>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-green-500/10">
                    {getClientIcon(lookupResult.client.client_type)}
                  </div>
                  <div>
                    <div className="font-medium">{getClientDisplayName(lookupResult.client)}</div>
                    <div className="text-sm text-muted-foreground font-mono">
                      {lookupResult.client.identifier_value}
                    </div>
                  </div>
                </div>
                {showReplaceButton && onReplaceClient && (
                  <Button variant="outline" size="sm" onClick={onReplaceClient}>
                    <RefreshCw className="h-4 w-4 mr-1" />
                    {t('replace_client')}
                  </Button>
                )}
              </div>
            </AlertDescription>
          </div>
        </Alert>
      </motion.div>
    );
  }

  // Client not found - will be created
  if (lookupResult.isNewClient && lookupResult.pendingClient) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
      >
        <Alert className="border-blue-500/30 bg-blue-500/5">
          <UserPlus className="h-5 w-5 text-blue-600" />
          <div className="flex-1">
            <AlertTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
              {t('client_not_found_will_create')}
              <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">
                {t('new_client')}
              </Badge>
            </AlertTitle>
            <AlertDescription>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-blue-500/10">
                    {getClientIcon(lookupResult.pendingClient.client_type)}
                  </div>
                  <div>
                    <div className="font-medium">{getClientDisplayName(lookupResult.pendingClient)}</div>
                    <div className="text-sm text-muted-foreground font-mono">
                      {lookupResult.pendingClient.identifier_value}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {t('client_created_on_validation')}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {onRetryLookup && (
                    <Button variant="ghost" size="sm" onClick={onRetryLookup}>
                      <Search className="h-4 w-4 mr-1" />
                      {t('retry_search')}
                    </Button>
                  )}
                  {showReplaceButton && onReplaceClient && (
                    <Button variant="outline" size="sm" onClick={onReplaceClient}>
                      <RefreshCw className="h-4 w-4 mr-1" />
                      {t('select_existing')}
                    </Button>
                  )}
                </div>
              </div>
            </AlertDescription>
          </div>
        </Alert>
      </motion.div>
    );
  }

  return null;
};
