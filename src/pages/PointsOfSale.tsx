import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { StoreTable } from '@/components/stores/StoreTable';
import { StoreCreateDialog } from '@/components/stores/StoreCreateDialog';
import { StoreEditDialog } from '@/components/stores/StoreEditDialog';
import { Store } from '@/components/stores/types';
import { Plus, Search, MapPin, Loader2 } from 'lucide-react';

const PointsOfSale: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const { toast } = useToast();
  const [stores, setStores] = useState<Store[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);

  const fetchStores = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: org } = await supabase
        .from('organizations')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!org) return;

      let query = supabase
        .from('stores')
        .select('*')
        .eq('organization_id', org.id)
        .order('created_at', { ascending: false });

      if (!showInactive) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;

      if (error) throw error;
      setStores((data || []) as Store[]);
    } catch (error) {
      console.error('Error fetching stores:', error);
      toast({
        title: t('error'),
        description: t('genericError'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStores();
  }, [showInactive]);

  const handleEdit = (store: Store) => {
    setSelectedStore(store);
    setEditDialogOpen(true);
  };

  const handleToggleActive = async (store: Store) => {
    try {
      const { error } = await supabase
        .from('stores')
        .update({ is_active: !store.is_active })
        .eq('id', store.id);

      if (error) throw error;

      toast({
        title: t('success'),
        description: store.is_active ? t('storeDeactivated') : t('storeActivated'),
      });

      fetchStores();
    } catch (error: any) {
      console.error('Error toggling store status:', error);
      toast({
        title: t('error'),
        description: error.message || t('genericError'),
        variant: 'destructive',
      });
    }
  };

  const filteredStores = stores.filter(store =>
    store.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    store.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    store.city?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MapPin className="h-6 w-6 text-primary" />
            {t('points_of_sale')}
          </h1>
          <p className="text-muted-foreground">{t('pointsOfSaleDescription')}</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          {t('addStore')}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground ${isRTL ? 'right-3' : 'left-3'}`} />
          <Input
            placeholder={t('searchStores')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={isRTL ? 'pr-10' : 'pl-10'}
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="show-inactive"
            checked={showInactive}
            onCheckedChange={setShowInactive}
          />
          <Label htmlFor="show-inactive" className="text-sm cursor-pointer">
            {t('showInactive')}
          </Label>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <StoreTable
          stores={filteredStores}
          onEdit={handleEdit}
          onToggleActive={handleToggleActive}
        />
      )}

      {/* Dialogs */}
      <StoreCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={fetchStores}
      />

      <StoreEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        store={selectedStore}
        onSuccess={fetchStores}
      />
    </motion.div>
  );
};

export default PointsOfSale;
