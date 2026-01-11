import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import BlogPost from "./pages/BlogPost";
import './styles/blog-components.css';

const queryClient = new QueryClient();

// SPA Redirect Handler - handles redirects from 404.html fallback
function SPARedirectHandler() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Check if we have a redirect parameter (from 404.html)
    const params = new URLSearchParams(location.search);
    const redirectPath = params.get('redirect');
    
    if (redirectPath) {
      console.log('[SPARedirectHandler] Redirecting to:', redirectPath);
      // Remove the redirect parameter and navigate to the actual path
      navigate(decodeURIComponent(redirectPath), { replace: true });
    }
  }, [location.search, navigate]);

  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <SPARedirectHandler />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/blog/:slug" element={<BlogPost />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
