import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import { AppLayout } from "@/components/layout";
import { AdminProvider, useAdmin } from "@/context/admin";
import Home from "@/pages/home";
import Submissions from "@/pages/submissions";
import Dashboard from "@/pages/dashboard";
import DropdownsPage from "@/pages/dropdowns";

const queryClient = new QueryClient();

function AdminRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAdmin } = useAdmin();
  if (!isAdmin) return <Redirect to="/" />;
  return <Component />;
}

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/submissions">
          <AdminRoute component={Submissions} />
        </Route>
        <Route path="/dashboard">
          <AdminRoute component={Dashboard} />
        </Route>
        <Route path="/dropdowns">
          <AdminRoute component={DropdownsPage} />
        </Route>
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AdminProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        </AdminProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
