import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { 
  Home, 
  Map, 
  CreditCard, 
  User, 
  ShoppingCart, 
  Shield, 
  Trophy,
  LogOut,
  Menu,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/world", label: "World", icon: Map },
  { href: "/cards", label: "Cards", icon: CreditCard },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/shop", label: "Shop", icon: ShoppingCart },
  { href: "/guilds", label: "Guilds", icon: Shield },
  { href: "/leaderboard", label: "Ranks", icon: Trophy },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { isAuthenticated, user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-background text-foreground relative">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-border bg-black/50 backdrop-blur-xl sticky top-0 h-screen overflow-y-auto">
        <div className="p-6 flex items-center justify-center border-b border-border/50">
          <h1 className="font-serif text-2xl font-bold bg-gradient-to-br from-purple-400 to-primary bg-clip-text text-transparent neon-text-purple tracking-widest text-center uppercase">
            Shadow<br/>Garden
          </h1>
        </div>

        <nav className="flex-1 py-6 px-3 space-y-2">
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href} className="block">
                <div
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-md transition-all duration-300 font-medium tracking-wide group",
                    isActive
                      ? "bg-primary/20 text-primary border border-primary/50 neon-border-purple"
                      : "text-muted-foreground hover:bg-white/5 hover:text-white"
                  )}
                >
                  <item.icon className={cn("w-5 h-5", isActive && "text-primary")} />
                  <span>{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>

        {isAuthenticated && user && (
          <div className="p-4 border-t border-border/50 mt-auto">
            <div className="flex items-center gap-3 mb-4 px-2">
              <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/50 flex items-center justify-center font-serif text-lg font-bold text-primary">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{user.name}</p>
                <p className="text-xs text-muted-foreground truncate">Lv. {user.level}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-md transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        )}
        {!isAuthenticated && (
          <div className="p-4 border-t border-border/50 mt-auto">
            <Link href="/login" className="block w-full">
              <div className="w-full py-2 bg-primary/20 hover:bg-primary/30 border border-primary/50 text-primary text-center rounded-md transition-all font-bold tracking-widest text-sm uppercase">
                Initiate
              </div>
            </Link>
          </div>
        )}
      </aside>

      {/* Mobile Top Bar */}
      <header className="md:hidden h-16 border-b border-border/50 bg-black/80 backdrop-blur-xl flex items-center justify-between px-4 sticky top-0 z-50">
        <h1 className="font-serif text-xl font-bold bg-gradient-to-br from-purple-400 to-primary bg-clip-text text-transparent uppercase tracking-widest">
          Shadow Garden
        </h1>
        {isAuthenticated ? (
           <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/50 flex items-center justify-center font-serif font-bold text-primary text-sm">
             {user?.name.charAt(0).toUpperCase()}
           </div>
        ) : (
          <Link href="/login">
            <span className="text-xs font-bold text-primary uppercase tracking-widest">Login</span>
          </Link>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full pb-20 md:pb-0 overflow-x-hidden">
        {children}
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 border-t border-border/50 bg-black/90 backdrop-blur-xl z-50 flex items-center justify-around px-2">
        {NAV_ITEMS.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href} className="block flex-1">
              <div className="flex flex-col items-center justify-center w-full h-full py-1 space-y-1">
                <item.icon 
                  className={cn(
                    "w-5 h-5 transition-colors", 
                    isActive ? "text-primary filter drop-shadow-[0_0_8px_rgba(168,85,247,0.8)]" : "text-muted-foreground"
                  )} 
                />
                <span 
                  className={cn(
                    "text-[10px] uppercase tracking-wider font-semibold",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {item.label}
                </span>
              </div>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
