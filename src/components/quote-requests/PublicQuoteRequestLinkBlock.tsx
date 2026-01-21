import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Link, Copy, RefreshCw, Check, ExternalLink, FileQuestion } from 'lucide-react';
import { QuoteRequestLink } from './types';

interface PublicQuoteRequestLinkBlockProps {
  organizationId: string;
}

export const PublicQuoteRequestLinkBlock: React.FC<PublicQuoteRequestLinkBlockProps> = ({
  organizationId,
}) => {
  const { t, isRTL } = useLanguage();
  const [link, setLink] = useState<QuoteRequestLink | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const generateToken = () => {
    return crypto.randomUUID().replace(/-/g, '');
  };

  const generateAccessCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  useEffect(() => {
    loadLink();
  }, [organizationId]);

  const loadLink = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('quote_request_links')
        .select('*')
        .eq('organization_id', organizationId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      setLink(data as QuoteRequestLink | null);
    } catch (error) {
      console.error('Error loading quote request link:', error);
      toast.error('Erreur lors du chargement du lien');
    } finally {
      setIsLoading(false);
    }
  };

  const createLink = async () => {
    setIsSaving(true);
    try {
      const newLink = {
        organization_id: organizationId,
        access_token: generateToken(),
        access_code: generateAccessCode(),
        is_active: true,
      };

      const { data, error } = await supabase
        .from('quote_request_links')
        .insert(newLink)
        .select()
        .single();

      if (error) throw error;
      setLink(data as QuoteRequestLink);
      toast.success('Lien créé avec succès');
    } catch (error) {
      console.error('Error creating link:', error);
      toast.error('Erreur lors de la création du lien');
    } finally {
      setIsSaving(false);
    }
  };

  const regenerateToken = async () => {
    if (!link) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('quote_request_links')
        .update({ 
          access_token: generateToken(),
          access_code: generateAccessCode(),
        })
        .eq('id', link.id);

      if (error) throw error;
      await loadLink();
      toast.success('Lien régénéré avec succès');
    } catch (error) {
      console.error('Error regenerating link:', error);
      toast.error('Erreur lors de la régénération du lien');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActive = async () => {
    if (!link) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('quote_request_links')
        .update({ is_active: !link.is_active })
        .eq('id', link.id);

      if (error) throw error;
      setLink({ ...link, is_active: !link.is_active });
      toast.success(link.is_active ? 'Lien désactivé' : 'Lien activé');
    } catch (error) {
      console.error('Error toggling link:', error);
      toast.error('Erreur lors de la modification du lien');
    } finally {
      setIsSaving(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Copié dans le presse-papier');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Erreur lors de la copie');
    }
  };

  const getPublicUrl = () => {
    if (!link) return '';
    const baseUrl = window.location.origin;
    return `${baseUrl}/quote-request/${link.access_token}`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card dir={isRTL ? 'rtl' : 'ltr'}>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <FileQuestion className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Lien public de demande de devis</CardTitle>
            <CardDescription>
              Partagez ce lien avec vos clients pour qu'ils puissent soumettre des demandes de devis
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!link ? (
          <Button onClick={createLink} disabled={isSaving}>
            <Link className="mr-2 h-4 w-4" />
            Créer le lien public
          </Button>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label htmlFor="link-active">Lien actif</Label>
                <Switch
                  id="link-active"
                  checked={link.is_active}
                  onCheckedChange={toggleActive}
                  disabled={isSaving}
                />
              </div>
              <Badge variant={link.is_active ? 'default' : 'secondary'}>
                {link.is_active ? 'Actif' : 'Inactif'}
              </Badge>
            </div>

            <div className="space-y-2">
              <Label>URL du lien public</Label>
              <div className="flex gap-2">
                <Input 
                  value={getPublicUrl()} 
                  readOnly 
                  className="bg-muted font-mono text-sm"
                />
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => copyToClipboard(getPublicUrl())}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => window.open(getPublicUrl(), '_blank')}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Code d'accès</Label>
              <div className="flex gap-2">
                <Input 
                  value={link.access_code} 
                  readOnly 
                  className="bg-muted font-mono text-lg tracking-widest w-40"
                />
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => copyToClipboard(link.access_code)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Les clients devront entrer ce code pour accéder au formulaire
              </p>
            </div>

            <Button 
              variant="outline" 
              onClick={regenerateToken} 
              disabled={isSaving}
              className="w-full"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Régénérer le lien et le code
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};
