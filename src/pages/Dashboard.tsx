import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import { useLanguage } from '@/contexts/LanguageContext';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar';
import { AnimatedLogo } from '@/components/auth/AnimatedLogo';
import Products from '@/pages/Products';
import Clients from '@/pages/Clients';
import Suppliers from '@/pages/Suppliers';
import Invoices from '@/pages/Invoices';
import Payments from '@/pages/Payments';
import CreditNotes from '@/pages/CreditNotes';

import PurchasePayments from '@/pages/PurchasePayments';
import SupplierCreditNotes from '@/pages/SupplierCreditNotes';
import QuoteRequests from '@/pages/QuoteRequests';
import ImportFolders from '@/pages/ImportFolders';
import DocumentFamilies from '@/pages/DocumentFamilies';
import Supply from '@/pages/Supply';
import ClassificationRequests from '@/pages/ClassificationRequests';
import PointsOfSale from '@/pages/PointsOfSale';
import InvoiceRequests from '@/pages/InvoiceRequests';
import PdfSettings from '@/pages/PdfSettings';
import DeliveryNotes from '@/pages/DeliveryNotes';
import Taxes from '@/pages/Taxes';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { page } = useParams<{ page?: string }>();
  const { t } = useLanguage();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Current page from URL params, defaults to 'home'
  const currentPage = page || 'home';

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate('/auth', { replace: true });
      }
      setIsLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate('/auth', { replace: true });
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleNavigate = (pageId: string) => {
    if (pageId === 'home') {
      navigate('/dashboard');
    } else {
      navigate(`/dashboard/${pageId}`);
    }
  };

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

  if (!user) {
    return null;
  }

  const renderContent = () => {
    switch (currentPage) {
      case 'products':
        return <Products />;
      case 'clients':
        return <Clients />;
      case 'suppliers':
        return <Suppliers />;
      case 'invoices':
        return <Invoices />;
      case 'payments':
        return <Payments />;
      case 'credit-notes':
        return <CreditNotes />;
      case 'purchase-payments':
        return <PurchasePayments />;
      case 'supplier-credit-notes':
        return <SupplierCreditNotes />;
      case 'quote-requests':
        return <QuoteRequests />;
      case 'import-folders':
        return <ImportFolders />;
      case 'document-families':
        return <DocumentFamilies />;
      case 'supply':
        return <Supply />;
      case 'purchase-document-requests':
        return <ClassificationRequests />;
      case 'points-of-sale':
        return <PointsOfSale />;
      case 'sales-invoice-requests':
        return <InvoiceRequests />;
      case 'pdf-settings':
        return <PdfSettings />;
      case 'delivery-notes':
        return <DeliveryNotes />;
      case 'taxes':
        return <Taxes />;
      default:
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex flex-col items-center justify-center min-h-[60vh]"
          >
            <AnimatedLogo size="md" />
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-muted-foreground text-lg mt-4"
            >
              {t('welcomeDashboard')}
            </motion.p>
          </motion.div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background cyber-grid flex flex-col">
      <DashboardHeader email={user.email || ''} sidebarCollapsed={sidebarCollapsed} />
      
      <div className="flex flex-1 overflow-hidden">
        <DashboardSidebar 
          collapsed={sidebarCollapsed} 
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          currentPage={currentPage}
          onNavigate={handleNavigate}
        />
        
        <main className="flex-1 p-6 overflow-auto">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
