import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useGetUserStats, useGetUserInventory, useGetUserAchievements } from "@workspace/api-client-react/src/generated/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Trophy, Wallet, Landmark, Shield, Swords, Zap, Activity, Ticket } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Profile() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    setLocation("/login");
    return null;
  }

  const { data: stats, isLoading: statsLoading } = useGetUserStats({ query: { enabled: isAuthenticated } });
  const { data: inventoryData, isLoading: invLoading } = useGetUserInventory({ query: { enabled: isAuthenticated } });
  const { data: achievementsData, isLoading: achLoading } = useGetUserAchievements({ query: { enabled: isAuthenticated } });

  const progressPercentage = stats ? (stats.profile.xp / stats.xpNeeded) * 100 : 0;

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header Profile Card */}
      <div className="glass-card rounded-xl p-6 md:p-8 relative overflow-hidden border border-primary/20">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-6">
          <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-black border-2 border-primary shadow-[0_0_15px_rgba(168,85,247,0.5)] flex items-center justify-center text-4xl md:text-5xl font-serif text-primary shrink-0">
            {stats?.profile.name?.charAt(0).toUpperCase() || user?.name.charAt(0).toUpperCase() || "?"}
          </div>
          
          <div className="flex-1 text-center md:text-left w-full">
            <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 mb-2">
              <h1 className="text-3xl md:text-4xl font-serif font-bold text-white tracking-wider">{stats?.profile.name || user?.name}</h1>
              {stats?.profile.premium === 1 && (
                <span className="px-3 py-1 bg-amber-500/20 text-amber-400 text-xs font-bold uppercase tracking-wider rounded-full border border-amber-500/50 inline-block self-center md:self-auto">
                  Premium
                </span>
              )}
            </div>
            
            <p className="text-muted-foreground text-sm max-w-2xl mb-6">
              {stats?.profile.bio || "An operative of the shadows. No bio provided."}
            </p>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 w-full">
              <div className="bg-black/40 p-3 rounded-lg border border-white/5">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Level</p>
                <p className="text-2xl font-serif font-bold text-primary">{stats?.profile.level || 1}</p>
              </div>
              <div className="bg-black/40 p-3 rounded-lg border border-white/5">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1"><Trophy className="w-3 h-3"/> Rank</p>
                <p className="text-2xl font-serif font-bold text-white">#{stats?.rank || "?"}</p>
              </div>
              <div className="bg-black/40 p-3 rounded-lg border border-white/5">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1"><Wallet className="w-3 h-3"/> Wallet</p>
                <p className="text-xl font-bold text-amber-400">{stats?.profile.balance?.toLocaleString() || 0}</p>
              </div>
              <div className="bg-black/40 p-3 rounded-lg border border-white/5">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1"><Landmark className="w-3 h-3"/> Bank</p>
                <p className="text-xl font-bold text-blue-400">{stats?.profile.bank?.toLocaleString() || 0}</p>
              </div>
              <div className="bg-black/40 p-3 rounded-lg border border-white/5">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1"><Ticket className="w-3 h-3 text-amber-400"/> Lottery Tickets</p>
                <p className="text-xl font-bold text-amber-400">{stats?.profile.lotteryTickets ?? 0}</p>
              </div>
            </div>

            <div className="mt-6 w-full max-w-xl">
              <div className="flex justify-between text-xs text-muted-foreground mb-2 font-mono">
                <span>XP {stats?.profile.xp || 0}</span>
                <span>Next Level: {stats?.xpNeeded || 100}</span>
              </div>
              <Progress value={progressPercentage} className="h-2 bg-black border border-white/10" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full justify-start border-b border-primary/20 bg-transparent rounded-none h-auto p-0 mb-6 gap-6 overflow-x-auto">
          {["Overview", "Inventory", "Pets", "Achievements"].map((tab) => (
            <TabsTrigger 
              key={tab.toLowerCase()} 
              value={tab.toLowerCase()}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-2 py-3 uppercase tracking-wider text-sm text-muted-foreground data-[state=active]:text-primary data-[state=active]:neon-text-purple transition-all"
            >
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {statsLoading ? (
            <div className="h-64 glass-card rounded-lg animate-pulse" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* RPG Stats */}
              <Card className="glass-card border-white/10 bg-black/20">
                <CardContent className="p-6">
                  <h3 className="font-serif text-xl font-bold text-white mb-6 border-b border-white/10 pb-4 flex items-center justify-between">
                    <span>Combat Statistics</span>
                    <span className="text-sm font-sans text-primary border border-primary/30 px-3 py-1 rounded-full uppercase tracking-widest bg-primary/10">
                      {stats?.rpg?.class || "Novice"}
                    </span>
                  </h3>
                  
                  <div className="space-y-4">
                    <StatBar icon={Activity} label="Health" value={stats?.rpg?.hp || 100} max={stats?.rpg?.maxHp || 100} color="bg-red-500" />
                    <StatBar icon={Swords} label="Attack" value={stats?.rpg?.attack || 10} max={100} color="bg-orange-500" />
                    <StatBar icon={Shield} label="Defense" value={stats?.rpg?.defense || 10} max={100} color="bg-blue-500" />
                    <StatBar icon={Zap} label="Speed" value={stats?.rpg?.speed || 10} max={100} color="bg-yellow-500" />
                  </div>
                </CardContent>
              </Card>

              {/* Guild Info */}
              <Card className="glass-card border-white/10 bg-black/20">
                <CardContent className="p-6">
                  <h3 className="font-serif text-xl font-bold text-white mb-6 border-b border-white/10 pb-4">Guild Affiliation</h3>
                  
                  {stats?.guild ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <Shield className="w-16 h-16 text-primary mb-4 opacity-80" />
                      <h4 className="text-2xl font-serif font-bold text-white">{stats.guild.name}</h4>
                      <p className="text-muted-foreground mt-2">Level {stats.guild.level} Guild</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <div className="w-16 h-16 rounded-full border border-dashed border-muted-foreground flex items-center justify-center mb-4">
                        <Shield className="w-8 h-8 text-muted-foreground" />
                      </div>
                      <p className="text-muted-foreground">Not affiliated with any guild.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="inventory">
          <div className="glass-card rounded-xl p-6 border border-white/10">
            <h3 className="font-serif text-xl font-bold text-white mb-6">Your Inventory</h3>
            
            {invLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {[1,2,3,4,5,6].map(i => <div key={i} className="h-32 bg-white/5 animate-pulse rounded-lg" />)}
              </div>
            ) : inventoryData?.items && inventoryData.items.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {inventoryData.items.map((item, i) => (
                  <div key={i} className="bg-black/40 border border-white/10 rounded-lg p-4 flex flex-col items-center justify-center relative group hover:border-primary/50 transition-colors">
                    <span className="absolute top-2 right-2 bg-primary text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-6 text-center shadow-[0_0_10px_rgba(168,85,247,0.5)]">
                      {item.quantity}
                    </span>
                    <div className="w-12 h-12 rounded-md bg-white/5 mb-3 flex items-center justify-center border border-white/5 group-hover:border-primary/30 transition-colors">
                      <span className="text-xl">📦</span>
                    </div>
                    <p className="text-sm font-medium text-center text-gray-200 line-clamp-2">{item.item}</p>
                    <p className="text-[10px] text-muted-foreground uppercase mt-1">{item.category}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-muted-foreground">
                <p>Your inventory is empty.</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="pets">
          <div className="glass-card rounded-xl p-12 border border-white/10 flex flex-col items-center justify-center text-center">
            <div className="w-24 h-24 rounded-full bg-black/50 border border-white/10 flex items-center justify-center mb-6">
              <span className="text-4xl opacity-50">🐾</span>
            </div>
            <h3 className="font-serif text-2xl font-bold text-white mb-2">No Shadows in your party yet</h3>
            <p className="text-muted-foreground max-w-md">
              The pet system is currently shrouded in darkness. Check back later when this feature is unveiled.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="achievements">
          <div className="glass-card rounded-xl p-6 border border-white/10">
            <h3 className="font-serif text-xl font-bold text-white mb-6">Achievements</h3>
            
            {achLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1,2,3].map(i => <div key={i} className="h-24 bg-white/5 animate-pulse rounded-lg" />)}
              </div>
            ) : achievementsData?.achievements && achievementsData.achievements.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {achievementsData.achievements.map((ach) => (
                  <div key={ach.id} className="bg-black/40 border border-white/10 rounded-lg p-4 flex items-center gap-4 hover:bg-white/5 transition-colors">
                    <div className="w-12 h-12 rounded-full bg-primary/20 border border-primary/50 flex items-center justify-center text-2xl shadow-[0_0_15px_rgba(168,85,247,0.3)] shrink-0">
                      {ach.icon}
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm">{ach.name}</h4>
                      <p className="text-xs text-muted-foreground mt-1">{ach.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-muted-foreground border border-dashed border-white/10 rounded-lg">
                <Trophy className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p>No achievements earned yet. Complete missions to earn badges.</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatBar({ icon: Icon, label, value, max, color }: any) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <div className="flex items-center gap-2 text-sm text-gray-300">
          <Icon className="w-4 h-4 text-muted-foreground" />
          <span className="uppercase tracking-wider text-xs">{label}</span>
        </div>
        <span className="text-xs font-mono">{value} / {max}</span>
      </div>
      <div className="h-2 w-full bg-black rounded-full overflow-hidden border border-white/5">
        <div 
          className={cn("h-full rounded-full", color)} 
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
