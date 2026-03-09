import React, { useState } from 'react';
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
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Loader2,
  Upload,
  FileCheck,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface ExpectedData {
  payment_date: string;
  client_identifier: string;
  organization_identifier: string;
  total_ttc: number;
  withholding_rate: number;
}

interface WithholdingCertificateDialogProps {
  open: boolean;
  expectedData: ExpectedData;
  organizationId: string;
  onValidated: (storagePath: string) => void;
  onCancel: () => void;
}

type Step = 'upload' | 'analyzing' | 'success' | 'error';

export const WithholdingCertificateDialog: React.FC<WithholdingCertificateDialogProps> = ({
  open,
  expectedData,
  organizationId,
  onValidated,
  onCancel,
}) => {
  const { t } = useLanguage();
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/pdf') {
        toast.error('Veuillez sélectionner un fichier PDF');
        return;
      }
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast.error('Le fichier ne doit pas dépasser 10 Mo');
        return;
      }
      setFile(selectedFile);
      setErrors([]);
      setStep('upload');
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;

    setStep('analyzing');
    setErrors([]);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('expectedData', JSON.stringify(expectedData));

      const functionUrl = `https://uzrkeuweietxkwubhbym.supabase.co/functions/v1/verify-withholding-certificate`;

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6cmtldXdlaWV0eGt3dWJoYnltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3NzU3MDMsImV4cCI6MjA4NDM1MTcwM30.gs9xYrFUdnFJnBGmfrJv2vlwsI8hWCjwjbUJhJRlF9g',
        },
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        setStep('success');
      } else {
        setErrors(result.errors || ['Erreur de vérification']);
        setStep('error');
      }
    } catch (err) {
      console.error('Verification error:', err);
      setErrors(['Erreur de connexion au service de vérification']);
      setStep('error');
    }
  };

  const handleUploadAndConfirm = async () => {
    if (!file) return;
    setIsUploading(true);

    try {
      const fileName = `withholding-certificates/${organizationId}/${Date.now()}_${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from('public-uploads')
        .upload(fileName, file, { contentType: 'application/pdf' });

      if (uploadError) throw uploadError;

      onValidated(fileName);
      toast.success('Certificat de retenue validé et enregistré');
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Erreur lors de l\'enregistrement du certificat');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRetry = () => {
    setFile(null);
    setErrors([]);
    setStep('upload');
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-lg"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Certificat de Retenue à la Source
          </DialogTitle>
          <DialogDescription>
            Votre demande inclut une retenue à la source. Vous devez fournir le certificat de retenue correspondant pour validation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary of expected values */}
          <div className="rounded-lg border bg-muted/50 p-3 text-sm space-y-1">
            <p><strong>Date de paiement :</strong> {expectedData.payment_date}</p>
            <p><strong>Total TTC :</strong> {expectedData.total_ttc.toFixed(3)} TND</p>
            <p><strong>Taux de retenue :</strong> {expectedData.withholding_rate}%</p>
          </div>

          {/* Upload step */}
          {step === 'upload' && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="certificate-file">Fichier PDF du certificat</Label>
                <div className="mt-2">
                  {file ? (
                    <div className="flex items-center gap-2 p-3 rounded-lg border bg-accent/10">
                      <FileCheck className="h-5 w-5 text-primary" />
                      <span className="text-sm flex-1 truncate">{file.name}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { setFile(null); setErrors([]); }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <label
                      htmlFor="certificate-file"
                      className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary/50 hover:bg-accent/5 transition-colors"
                    >
                      <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                      <span className="text-sm text-muted-foreground">
                        Cliquez pour sélectionner le PDF
                      </span>
                      <span className="text-xs text-muted-foreground mt-1">
                        PDF uniquement, max 10 Mo
                      </span>
                    </label>
                  )}
                  <Input
                    id="certificate-file"
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={onCancel}>
                  Annuler la demande
                </Button>
                <Button onClick={handleAnalyze} disabled={!file}>
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  Vérifier le certificat
                </Button>
              </div>
            </div>
          )}

          {/* Analyzing step */}
          {step === 'analyzing' && (
            <div className="flex flex-col items-center py-8 gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Analyse OCR du certificat en cours...
              </p>
              <p className="text-xs text-muted-foreground">
                Vérification de la conformité avec votre demande
              </p>
            </div>
          )}

          {/* Success step */}
          {step === 'success' && (
            <div className="space-y-4">
              <div className="flex flex-col items-center py-4 gap-2">
                <CheckCircle2 className="h-12 w-12 text-green-500" />
                <p className="font-medium text-green-700 dark:text-green-400">
                  Certificat conforme !
                </p>
                <p className="text-sm text-muted-foreground text-center">
                  Toutes les données du certificat correspondent à votre demande.
                </p>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleUploadAndConfirm} disabled={isUploading}>
                  {isUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  )}
                  Confirmer et soumettre
                </Button>
              </div>
            </div>
          )}

          {/* Error step */}
          {step === 'error' && (
            <div className="space-y-4">
              <div className="flex flex-col items-center py-2 gap-2">
                <AlertCircle className="h-10 w-10 text-destructive" />
                <p className="font-medium text-destructive">
                  Certificat non conforme
                </p>
              </div>
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2 max-h-48 overflow-y-auto">
                {errors.map((error, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <X className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={onCancel}>
                  Annuler la demande
                </Button>
                <Button onClick={handleRetry}>
                  <Upload className="h-4 w-4 mr-2" />
                  Réessayer avec un autre PDF
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
