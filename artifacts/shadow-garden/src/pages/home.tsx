import { useGetCommunityStats } from "@workspace/api-client-react/src/generated/api";
import { Button } from "@/components/ui/button";
import { Users, Crosshair, CreditCard, Shield, Activity } from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  const { data: stats, isLoading } = useGetCommunityStats();

  return (
    <div className="min-h-[100dvh]">
      {/* Hero Section */}
      <section className="relative h-[80vh] min-h-[600px] flex items-center justify-center overflow-hidden">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0 z-0">
          <img 
            src="/images/hero-bg.png" 
            alt="Shadow Garden HQ" 
            className="w-full h-full object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
          <div className="absolute inset-0 bg-black/40" />
        </div>

        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto mt-16 md:mt-0">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass-card border-primary/30 text-primary text-xs font-bold uppercase tracking-widest mb-6">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
            The Elite Secret Society
          </div>
          
          <h1 className="font-serif text-5xl md:text-7xl font-bold mb-6 tracking-tight leading-tight">
            <span className="text-white">WELCOME TO</span><br/>
            <span className="bg-gradient-to-r from-purple-500 via-primary to-purple-300 bg-clip-text text-transparent neon-text-purple">
              SHADOW GARDEN
            </span>
          </h1>
          
          <p className="text-lg md:text-xl text-gray-300 mb-10 max-w-2xl mx-auto leading-relaxed font-light">
            We lurk in the shadows and hunt the shadows. 
            Join the ultimate RPG community experience. Collect cards, form guilds, 
            build your economy, and conquer the leaderboard.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <a 
              href="https://chat.whatsapp.com/LDnXqYWuvZMELxVaOpAAHI" 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full sm:w-auto"
            >
              <Button size="lg" className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-white font-bold tracking-widest uppercase px-8 h-14 rounded-sm neon-border-purple relative overflow-hidden group">
                <span className="relative z-10">Join Shadow Garden</span>
                <div className="absolute inset-0 h-full w-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
              </Button>
            </a>
            
            <a href="#stats" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full sm:w-auto border-primary/50 text-white hover:bg-primary/10 hover:text-white font-bold tracking-widest uppercase px-8 h-14 rounded-sm glass-card">
                View Stats
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section id="stats" className="py-24 px-4 bg-background relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-serif text-3xl md:text-4xl font-bold mb-4 neon-text-purple">Community Pulse</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">The shadows are ever-growing. Witness the true scale of our organization.</p>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1,2,3,4].map(i => (
                <div key={i} className="h-32 glass-card rounded-lg animate-pulse bg-white/5" />
              ))}
            </div>
          ) : stats ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard 
                icon={Users} 
                label="Total Members" 
                value={stats.totalMembers.toLocaleString()} 
                color="text-blue-400"
                glowColor="rgba(96, 165, 250, 0.5)"
              />
              <StatCard 
                icon={Crosshair} 
                label="Active Missions" 
                value={stats.activeMissions.toLocaleString()} 
                color="text-red-400"
                glowColor="rgba(248, 113, 113, 0.5)"
              />
              <StatCard 
                icon={CreditCard} 
                label="Cards Collected" 
                value={stats.totalCards.toLocaleString()} 
                color="text-purple-400"
                glowColor="rgba(192, 132, 252, 0.5)"
              />
              <StatCard 
                icon={Shield} 
                label="Active Guilds" 
                value={stats.totalGuilds.toLocaleString()} 
                color="text-amber-400"
                glowColor="rgba(251, 191, 36, 0.5)"
              />
            </div>
          ) : (
            <div className="text-center text-muted-foreground p-8 glass-card rounded-lg">
              Unable to fetch community pulse. The shadows obscure our vision.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, glowColor }: any) {
  return (
    <div className="glass-card p-6 rounded-lg border border-white/5 relative overflow-hidden group hover:border-primary/50 transition-colors duration-500">
      <div 
        className="absolute -right-10 -top-10 w-32 h-32 rounded-full opacity-20 blur-3xl transition-opacity duration-500 group-hover:opacity-40"
        style={{ backgroundColor: glowColor }}
      />
      <div className="relative z-10 flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">{label}</p>
          <h3 className="font-serif text-3xl font-bold text-white">{value}</h3>
        </div>
        <div className={`p-3 rounded-md bg-black/40 border border-white/10 ${color}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}
