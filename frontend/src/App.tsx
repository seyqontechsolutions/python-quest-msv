import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import Home from '@/pages/home';
import Play from '@/pages/play';
import Teacher from '@/pages/teacher';
import { type ReactNode } from 'react';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

const queryClient = new QueryClient();

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/play" component={Play} />
        <Route path="/teacher" component={Teacher} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <AssistedByBadge />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function AssistedByBadge() {
  return (
    <a
      href="https://seyqon-tech-solutions.netlify.app/"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Assisted by Seyqon Tech Solutions"
      title="Assisted by Seyqon Tech Solutions"
      className="fixed bottom-4 right-4 z-[100] flex w-[132px] flex-col items-center gap-1 rounded-2xl border border-cyan-400/50 bg-slate-950/90 px-2.5 py-2 text-white shadow-xl backdrop-blur transition hover:-translate-y-1 hover:border-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 max-sm:bottom-3 max-sm:right-3 max-sm:w-[104px] max-sm:rounded-xl max-sm:px-2 max-sm:py-1.5"
    >
      <span className="font-mono-ui text-[10px] font-semibold uppercase tracking-[.14em] max-sm:text-[9px]">Assisted by</span>
      <img src="/seyqon-logo.png" alt="Seyqon Tech Solutions" className="h-[104px] w-[104px] object-contain max-sm:h-[80px] max-sm:w-[80px]" />
    </a>
  );
}

export default App;
