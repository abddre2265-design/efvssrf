import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { User } from '@supabase/supabase-js';
import { AnimatedLogo } from '@/components/auth/AnimatedLogo';

const Index = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      // Redirect to dashboard if logged in
      if (session?.user) {
        navigate('/dashboard', { replace: true });
      }
      setIsLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      // Redirect to dashboard if logged in
      if (session?.user) {
        navigate('/dashboard', { replace: true });
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  if (isLoading) {
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

  // Landing page for non-authenticated users
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background cyber-grid p-8 relative overflow-hidden">
      {/* Background effects */}
      <motion.div
        className="absolute w-96 h-96 rounded-full bg-gradient-to-br from-primary/10 to-transparent blur-3xl"
        style={{ top: '10%', left: '-10%' }}
        animate={{ x: [0, 50, 0], y: [0, 30, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute w-80 h-80 rounded-full bg-gradient-to-tl from-accent/10 to-transparent blur-3xl"
        style={{ bottom: '10%', right: '-5%' }}
        animate={{ x: [0, -40, 0], y: [0, -20, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 text-center space-y-8"
      >
        <AnimatedLogo size="lg" />
        <p className="text-muted-foreground text-lg">Your Futuristic Finance Companion</p>
        <Button
          onClick={() => navigate('/auth')}
          size="lg"
          className="glow-primary text-lg px-8 py-6"
        >
          Get Started
        </Button>
      </motion.div>
    </div>
  );
};

export default Index;
