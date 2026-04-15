import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { AppLayout } from "@/components/layout/app-layout";

// Pages
import Home from "@/pages/home";
import Login from "@/pages/login";
import Profile from "@/pages/profile";
import Shop from "@/pages/shop";
import Cards from "@/pages/cards";
import Guilds from "@/pages/guilds";
import Leaderboard from "@/pages/leaderboard";
import World from "@/pages/world";
import NotFound from "@/pages/not-found";
import BotAdmin from "@/pages/bot-admin";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/admin" component={BotAdmin} />
      <Route>
        <AppLayout>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/login" component={Login} />
            <Route path="/profile" component={Profile} />
            <Route path="/shop" component={Shop} />
            <Route path="/cards" component={Cards} />
            <Route path="/guilds" component={Guilds} />
            <Route path="/leaderboard" component={Leaderboard} />
            <Route path="/world" component={World} />
            <Route component={NotFound} />
          </Switch>
        </AppLayout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
