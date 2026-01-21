import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { LanguageSelector } from '@/components/auth/LanguageSelector';
import { ThemeToggle } from '@/components/auth/ThemeToggle';
import { AuthForm } from '@/components/auth/AuthForm';
import { AnimatedLogo } from '@/components/auth/AnimatedLogo';

const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        navigate('/dashboard', { replace: true });
      }
      setIsCheckingAuth(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        navigate('/dashboard', { replace: true });
      }
      setIsCheckingAuth(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <motion.div
          className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background cyber-grid relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute w-96 h-96 rounded-full bg-gradient-to-br from-primary/10 to-transparent blur-3xl"
          style={{ top: '10%', left: '-10%' }}
          animate={{
            x: [0, 50, 0],
            y: [0, 30, 0],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <motion.div
          className="absolute w-80 h-80 rounded-full bg-gradient-to-tl from-accent/10 to-transparent blur-3xl"
          style={{ bottom: '10%', right: '-5%' }}
          animate={{
            x: [0, -40, 0],
            y: [0, -20, 0],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </div>

      {/* Header with controls */}
      <motion.header
        className="relative z-20 flex items-center justify-end gap-3 p-4 md:p-6"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <LanguageSelector />
        <ThemeToggle />
      </motion.header>

      {/* Main content */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
        <AuthForm />
      </main>

      {/* Footer with animated logo */}
      <motion.footer
        className="relative z-10 pb-8"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <AnimatedLogo />
      </motion.footer>
    </div>
  );
};

export default AuthPage;
