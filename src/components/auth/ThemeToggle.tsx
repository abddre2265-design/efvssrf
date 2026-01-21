import React from 'react';
import { motion } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';

export const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleTheme}
      className="relative w-10 h-10 p-0 bg-card/50 backdrop-blur-sm border border-border/50 hover:bg-accent/50 hover:border-primary/50 transition-all duration-300 overflow-hidden"
    >
      <motion.div
        initial={false}
        animate={{
          y: theme === 'dark' ? 0 : -40,
          rotate: theme === 'dark' ? 0 : 180,
        }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="absolute"
      >
        <Moon className="h-5 w-5 text-primary" />
      </motion.div>
      <motion.div
        initial={false}
        animate={{
          y: theme === 'light' ? 0 : 40,
          rotate: theme === 'light' ? 0 : -180,
        }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="absolute"
      >
        <Sun className="h-5 w-5 text-amber-500" />
      </motion.div>
    </Button>
  );
};
