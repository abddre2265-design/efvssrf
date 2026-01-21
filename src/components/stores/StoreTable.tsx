import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useLanguage } from '@/contexts/LanguageContext';
import { Store } from './types';
import { MoreHorizontal, Pencil, Archive, ArchiveRestore, MapPin, ExternalLink, Phone, Mail } from 'lucide-react';
import { motion } from 'framer-motion';

interface StoreTableProps {
  stores: Store[];
  onEdit: (store: Store) => void;
  onToggleActive: (store: Store) => void;
}

export const StoreTable: React.FC<StoreTableProps> = ({
  stores,
  onEdit,
  onToggleActive,
}) => {
  const { t, isRTL } = useLanguage();

  const formatAddress = (store: Store) => {
    const parts = [store.address, store.city, store.governorate, store.postal_code].filter(Boolean);
    return parts.join(', ') || '-';
  };

  return (
    <div className="rounded-md border glass overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className={isRTL ? 'text-right' : ''}>{t('storeName')}</TableHead>
            <TableHead className={isRTL ? 'text-right' : ''}>{t('address')}</TableHead>
            <TableHead className={isRTL ? 'text-right' : ''}>{t('storeContact')}</TableHead>
            <TableHead className={isRTL ? 'text-right' : ''}>{t('googleMapsLink')}</TableHead>
            <TableHead className={isRTL ? 'text-right' : ''}>{t('status')}</TableHead>
            <TableHead className="w-[70px]">{t('actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stores.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                {t('noStoresFound')}
              </TableCell>
            </TableRow>
          ) : (
            stores.map((store, index) => (
              <motion.tr
                key={store.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="group hover:bg-muted/30 transition-colors"
              >
                <TableCell className={`font-medium ${isRTL ? 'text-right' : ''}`}>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    {store.name}
                  </div>
                </TableCell>
                <TableCell className={`${isRTL ? 'text-right' : ''} max-w-xs truncate`}>
                  {formatAddress(store)}
                </TableCell>
                <TableCell className={isRTL ? 'text-right' : ''}>
                  <div className="flex flex-col gap-1">
                    {store.phone && (
                      <div className="flex items-center gap-1 text-sm">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        <span>{store.phone}</span>
                      </div>
                    )}
                    {store.email && (
                      <div className="flex items-center gap-1 text-sm">
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        <span className="truncate max-w-[150px]">{store.email}</span>
                      </div>
                    )}
                    {!store.phone && !store.email && <span className="text-muted-foreground">-</span>}
                  </div>
                </TableCell>
                <TableCell className={isRTL ? 'text-right' : ''}>
                  {store.google_maps_link ? (
                    <a
                      href={store.google_maps_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline text-sm"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {t('viewOnMap')}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className={isRTL ? 'text-right' : ''}>
                  <Badge variant={store.is_active ? 'default' : 'secondary'}>
                    {store.is_active ? t('storeActive') : t('storeInactive')}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
                      <DropdownMenuItem onClick={() => onEdit(store)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        {t('edit')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onToggleActive(store)}>
                        {store.is_active ? (
                          <>
                            <Archive className="h-4 w-4 mr-2" />
                            {t('deactivate')}
                          </>
                        ) : (
                          <>
                            <ArchiveRestore className="h-4 w-4 mr-2" />
                            {t('activateStore')}
                          </>
                        )}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </motion.tr>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};
