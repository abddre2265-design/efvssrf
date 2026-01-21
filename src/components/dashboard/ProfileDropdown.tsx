import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Mail, Lock, LogOut, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ProfileDropdownProps {
  email: string;
}

export const ProfileDropdown: React.FC<ProfileDropdownProps> = ({ email }) => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(t('genericError'));
    } else {
      toast.success(t('signOut'));
      navigate('/auth');
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error(t('passwordTooShort'));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t('passwordMismatch'));
      return;
    }

    setIsLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setIsLoading(false);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t('passwordChanged'));
      setShowPasswordDialog(false);
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 bg-card/50 backdrop-blur-sm border border-border/50 hover:bg-accent/50 hover:border-primary/50 transition-all duration-300"
          >
            <motion.div
              className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center"
              whileHover={{ scale: 1.1 }}
            >
              <User className="w-4 h-4 text-primary-foreground" />
            </motion.div>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-56 bg-card/95 backdrop-blur-md border-border/50"
        >
          <div className="px-3 py-2">
            <p className="text-sm font-medium truncate">{email}</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setShowEmailDialog(true)}
            className="cursor-pointer gap-2"
          >
            <Mail className="w-4 h-4" />
            {t('viewEmail')}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setShowPasswordDialog(true)}
            className="cursor-pointer gap-2"
          >
            <Lock className="w-4 h-4" />
            {t('changePassword')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleSignOut}
            className="cursor-pointer gap-2 text-destructive focus:text-destructive"
          >
            <LogOut className="w-4 h-4" />
            {t('signOut')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Email Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="glass-strong">
          <DialogHeader>
            <DialogTitle>{t('viewEmail')}</DialogTitle>
          </DialogHeader>
          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">{t('email')}</p>
            <p className="font-medium">{email}</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="glass-strong">
          <DialogHeader>
            <DialogTitle>{t('changePassword')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('newPassword')}</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="futuristic-input"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('confirmPassword')}</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="futuristic-input"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>
                {t('cancel')}
              </Button>
              <Button onClick={handleChangePassword} disabled={isLoading}>
                {t('save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
