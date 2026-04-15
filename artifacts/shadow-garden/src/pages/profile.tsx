import { useLocation } from "wouter";
import { useState, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { useGetUserStats, useGetUserInventory, useGetUserAchievements } from "@workspace/api-client-react/src/generated/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trophy, Wallet, Landmark, Shield, Swords, Zap, Activity, Ticket, Flame, Wind, Brain, Heart, Star, Plus, Loader2, Camera, ImagePlus, LayoutGrid, Pencil, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function stripJid(id: string): string {
  return id?.split("@")[0]?.split(":")[0] || id || "";
}

export default function Profile() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, user, token } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [avatarUploading, setAvatarUploading] = useState(false);
  const [bgUploading, setBgUploading] = useState(false);
  const [bioEditing, setBioEditing] = useState(false);
  const [bioValue, setBioValue] = useState("");
  const [bioSaving, setBioSaving] = useState(false);
  const [frameSelecting, setFrameSelecting] = useState(false);
  const [frameSaving, setFrameSaving] = useState(false);
  const [avatarCacheKey, setAvatarCacheKey] = useState(Date.now());
  const [bgCacheKey, setBgCacheKey] = useState(Date.now());

  const avatarRef = useRef<HTMLInputElement>(null);
  const bgRef = useRef<HTMLInputElement>(null);

  if (!isAuthenticated) {
    setLocation("/login");
    return null;
  }

  const base = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useGetUserStats({
    query: { enabled: isAuthenticated, refetchInterval: 10000, refetchOnWindowFocus: true }
  });
  const { data: inventoryData, isLoading: invLoading } = useGetUserInventory({
    query: { enabled: isAuthenticated, refetchInterval: 15000 }
  });
  const { data: achievementsData, isLoading: achLoading } = useGetUserAchievements({ query: { enabled: isAuthenticated } });

  const profile = stats?.profile;
  const displayName = profile?.name || stripJid(user?.id || "") || user?.name || "Shadow";
  const progressPercentage = stats ? Math.min(100, (stats.profile.xp / stats.xpNeeded) * 100) : 0;

  async function handleAvatarFile(file: File) {
    setAvatarUploading(true);
    try {
      const b64 = await fileToBase64(file);
      const res = await fetch(`${base}/api/v1/user/avatar`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ imageBase64: b64 }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Avatar Updated", description: "Your profile picture has been saved." });
        setAvatarCacheKey(Date.now());
      } else {
        toast({ title: "Failed", description: data.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Could not upload avatar.", variant: "destructive" });
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handleBgFile(file: File) {
    setBgUploading(true);
    try {
      const b64 = await fileToBase64(file);
      const res = await fetch(`${base}/api/v1/user/background`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ imageBase64: b64, bgType: "static" }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Background Updated", description: "Your profile background has been saved." });
        setBgCacheKey(Date.now());
        refetchStats();
      } else {
        toast({ title: "Failed", description: data.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Could not upload background.", variant: "destructive" });
    } finally {
      setBgUploading(false);
    }
  }

  async function saveBio() {
    setBioSaving(true);
    try {
      const res = await fetch(`${base}/api/v1/user/bio`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bio: bioValue }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Bio Saved" });
        setBioEditing(false);
        refetchStats();
      } else {
        toast({ title: "Failed", description: data.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Could not save bio.", variant: "destructive" });
    } finally {
      setBioSaving(false);
    }
  }

  const avatarSrc = `${base}/api/v1/user/avatar?t=${avatarCacheKey}`;

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="glass-card rounded-xl relative overflow-hidden border border-primary/20">
        {/* Background Layer */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/5" />
        </div>

        {/* Background upload button */}
        <div className="absolute top-3 right-3 z-20">
          <button
            onClick={() => bgRef.current?.click()}
            disabled={bgUploading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-black/60 hover:bg-black/80 border border-white/20 hover:border-primary/50 rounded-full text-xs text-muted-foreground hover:text-white transition-all"
          >
            {bgUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImagePlus className="w-3 h-3" />}
            Set BG
          </button>
          <input ref={bgRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleBgFile(f); }} />
        </div>

        <div className="relative z-10 p-6 md:p-8 flex flex-col md:flex-row items-center md:items-start gap-6">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div className="w-28 h-28 md:w-36 md:h-36 rounded-full border-2 border-primary shadow-[0_0_20px_rgba(168,85,247,0.4)] overflow-hidden bg-black/60 flex items-center justify-center">
              <img
                src={avatarSrc}
                alt={displayName}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                  (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                }}
              />
              <span className="text-5xl font-bold text-primary hidden">{displayName.charAt(0).toUpperCase()}</span>
            </div>
            <button
              onClick={() => avatarRef.current?.click()}
              disabled={avatarUploading}
              className="absolute bottom-0 right-0 w-9 h-9 bg-primary hover:bg-primary/80 rounded-full border-2 border-background flex items-center justify-center transition-all shadow-lg"
            >
              {avatarUploading ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Camera className="w-4 h-4 text-white" />}
            </button>
            <input ref={avatarRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAvatarFile(f); }} />
          </div>

          <div className="flex-1 text-center md:text-left w-full">
            <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 mb-1">
              <h1 className="text-3xl md:text-4xl font-bold text-white tracking-wider">{displayName}</h1>
              {profile?.premium === 1 && (
                <span className="px-3 py-1 bg-amber-500/20 text-amber-400 text-xs font-bold uppercase tracking-wider rounded-full border border-amber-500/50 inline-block self-center">
                  Premium
                </span>
              )}
              {profile?.role && profile.role !== "normal" && (
                <span className="px-3 py-1 bg-primary/20 text-primary text-xs font-bold uppercase tracking-wider rounded-full border border-primary/30 inline-block self-center">
                  {profile.role}
                </span>
              )}
            </div>

            {/* Bio */}
            {bioEditing ? (
              <div className="flex items-center gap-2 mb-4 max-w-lg">
                <Input
                  value={bioValue}
                  onChange={(e) => setBioValue(e.target.value)}
                  maxLength={200}
                  placeholder="Write your bio..."
                  className="bg-black/50 border-primary/30 text-white text-sm h-8"
                  autoFocus
                />
                <button onClick={saveBio} disabled={bioSaving} className="text-green-400 hover:text-green-300">
                  {bioSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                </button>
                <button onClick={() => setBioEditing(false)} className="text-red-400 hover:text-red-300">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <p
                className="text-muted-foreground text-sm max-w-2xl mb-4 group cursor-pointer hover:text-white/70 transition-colors flex items-center gap-2"
                onClick={() => { setBioValue(profile?.bio || ""); setBioEditing(true); }}
              >
                {profile?.bio || "No bio set. Click to add one."}
                <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity shrink-0" />
              </p>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 w-full">
              <div className="bg-black/40 p-3 rounded-lg border border-white/5">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Level</p>
                <p className="text-2xl font-bold text-primary">{profile?.level || 1}</p>
              </div>
              <div className="bg-black/40 p-3 rounded-lg border border-white/5">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1"><Trophy className="w-3 h-3"/> Rank</p>
                <p className="text-2xl font-bold text-white">#{stats?.rank || "?"}</p>
              </div>
              <div className="bg-black/40 p-3 rounded-lg border border-white/5">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1"><Wallet className="w-3 h-3"/> Wallet</p>
                <p className="text-xl font-bold text-amber-400">{(profile?.balance ?? 0).toLocaleString()}</p>
              </div>
              <div className="bg-black/40 p-3 rounded-lg border border-white/5">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1"><Landmark className="w-3 h-3"/> Bank</p>
                <p className="text-xl font-bold text-blue-400">{(profile?.bank ?? 0).toLocaleString()}</p>
              </div>
              <div className="bg-black/40 p-3 rounded-lg border border-white/5">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1"><Ticket className="w-3 h-3 text-amber-400"/> Tickets</p>
                <p className="text-xl font-bold text-amber-400">{profile?.lotteryTickets ?? 0}</p>
              </div>
            </div>

            <div className="mt-5 w-full max-w-xl">
              <div className="flex justify-between text-xs text-muted-foreground mb-2 font-mono">
                <span>XP {profile?.xp || 0}</span>
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
          {["Overview", "Skills", "Inventory", "Frame", "Achievements"].map((tab) => (
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
              <Card className="glass-card border-white/10 bg-black/20">
                <CardContent className="p-6">
                  <h3 className="font-bold text-xl text-white mb-6 border-b border-white/10 pb-4 flex items-center justify-between">
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

              <Card className="glass-card border-white/10 bg-black/20">
                <CardContent className="p-6">
                  <h3 className="font-bold text-xl text-white mb-6 border-b border-white/10 pb-4">Guild Affiliation</h3>
                  {stats?.guild ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <Shield className="w-16 h-16 text-primary mb-4 opacity-80" />
                      <h4 className="text-2xl font-bold text-white">{stats.guild.name}</h4>
                      <p className="text-muted-foreground mt-2">Level {stats.guild.level} Guild</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <div className="w-16 h-16 rounded-full border border-dashed border-muted-foreground flex items-center justify-center mb-4">
                        <Shield className="w-8 h-8 text-muted-foreground" />
                      </div>
                      <p className="text-muted-foreground">Not affiliated with any guild.</p>
                      <p className="text-xs text-muted-foreground mt-2 font-mono">Use <span className="text-primary">.guild create</span> in WhatsApp</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="skills" className="space-y-6">
          <SkillsPanel stats={stats} statsLoading={statsLoading} token={token} base={base} />
        </TabsContent>

        <TabsContent value="inventory">
          <div className="glass-card rounded-xl p-6 border border-white/10">
            <h3 className="font-bold text-xl text-white mb-6">Your Inventory</h3>
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
                <p>Your inventory is empty. Visit the shop to get started.</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="frame">
          <FramePanel token={token} base={base} currentFrame={profile?.profileFrame || ""} onFrameSet={() => refetchStats()} />
        </TabsContent>

        <TabsContent value="achievements">
          <div className="glass-card rounded-xl p-6 border border-white/10">
            <h3 className="font-bold text-xl text-white mb-6">Achievements</h3>
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
        <div className={cn("h-full rounded-full", color)} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

const SKILLS_META = [
  { key: "str", label: "Strength", icon: Flame, color: "text-orange-400", barColor: "bg-orange-500", effect: "+2 Attack per point", statKey: "strSkill" },
  { key: "agi", label: "Agility", icon: Wind, color: "text-cyan-400", barColor: "bg-cyan-500", effect: "+2 Speed per point", statKey: "agiSkill" },
  { key: "int", label: "Intellect", icon: Brain, color: "text-violet-400", barColor: "bg-violet-500", effect: "+5% XP gained per point", statKey: "intSkill" },
  { key: "vit", label: "Vitality", icon: Heart, color: "text-red-400", barColor: "bg-red-500", effect: "+10 Max HP per point", statKey: "vitSkill" },
  { key: "luk", label: "Luck", icon: Star, color: "text-amber-400", barColor: "bg-amber-500", effect: "+3% gold drops per point", statKey: "lukSkill" },
] as const;

function SkillsPanel({ stats, statsLoading, token, base }: any) {
  const [assigning, setAssigning] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const rpg = stats?.rpg;
  const skillPoints = rpg?.skillPoints ?? 0;
  const SKILL_MAX = 20;

  async function assign(stat: string) {
    if (!token || skillPoints <= 0) return;
    setAssigning(stat);
    try {
      const res = await fetch(`${base}/api/v1/user/skills/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ stat, points: 1 }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Skill Upgraded!", description: data.message });
        queryClient.invalidateQueries({ queryKey: ["/api/v1/user/stats"] });
      } else {
        toast({ title: "Failed", description: data.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Could not assign skill point.", variant: "destructive" });
    } finally {
      setAssigning(null);
    }
  }

  if (statsLoading) return <div className="h-64 glass-card rounded-lg animate-pulse" />;

  if (!rpg) {
    return (
      <div className="glass-card rounded-xl p-12 border border-white/10 flex flex-col items-center justify-center text-center">
        <Swords className="w-16 h-16 text-muted-foreground mb-4 opacity-30" />
        <h3 className="text-xl font-bold text-white mb-2">No RPG Character</h3>
        <p className="text-muted-foreground">Use <span className="font-mono text-primary">.dungeon</span> in WhatsApp to create your character and start earning skill points.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className={cn(
        "glass-card rounded-xl p-6 border flex items-center justify-between gap-4",
        skillPoints > 0 ? "border-amber-500/40 bg-amber-500/5" : "border-white/10"
      )}>
        <div>
          <h3 className="font-bold text-xl text-white mb-1 flex items-center gap-2">
            <Star className={cn("w-5 h-5", skillPoints > 0 ? "text-amber-400" : "text-muted-foreground")} />
            Skill Points Available
          </h3>
          <p className="text-sm text-muted-foreground">Earned by clearing dungeon floors (every 3rd floor). Max 20 per skill.</p>
        </div>
        <div className={cn("text-5xl font-bold shrink-0", skillPoints > 0 ? "text-amber-400" : "text-muted-foreground")}>
          {skillPoints}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {SKILLS_META.map(({ key, label, icon: Icon, color, barColor, effect, statKey }) => {
          const current = rpg[statKey] ?? 0;
          const pct = Math.round((current / SKILL_MAX) * 100);
          const isMaxed = current >= SKILL_MAX;
          const isLoading = assigning === key;

          return (
            <Card key={key} className={cn("glass-card border-white/10 bg-black/30 transition-colors", skillPoints > 0 && !isMaxed ? "hover:border-primary/30" : "")}>
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn("w-9 h-9 rounded-lg bg-black/50 border border-white/10 flex items-center justify-center", color)}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-white uppercase tracking-wider text-sm">{label}</p>
                      <p className="text-[10px] text-muted-foreground">{effect}</p>
                    </div>
                  </div>
                  <span className={cn("text-2xl font-bold", color)}>{current}</span>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] text-muted-foreground mb-1.5">
                    <span>Level {current} / {SKILL_MAX}</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="h-2 bg-black rounded-full overflow-hidden border border-white/5">
                    <div className={cn("h-full rounded-full transition-all", barColor)} style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <Button
                  onClick={() => assign(key)}
                  disabled={isLoading || skillPoints <= 0 || isMaxed}
                  className={cn(
                    "w-full text-xs font-bold uppercase tracking-wider h-8",
                    isMaxed
                      ? "bg-white/5 text-muted-foreground border border-white/10 cursor-not-allowed"
                      : skillPoints > 0
                      ? "bg-primary/20 hover:bg-primary text-primary hover:text-white border border-primary/50"
                      : "bg-white/5 text-muted-foreground border border-white/10 cursor-not-allowed"
                  )}
                >
                  {isLoading ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Assigning...</>
                    : isMaxed ? "Maxed Out"
                    : <><Plus className="w-3 h-3 mr-1" /> Assign Point {skillPoints > 0 && `(${skillPoints} left)`}</>}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="glass-card rounded-xl p-4 border border-white/10 bg-black/20">
        <p className="text-xs text-muted-foreground leading-relaxed">
          <span className="text-primary font-bold">How to earn skill points:</span> Clear dungeon floors in WhatsApp with <span className="font-mono text-primary">.dungeon</span>. You earn <span className="text-white font-bold">1 skill point every 3 floors</span>. Skill effects apply automatically during dungeon battles.
        </p>
      </div>
    </div>
  );
}

function FramePanel({ token, base, currentFrame, onFrameSet }: any) {
  const [frames, setFrames] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(currentFrame || "");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useState(() => {
    fetch(`${base}/api/bot/frames`)
      .then(r => r.json())
      .then(d => { setFrames(d.frames || []); setLoading(false); })
      .catch(() => setLoading(false));
  });

  async function saveFrame(frameId: string) {
    setSaving(true);
    try {
      const res = await fetch(`${base}/api/v1/user/frame`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ frameId }),
      });
      const data = await res.json();
      if (data.success) {
        setSelected(frameId);
        toast({ title: "Frame Set", description: "Your profile frame has been updated." });
        onFrameSet?.();
      } else {
        toast({ title: "Failed", description: data.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Could not set frame.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="h-48 glass-card rounded-xl animate-pulse" />;

  return (
    <div className="glass-card rounded-xl p-6 border border-white/10">
      <div className="flex items-center gap-3 mb-6">
        <LayoutGrid className="w-5 h-5 text-primary" />
        <h3 className="font-bold text-xl text-white">Profile Frames</h3>
        {currentFrame && <span className="text-xs text-primary border border-primary/30 px-2 py-0.5 rounded-full">Active: {frames.find(f => f.id === currentFrame)?.name || currentFrame}</span>}
      </div>

      {frames.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground border border-dashed border-white/10 rounded-lg">
          <LayoutGrid className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p>No frames available yet. Frames are added by guardians via WhatsApp.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <div
            onClick={() => saveFrame("")}
            className={cn(
              "relative cursor-pointer rounded-xl border-2 p-4 flex flex-col items-center gap-2 transition-all",
              selected === "" ? "border-primary bg-primary/10" : "border-white/10 hover:border-primary/40 bg-black/30"
            )}
          >
            <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
              <span className="text-2xl opacity-30">✕</span>
            </div>
            <p className="text-xs text-center text-muted-foreground">No Frame</p>
            {selected === "" && <div className="absolute top-2 right-2 w-4 h-4 bg-primary rounded-full flex items-center justify-center"><Check className="w-2.5 h-2.5 text-white" /></div>}
          </div>

          {frames.map((frame) => (
            <div
              key={frame.id}
              onClick={() => !saving && saveFrame(frame.id)}
              className={cn(
                "relative cursor-pointer rounded-xl border-2 p-4 flex flex-col items-center gap-2 transition-all",
                selected === frame.id ? "border-primary bg-primary/10" : "border-white/10 hover:border-primary/40 bg-black/30"
              )}
            >
              <div className="w-16 h-16 rounded-full overflow-hidden border border-white/10">
                <img
                  src={`${base}/api/bot/frames/${frame.id}/image`}
                  alt={frame.name}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </div>
              <p className="text-xs text-center text-white font-medium">{frame.name}</p>
              {selected === frame.id && <div className="absolute top-2 right-2 w-4 h-4 bg-primary rounded-full flex items-center justify-center"><Check className="w-2.5 h-2.5 text-white" /></div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
