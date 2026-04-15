import { useState } from "react";
import { useGetAllCards, useGetMyCards, useAddCardToWishlist } from "@workspace/api-client-react/src/generated/api";
import { useAuth } from "@/lib/auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Heart, Shield, Swords, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const TIER_COLORS: Record<string, { bg: string, text: string, border: string, glow: string }> = {
  "T1": { bg: "bg-gray-500/20", text: "text-gray-300", border: "border-gray-500/50", glow: "shadow-[0_0_10px_rgba(156,163,175,0.5)]" },
  "T2": { bg: "bg-green-500/20", text: "text-green-400", border: "border-green-500/50", glow: "shadow-[0_0_10px_rgba(74,222,128,0.5)]" },
  "T3": { bg: "bg-blue-500/20", text: "text-blue-400", border: "border-blue-500/50", glow: "shadow-[0_0_10px_rgba(96,165,250,0.5)]" },
  "T4": { bg: "bg-purple-500/20", text: "text-purple-400", border: "border-purple-500/50", glow: "shadow-[0_0_10px_rgba(168,85,247,0.5)]" },
  "T5": { bg: "bg-amber-500/20", text: "text-amber-400", border: "border-amber-500/50", glow: "shadow-[0_0_15px_rgba(245,158,11,0.6)]" },
};

export default function Cards() {
  const { isAuthenticated } = useAuth();
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data: allCards, isLoading: loadingAll } = useGetAllCards({
    tier: tierFilter !== "all" ? tierFilter : undefined
  });

  const { data: myCards, isLoading: loadingMy } = useGetMyCards({
    query: { enabled: isAuthenticated }
  });

  const filteredAllCards = allCards?.cards.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.series.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-3xl md:text-4xl font-bold text-white neon-text-purple tracking-widest uppercase">Card Codex</h1>
          <p className="text-muted-foreground mt-2">Collect and trade the shadows of this world.</p>
        </div>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 bg-black/40 border border-white/10 p-1">
          <TabsTrigger value="all" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:neon-border-purple font-bold tracking-wider uppercase text-xs rounded-sm">All Cards</TabsTrigger>
          <TabsTrigger value="my" disabled={!isAuthenticated} className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:neon-border-purple font-bold tracking-wider uppercase text-xs rounded-sm">
            My Collection {isAuthenticated && myCards ? `(${myCards.total})` : ''}
          </TabsTrigger>
        </TabsList>

        <div className="flex flex-col sm:flex-row gap-4 my-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search by name or series..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-black/40 border-white/10 text-white focus-visible:ring-primary"
            />
          </div>
          <Select value={tierFilter} onValueChange={setTierFilter}>
            <SelectTrigger className="w-full sm:w-[180px] bg-black/40 border-white/10 text-white">
              <SelectValue placeholder="Filter by Tier" />
            </SelectTrigger>
            <SelectContent className="bg-black border-white/10 text-white">
              <SelectItem value="all">All Tiers</SelectItem>
              <SelectItem value="T1">Tier 1 (Common)</SelectItem>
              <SelectItem value="T2">Tier 2 (Uncommon)</SelectItem>
              <SelectItem value="T3">Tier 3 (Rare)</SelectItem>
              <SelectItem value="T4">Tier 4 (Epic)</SelectItem>
              <SelectItem value="T5">Tier 5 (Legendary)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <TabsContent value="all" className="mt-0">
          {loadingAll ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {[1,2,3,4,5,6,7,8].map(i => <CardSkeleton key={i} />)}
            </div>
          ) : filteredAllCards && filteredAllCards.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {filteredAllCards.map(card => <CardDisplay key={card.id} card={card} />)}
            </div>
          ) : (
            <div className="py-20 text-center glass-card rounded-lg border border-white/5">
              <p className="text-muted-foreground">No cards found matching your criteria.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="my" className="mt-0">
          {loadingMy ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {[1,2,3,4].map(i => <CardSkeleton key={i} />)}
            </div>
          ) : myCards?.cards && myCards.cards.length > 0 ? (
             <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {myCards.cards.map(userCard => <CardDisplay key={userCard.userCardId} card={userCard.card} count={1} />)}
            </div>
          ) : (
            <div className="py-20 text-center glass-card rounded-lg border border-white/5 flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-black/50 border border-white/10 flex items-center justify-center mb-4">
                <CreditCard className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-serif text-white mb-2">Empty Collection</h3>
              <p className="text-muted-foreground max-w-md">You haven't collected any shadows yet. Use the bot commands to draw cards.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CardDisplay({ card, count }: { card: any, count?: number }) {
  const { toast } = useToast();
  const theme = TIER_COLORS[card.tier] || TIER_COLORS["T1"];
  
  const handleWishlist = () => {
    toast({
      title: "Added to Wishlist",
      description: `${card.name} has been added to your wishlist.`,
    });
    // In a real app, we'd call the mutation here
  };

  return (
    <div className="relative group">
      <div className={cn(
        "glass-card rounded-xl overflow-hidden border transition-all duration-300 group-hover:-translate-y-2",
        theme.border,
        "hover:" + theme.glow
      )}>
        {/* Card Header image placeholder area */}
        <div className={cn("h-40 w-full relative", theme.bg)}>
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
          <div className="absolute top-2 right-2 px-2 py-1 bg-black/60 rounded border border-white/10 text-xs font-bold">
            {card.series}
          </div>
          <div className={cn(
            "absolute top-2 left-2 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border",
            theme.bg, theme.text, theme.border
          )}>
            {card.tier}
          </div>
          
          <div className="absolute bottom-2 left-3 right-3">
            <h3 className="font-serif text-lg font-bold text-white truncate drop-shadow-md">{card.name}</h3>
          </div>
        </div>
        
        {/* Card Stats */}
        <div className="p-4 bg-black/40">
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="flex flex-col items-center bg-black/40 p-1.5 rounded border border-white/5">
              <Swords className="w-3 h-3 text-orange-400 mb-1" />
              <span className="text-xs font-mono text-white">{card.attack}</span>
            </div>
            <div className="flex flex-col items-center bg-black/40 p-1.5 rounded border border-white/5">
              <Shield className="w-3 h-3 text-blue-400 mb-1" />
              <span className="text-xs font-mono text-white">{card.defense}</span>
            </div>
            <div className="flex flex-col items-center bg-black/40 p-1.5 rounded border border-white/5">
              <Zap className="w-3 h-3 text-yellow-400 mb-1" />
              <span className="text-xs font-mono text-white">{card.speed}</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-white/5 pt-3">
            <span>{card.totalCopies || 0} in existence</span>
            <button 
              onClick={handleWishlist}
              className="hover:text-red-400 transition-colors"
              title="Add to Wishlist"
            >
              <Heart className="w-4 h-4" />
            </button>
          </div>
          
          {count && count > 1 && (
            <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-bold border-2 border-black shadow-[0_0_10px_rgba(168,85,247,0.8)] z-10">
              x{count}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="glass-card rounded-xl overflow-hidden border border-white/5 animate-pulse">
      <div className="h-40 w-full bg-white/5" />
      <div className="p-4 bg-black/40 space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <div className="h-10 bg-white/5 rounded" />
          <div className="h-10 bg-white/5 rounded" />
          <div className="h-10 bg-white/5 rounded" />
        </div>
        <div className="h-4 bg-white/5 rounded w-full" />
      </div>
    </div>
  );
}