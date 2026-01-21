import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { PdfSettingsProvider } from "@/contexts/PdfSettingsContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import PublicUpload from "./pages/PublicUpload";
import PublicQuoteRequest from "./pages/PublicQuoteRequest";
import PublicInvoiceRequest from "./pages/PublicInvoiceRequest";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <LanguageProvider>
        <PdfSettingsProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                {/* Dashboard routes with nested pages */}
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/dashboard/:page" element={<Dashboard />} />
                <Route path="/upload/:token" element={<PublicUpload />} />
                <Route path="/quote-request/:token" element={<PublicQuoteRequest />} />
                <Route path="/invoice-request/:token" element={<PublicInvoiceRequest />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </PdfSettingsProvider>
      </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
