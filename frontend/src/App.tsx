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
        <div className="flex min-h-dvh flex-col">
          <div className="flex-1">
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
              <Router />
            </WouterRouter>
          </div>
          <AssistedByFooter />
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function AssistedByFooter() {
  return (
    <footer className="fixed inset-x-0 bottom-0 z-[100] flex h-[50px] items-center justify-center overflow-hidden bg-black">
      <div className="flex h-full items-center justify-center gap-3 whitespace-nowrap px-2 text-[10px] leading-none text-white sm:gap-5 sm:text-xs">
        <span>Assisted BY</span>
        <a
          href="https://seyqon-tech-solutions.netlify.app/"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Seyqon Tech Solutions website"
          title="Seyqon Tech Solutions"
          className="flex h-[50px] items-center rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-300"
        >
          <img src="/seyqon-horizontal-logo.png" alt="Seyqon Tech Solutions" className="h-[40px] w-auto object-contain" />
        </a>
        <span>Your idea our solution</span>
      </div>
    </footer>
  );
}

export default App;
