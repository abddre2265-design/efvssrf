import React from 'react';
import { motion } from 'framer-motion';
import { Globe } from 'lucide-react';
import { useLanguage, Language } from '@/contexts/LanguageContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

const languages: { code: Language; label: string; flag: string }[] = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
];

export const LanguageSelector: React.FC = () => {
  const { language, setLanguage } = useLanguage();
  
  const currentLang = languages.find(l => l.code === language);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 bg-card/50 backdrop-blur-sm border border-border/50 hover:bg-accent/50 hover:border-primary/50 transition-all duration-300"
        >
          <motion.div
            whileHover={{ rotate: 360 }}
            transition={{ duration: 0.5 }}
          >
            <Globe className="h-4 w-4" />
          </motion.div>
          <span>{currentLang?.flag}</span>
          <span className="hidden sm:inline">{currentLang?.label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="bg-card/95 backdrop-blur-md border-border/50"
      >
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => setLanguage(lang.code)}
            className={`cursor-pointer gap-2 ${
              language === lang.code ? 'bg-primary/20 text-primary' : ''
            }`}
          >
            <span>{lang.flag}</span>
            <span>{lang.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
