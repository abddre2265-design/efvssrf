import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, Loader2, ArrowRight, Sparkles } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { z } from 'zod';

type AuthMode = 'signin' | 'signup' | 'forgot';

const emailSchema = z.string().email();
const passwordSchema = z.string().min(6);

export const AuthForm: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const validateEmail = (email: string): boolean => {
    try {
      emailSchema.parse(email);
      return true;
    } catch {
      return false;
    }
  };

  const validatePassword = (password: string): boolean => {
    try {
      passwordSchema.parse(password);
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateEmail(email)) {
      toast.error(t('invalidEmail'));
      return;
    }

    if (mode !== 'forgot' && !validatePassword(password)) {
      toast.error(t('passwordTooShort'));
      return;
    }

    if (mode === 'signup' && password !== confirmPassword) {
      toast.error(t('passwordMismatch'));
      return;
    }

    setIsLoading(true);

    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            toast.error(t('invalidCredentials'));
          } else {
            toast.error(error.message);
          }
        } else {
          toast.success(t('signInSuccess'));
        }
      } else if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: {
              email_confirmed: true,
            },
          },
        });
        if (error) {
          if (error.message.includes('already registered')) {
            toast.error(t('userAlreadyExists'));
          } else {
            toast.error(error.message);
          }
        } else {
          toast.success(t('signUpSuccess'));
          setMode('signin');
        }
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth?reset=true`,
        });
        if (error) {
          toast.error(error.message);
        } else {
          toast.success(t('resetEmailSent'));
          setMode('signin');
        }
      }
    } catch (error) {
      toast.error(t('genericError'));
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setPassword('');
    setConfirmPassword('');
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        staggerChildren: 0.1,
      },
    },
    exit: { opacity: 0, y: -20, transition: { duration: 0.3 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, x: isRTL ? 20 : -20 },
    visible: { opacity: 1, x: 0 },
  };

  const getTitle = () => {
    switch (mode) {
      case 'signin': return t('welcomeBack');
      case 'signup': return t('createAccount');
      case 'forgot': return t('resetYourPassword');
    }
  };

  return (
    <motion.div
      className="w-full max-w-md mx-auto"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Glass card */}
      <div className="glass-strong rounded-2xl p-8 shadow-2xl relative overflow-hidden">
        {/* Animated background gradient */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5"
          animate={{
            backgroundPosition: ['0% 0%', '100% 100%', '0% 0%'],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: 'linear',
          }}
        />

        {/* Corner decorations */}
        <div className="absolute top-0 left-0 w-20 h-20 border-l-2 border-t-2 border-primary/30 rounded-tl-2xl" />
        <div className="absolute bottom-0 right-0 w-20 h-20 border-r-2 border-b-2 border-primary/30 rounded-br-2xl" />

        <div className="relative z-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              {/* Header */}
              <motion.div variants={itemVariants} className="text-center mb-8">
                <motion.div
                  className="inline-flex items-center gap-2 mb-2"
                  whileHover={{ scale: 1.05 }}
                >
                  <Sparkles className="w-5 h-5 text-primary animate-pulse" />
                  <span className="text-sm text-muted-foreground uppercase tracking-widest">
                    {t('appName')}
                  </span>
                  <Sparkles className="w-5 h-5 text-primary animate-pulse" />
                </motion.div>
                <h1 className="text-3xl font-bold gradient-text">{getTitle()}</h1>
                {mode === 'forgot' && (
                  <p className="text-muted-foreground mt-2 text-sm">
                    {t('enterEmailReset')}
                  </p>
                )}
              </motion.div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Email Field */}
                <motion.div variants={itemVariants} className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">
                    {t('email')}
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 h-12 futuristic-input"
                      placeholder="email@example.com"
                      required
                    />
                  </div>
                </motion.div>

                {/* Password Field */}
                {mode !== 'forgot' && (
                  <motion.div variants={itemVariants} className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-medium">
                      {t('password')}
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 pr-10 h-12 futuristic-input"
                        placeholder="••••••••"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Confirm Password Field */}
                {mode === 'signup' && (
                  <motion.div variants={itemVariants} className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-sm font-medium">
                      {t('confirmPassword')}
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="pl-10 pr-10 h-12 futuristic-input"
                        placeholder="••••••••"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Forgot Password Link */}
                {mode === 'signin' && (
                  <motion.div variants={itemVariants} className="text-right">
                    <button
                      type="button"
                      onClick={() => { setMode('forgot'); resetForm(); }}
                      className="text-sm text-primary hover:text-primary/80 transition-colors hover:underline"
                    >
                      {t('forgotPassword')}
                    </button>
                  </motion.div>
                )}

                {/* Submit Button */}
                <motion.div variants={itemVariants}>
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-12 text-base font-semibold relative overflow-hidden group glow-primary"
                  >
                    <motion.span
                      className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary-foreground/10 to-primary/0"
                      animate={{
                        x: ['-100%', '100%'],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: 'linear',
                      }}
                    />
                    <span className="relative flex items-center justify-center gap-2">
                      {isLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          {mode === 'signin' && t('signIn')}
                          {mode === 'signup' && t('signUp')}
                          {mode === 'forgot' && t('sendResetLink')}
                          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </>
                      )}
                    </span>
                  </Button>
                </motion.div>
              </form>

              {/* Mode Switch Links */}
              <motion.div variants={itemVariants} className="mt-6 text-center space-y-2">
                {mode === 'signin' && (
                  <p className="text-sm text-muted-foreground">
                    {t('noAccount')}{' '}
                    <button
                      onClick={() => { setMode('signup'); resetForm(); }}
                      className="text-primary hover:text-primary/80 font-medium transition-colors hover:underline"
                    >
                      {t('signUp')}
                    </button>
                  </p>
                )}
                {mode === 'signup' && (
                  <p className="text-sm text-muted-foreground">
                    {t('hasAccount')}{' '}
                    <button
                      onClick={() => { setMode('signin'); resetForm(); }}
                      className="text-primary hover:text-primary/80 font-medium transition-colors hover:underline"
                    >
                      {t('signIn')}
                    </button>
                  </p>
                )}
                {mode === 'forgot' && (
                  <button
                    onClick={() => { setMode('signin'); resetForm(); }}
                    className="text-sm text-primary hover:text-primary/80 font-medium transition-colors hover:underline"
                  >
                    {t('backToLogin')}
                  </button>
                )}
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};
