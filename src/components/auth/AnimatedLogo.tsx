import React from 'react';
import { motion } from 'framer-motion';
import logoImage from '@/assets/logo.png';

interface AnimatedLogoProps {
  size?: 'sm' | 'md' | 'lg';
}

export const AnimatedLogo: React.FC<AnimatedLogoProps> = ({ size = 'lg' }) => {
  const sizeConfig = {
    sm: { logo: 'w-24 h-24', ring1: 'w-32 h-32', ring2: 'w-40 h-40', text: 'text-xl' },
    md: { logo: 'w-32 h-32', ring1: 'w-44 h-44', ring2: 'w-52 h-52', text: 'text-2xl' },
    lg: { logo: 'w-44 h-44', ring1: 'w-56 h-56', ring2: 'w-64 h-64', text: 'text-3xl' },
  };

  const config = sizeConfig[size];

  return (
    <div className="relative flex flex-col items-center justify-center py-8">
      {/* Outer glow rings */}
      <motion.div
        className={`absolute ${config.ring1} rounded-full border-2 border-primary/40`}
        animate={{
          scale: [1, 1.15, 1],
          opacity: [0.4, 0.15, 0.4],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      <motion.div
        className={`absolute ${config.ring2} rounded-full border border-primary/25`}
        animate={{
          scale: [1.05, 1.2, 1.05],
          opacity: [0.25, 0.08, 0.25],
          rotate: [0, 180, 360],
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: 'linear',
        }}
      />
      
      {/* Floating particles */}
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1.5 h-1.5 bg-primary rounded-full"
          style={{
            left: `${50 + Math.cos((i * Math.PI * 2) / 8) * 45}%`,
            top: `${50 + Math.sin((i * Math.PI * 2) / 8) * 45}%`,
          }}
          animate={{
            y: [0, -15, 0],
            opacity: [0.4, 1, 0.4],
            scale: [1, 1.8, 1],
          }}
          transition={{
            duration: 2.5,
            delay: i * 0.25,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
      
      {/* Logo container with hover effect */}
      <motion.div
        className="relative z-10"
        whileHover={{ scale: 1.08 }}
        transition={{ type: 'spring', stiffness: 300 }}
      >
        {/* Gradient background glow */}
        <motion.div
          className="absolute inset-[-20%] bg-gradient-to-r from-primary/50 via-accent/50 to-primary/50 rounded-full blur-2xl"
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.6, 0.9, 0.6],
          }}
          transition={{
            duration: 2.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        
        {/* Main logo */}
        <motion.img
          src={logoImage}
          alt="Gaara Ledger"
          className={`relative ${config.logo} object-contain drop-shadow-2xl`}
          animate={{
            y: [0, -8, 0],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </motion.div>
      
      {/* Animated text */}
      <motion.div
        className="mt-8 text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
      >
        <motion.h2
          className={`${config.text} font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent tracking-wider`}
          animate={{
            backgroundPosition: ['0%', '100%', '0%'],
          }}
          transition={{
            duration: 5,
            repeat: Infinity,
            ease: 'linear',
          }}
          style={{
            backgroundSize: '200% auto',
          }}
        >
          GAARA LEDGER
        </motion.h2>
        
        {/* Scanning line effect */}
        <motion.div
          className="h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent mt-3"
          animate={{
            scaleX: [0, 1, 0],
            opacity: [0, 1, 0],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </motion.div>
    </div>
  );
};
