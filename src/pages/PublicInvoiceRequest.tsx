import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';

const PublicInvoiceRequest: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [organizationName, setOrganizationName] = useState('');

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setIsValid(false);
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('invoice_request_links')
          .select('organization_id, is_active')
          .eq('access_token', token)
          .single();

        if (error || !data?.is_active) {
          setIsValid(false);
        } else {
          setIsValid(true);
          // Get organization name
          const { data: org } = await supabase
            .from('organizations')
            .select('name')
            .eq('id', data.organization_id)
            .single();
          if (org) setOrganizationName(org.name);
        }
      } catch (err) {
        setIsValid(false);
      } finally {
        setIsLoading(false);
      }
    };

    validateToken();
  }, [token]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <CardTitle>{t('invalid_request_link')}</CardTitle>
          </CardHeader>
          <CardContent className="text-center text-muted-foreground">
            <p>{t('link_not_found')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader className="text-center">
            <CardTitle>{t('invoice_request_form')}</CardTitle>
            {organizationName && (
              <p className="text-muted-foreground">{organizationName}</p>
            )}
          </CardHeader>
          <CardContent>
            <p className="text-center text-muted-foreground">
              {t('invoice_request_form')} - {t('your_information')}
            </p>
            {/* Full form implementation will be added */}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PublicInvoiceRequest;
