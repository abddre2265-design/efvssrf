import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Link2,
  Copy,
  Settings,
  RefreshCw,
  Eye,
  EyeOff,
  Check,
  Loader2,
  ExternalLink,
  Shield,
  FileText,
  AlertCircle
} from 'lucide-react';

interface PublicUploadLink {
  id: string;
  organization_id: string;
  access_token: string;
  access_code: string;
  file_prefix: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const PublicUploadLinkBlock: React.FC = () => {
  const { t } = useLanguage();
  const [linkData, setLinkData] = useState<PublicUploadLink | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Form state
  const [accessCode, setAccessCode] = useState('');
  const [filePrefix, setFilePrefix] = useState('');
  const [isActive, setIsActive] = useState(true);

  const generateToken = () => {
    return Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  };

  const generateCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const fetchLinkData = async () => {
    setIsLoading(true);
    try {
      const { data: org } = await supabase
        .from('organizations')
        .select('id')
        .single();

      if (!org) return;

      const { data, error } = await supabase
        .from('public_upload_links')
        .select('*')
        .eq('organization_id', org.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setLinkData(data as PublicUploadLink);
        setAccessCode(data.access_code);
        setFilePrefix(data.file_prefix || '');
        setIsActive(data.is_active);
      }
    } catch (error) {
      console.error('Error fetching link:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLinkData();
  }, []);

  const createOrUpdateLink = async () => {
    if (!accessCode.trim()) {
      toast.error(t('access_code_required'));
      return;
    }

    setIsSaving(true);
    try {
      const { data: org } = await supabase
        .from('organizations')
        .select('id')
        .single();

      if (!org) throw new Error('No organization found');

      if (linkData) {
        // Update existing
        const { error } = await supabase
          .from('public_upload_links')
          .update({
            access_code: accessCode,
            file_prefix: filePrefix,
            is_active: isActive,
          })
          .eq('id', linkData.id);

        if (error) throw error;
        toast.success(t('link_settings_updated'));
      } else {
        // Create new
        const { error } = await supabase
          .from('public_upload_links')
          .insert({
            organization_id: org.id,
            access_token: generateToken(),
            access_code: accessCode,
            file_prefix: filePrefix,
            is_active: isActive,
          });

        if (error) throw error;
        toast.success(t('link_created'));
      }

      await fetchLinkData();
      setShowSettings(false);
    } catch (error: any) {
      console.error('Error saving link:', error);
      toast.error(error.message || t('error_saving'));
    } finally {
      setIsSaving(false);
    }
  };

  const regenerateToken = async () => {
    if (!linkData) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('public_upload_links')
        .update({ access_token: generateToken() })
        .eq('id', linkData.id);

      if (error) throw error;
      toast.success(t('token_regenerated'));
      await fetchLinkData();
    } catch (error) {
      console.error('Error regenerating token:', error);
      toast.error(t('error_regenerating'));
    } finally {
      setIsSaving(false);
    }
  };

  const regenerateCode = () => {
    setAccessCode(generateCode());
  };

  const copyLink = async () => {
    if (!linkData) return;
    
    const url = `${window.location.origin}/upload/${linkData.access_token}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success(t('link_copied'));
    setTimeout(() => setCopied(false), 2000);
  };

  const getPublicUrl = () => {
    if (!linkData) return '';
    return `${window.location.origin}/upload/${linkData.access_token}`;
  };

  if (isLoading) {
    return (
      <Card className="border-2 border-dashed border-primary/30">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Link2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">{t('public_upload_link')}</CardTitle>
                <CardDescription>{t('public_upload_link_description')}</CardDescription>
              </div>
            </div>
            {linkData && (
              <Badge variant={linkData.is_active ? 'default' : 'secondary'}>
                {linkData.is_active ? t('active') : t('inactive')}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {linkData ? (
            <>
              {/* Link Display */}
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border">
                <code className="flex-1 text-sm font-mono truncate">
                  {getPublicUrl()}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={copyLink}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => window.open(getPublicUrl(), '_blank')}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>

              {/* Info Row */}
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{t('access_code')}:</span>
                  <code className="font-mono px-2 py-0.5 bg-muted rounded">
                    {showCode ? linkData.access_code : '••••••'}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setShowCode(!showCode)}
                  >
                    {showCode ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                </div>
                {linkData.file_prefix && (
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{t('file_prefix')}:</span>
                    <code className="font-mono px-2 py-0.5 bg-muted rounded">{linkData.file_prefix}</code>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setShowSettings(true)}>
                  <Settings className="h-4 w-4 mr-2" />
                  {t('settings')}
                </Button>
                <Button variant="outline" size="sm" onClick={regenerateToken} disabled={isSaving}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${isSaving ? 'animate-spin' : ''}`} />
                  {t('regenerate_link')}
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-muted-foreground mb-4">{t('no_public_link_configured')}</p>
              <Button onClick={() => {
                setAccessCode(generateCode());
                setShowSettings(true);
              }}>
                <Link2 className="h-4 w-4 mr-2" />
                {t('create_public_link')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{linkData ? t('edit_link_settings') : t('create_public_link')}</DialogTitle>
            <DialogDescription>
              {t('public_link_settings_description')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Access Code */}
            <div className="space-y-2">
              <Label>{t('access_code')} *</Label>
              <div className="flex gap-2">
                <Input
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                  placeholder="ABC123"
                  className="font-mono"
                />
                <Button variant="outline" size="icon" onClick={regenerateCode}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('access_code_description')}
              </p>
            </div>

            {/* File Prefix */}
            <div className="space-y-2">
              <Label>{t('file_prefix')}</Label>
              <Input
                value={filePrefix}
                onChange={(e) => setFilePrefix(e.target.value)}
                placeholder={t('file_prefix_placeholder')}
              />
              <p className="text-xs text-muted-foreground">
                {t('file_prefix_description')}
              </p>
            </div>

            <Separator />

            {/* Active Switch */}
            <div className="flex items-center justify-between">
              <div>
                <Label>{t('link_active')}</Label>
                <p className="text-xs text-muted-foreground">{t('link_active_description')}</p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettings(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={createOrUpdateLink} disabled={isSaving || !accessCode.trim()}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('saving')}
                </>
              ) : (
                t('save')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
