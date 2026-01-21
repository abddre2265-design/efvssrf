import React from 'react';
import { motion } from 'framer-motion';
import logoImage from '@/assets/logo.png';

interface HeaderLogoProps {
  collapsed?: boolean;
}

export const HeaderLogo: React.FC<HeaderLogoProps> = ({ collapsed = false }) => {
  return (
    <motion.div 
      className="flex items-center gap-3"
      whileHover={{ scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 400 }}
    >
      {/* Logo with glow effect */}
      <div className="relative">
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-primary/40 to-accent/40 rounded-full blur-lg"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.5, 0.8, 0.5],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <motion.img
          src={logoImage}
          alt="Gaara Ledger"
          className="relative w-10 h-10 object-contain"
          animate={{
            y: [0, -2, 0],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </div>
      
      {/* Text - hide when collapsed */}
      {!collapsed && (
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h1 className="text-lg font-bold gradient-text tracking-wide">
            GAARA LEDGER
          </h1>
        </motion.div>
      )}
    </motion.div>
  );
};
