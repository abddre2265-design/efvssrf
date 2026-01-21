import React from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageSelector } from '@/components/auth/LanguageSelector';
import { ThemeToggle } from '@/components/auth/ThemeToggle';
import { HeaderLogo } from './HeaderLogo';
import { ProfileDropdown } from './ProfileDropdown';
import { OrganizationSettingsDialog } from './OrganizationSettingsDialog';
import { AIFloatingAgent } from './AIFloatingAgent';

interface DashboardHeaderProps {
  email: string;
  sidebarCollapsed: boolean;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({ email, sidebarCollapsed }) => {
  const { isRTL } = useLanguage();

  return (
    <>
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="h-16 border-b border-border/50 bg-card/80 backdrop-blur-xl flex items-center justify-between px-4 sticky top-0 z-30"
      >
        {/* Left side - Logo */}
        <div className="flex items-center gap-4">
          <HeaderLogo collapsed={sidebarCollapsed} />
        </div>

        {/* Right side - Controls */}
        <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <LanguageSelector />
          <ThemeToggle />
          <OrganizationSettingsDialog />
          <ProfileDropdown email={email} />
        </div>
      </motion.header>
      
      {/* AI Floating Agent */}
      <AIFloatingAgent />
    </>
  );
};
