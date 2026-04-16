import { useState } from "react";
import { useGetAllCards, useGetMyCards, useAddCardToWishlist } from "@workspace/api-client-react/src/generated/api";
import { useAuth } from "@/lib/auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Heart, CreditCard, Lock, Flame, Gavel, Sparkles, Star, Users, ImageOff, Swords, Shield, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const TIER_COLORS: Record<string, { bg: string, text: string, border: string, glow: string }> = {
  "T1": { bg: "bg-gray-500/20", text: "text-gray-300", border: "border-gray-500/50", glow: "shadow-[0_0_10px_rgba(156,163,175,0.5)]" },
  "T2": { bg: "bg-green-500/20", text: "text-green-400", border: "border-green-500/50", glow: "shadow-[0_0_10px_rgba(74,222,128,0.5)]" },
  "T3": { bg: "bg-blue-500/20", text: "text-blue-400", border: "border-blue-500/50", glow: "shadow-[0_0_10px_rgba(96,165,250,0.5)]" },
  "T4": { bg: "bg-purple-500/20", text: "text-purple-400", border: "border-purple-500/50", glow: "shadow-[0_0_10px_rgba(168,85,247,0.5)]" },
  "T5": { bg: "bg-amber-500/20", text: "text-amber-400", border: "border-amber-500/50", glow: "shadow-[0_0_15px_rgba(245,158,11,0.6)]" },
  "T6": { bg: "bg-red-500/20", text: "text-red-400", border: "border-red-500/50", glow: "shadow-[0_0_20px_rgba(239,68,68,0.7)]" },
  "TS": { bg: "bg-amber-300/20", text: "text-amber-300", border: "border-amber-300/60", glow: "shadow-[0_0_25px_rgba(252,211,77,0.8)]" },
  "TX": { bg: "bg-violet-500/20", text: "text-violet-300", border: "border-violet-500/50", glow: "shadow-[0_0_20px_rgba(196,181,253,0.6)]" },
  "TZ": { bg: "bg-cyan-500/20", text: "text-cyan-300", border: "border-cyan-500/50", glow: "shadow-[0_0_20px_rgba(103,232,249,0.6)]" },
};

export default function Cards() {
  const { isAuthenticated, user } = useAuth();
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

  const isPremium = (user as any)?.premium === 1;

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-3xl md:text-4xl font-bold text-white neon-text-purple tracking-widest uppercase">Card Codex</h1>
          <p className="text-muted-foreground mt-2">Collect and trade the shadows of this world.</p>
        </div>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="flex w-full max-w-2xl bg-black/40 border border-white/10 p-1 gap-1 overflow-x-auto">
          <TabsTrigger value="all" className="flex-1 data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:neon-border-purple font-bold tracking-wider uppercase text-xs rounded-sm whitespace-nowrap">All Cards</TabsTrigger>
          <TabsTrigger value="my" disabled={!isAuthenticated} className="flex-1 data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:neon-border-purple font-bold tracking-wider uppercase text-xs rounded-sm whitespace-nowrap">
            My Collection {isAuthenticated && myCards ? `(${myCards.total})` : ''}
          </TabsTrigger>
          <TabsTrigger value="gacha" className="flex-1 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400 font-bold tracking-wider uppercase text-xs rounded-sm whitespace-nowrap">
            Gacha {!isPremium && <Lock className="inline w-3 h-3 ml-1 opacity-60" />}
          </TabsTrigger>
          <TabsTrigger value="fusion" className="flex-1 data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400 font-bold tracking-wider uppercase text-xs rounded-sm whitespace-nowrap">Fusion</TabsTrigger>
          <TabsTrigger value="auction" className="flex-1 data-[state=active]:bg-green-500/20 data-[state=active]:text-green-400 font-bold tracking-wider uppercase text-xs rounded-sm whitespace-nowrap">Auction</TabsTrigger>
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
              <SelectItem value="T6">Tier 6 (Mythic)</SelectItem>
              <SelectItem value="TS">Tier S (Shadow)</SelectItem>
              <SelectItem value="TX">Tier X (Extreme)</SelectItem>
              <SelectItem value="TZ">Tier Z (Zenith)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* ALL CARDS */}
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

        {/* MY COLLECTION */}
        <TabsContent value="my" className="mt-0">
          {loadingMy ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {[1,2,3,4].map(i => <CardSkeleton key={i} />)}
            </div>
          ) : myCards?.cards && myCards.cards.length > 0 ? (
             <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {myCards.cards.map(userCard => <CardDisplay key={userCard.userCardId} card={userCard.card} count={1} showOwner />)}
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

        {/* GACHA (PREMIUM ONLY) */}
        <TabsContent value="gacha" className="mt-0">
          {!isPremium ? (
            <div className="py-24 text-center glass-card rounded-xl border border-amber-500/20 flex flex-col items-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-amber-500/5 to-transparent" />
              <div className="relative z-10">
                <div className="w-20 h-20 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-6 mx-auto shadow-[0_0_30px_rgba(245,158,11,0.3)]">
                  <Lock className="w-10 h-10 text-amber-400" />
                </div>
                <h3 className="font-serif text-2xl font-bold text-amber-400 mb-3 neon-text-gold">Gacha System</h3>
                <p className="text-muted-foreground max-w-md mx-auto mb-6">
                  The Shadow Gacha is restricted to premium operatives only. Upgrade your status to pull legendary cards from the void.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <div className="px-6 py-2 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 text-sm font-bold tracking-widest uppercase">
                    Premium Members Only
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="text-center py-12 glass-card rounded-xl border border-amber-500/30 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-purple-500/5 to-transparent" />
                <div className="relative z-10">
                  <Sparkles className="w-12 h-12 text-amber-400 mx-auto mb-4 animate-pulse" />
                  <h3 className="font-serif text-3xl font-bold text-amber-400 mb-3 neon-text-gold">Shadow Gacha</h3>
                  <p className="text-muted-foreground mb-8 max-w-lg mx-auto">Pull from the void and claim shadows of the other world. Each pull costs <span className="text-amber-400 font-bold">500 Gold</span>.</p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Button className="bg-amber-500/20 hover:bg-amber-500/40 text-amber-400 border border-amber-500/50 font-bold tracking-widest uppercase px-8 h-12 shadow-[0_0_20px_rgba(245,158,11,0.3)]">
                      <Star className="w-4 h-4 mr-2" /> Single Pull — 500 Gold
                    </Button>
                    <Button className="bg-purple-500/20 hover:bg-purple-500/40 text-purple-400 border border-purple-500/50 font-bold tracking-widest uppercase px-8 h-12 shadow-[0_0_20px_rgba(168,85,247,0.3)]">
                      <Sparkles className="w-4 h-4 mr-2" /> 10x Pull — 4,500 Gold
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-6">Use <span className="text-primary font-mono">.draw</span> in the WhatsApp group to pull cards via the bot.</p>
                </div>
              </div>

              <div className="grid grid-cols-3 md:grid-cols-5 gap-4">
                {["T1","T2","T3","T4","T5"].map((tier, i) => {
                  const theme = TIER_COLORS[tier];
                  const rates = ["45%", "30%", "15%", "8%", "2%"];
                  const names = ["Common", "Uncommon", "Rare", "Epic", "Legendary"];
                  return (
                    <div key={tier} className={cn("glass-card rounded-lg p-4 border text-center", theme.border)}>
                      <div className={cn("text-xl font-serif font-bold mb-1", theme.text)}>{tier}</div>
                      <div className="text-xs text-muted-foreground mb-2">{names[i]}</div>
                      <div className={cn("text-sm font-bold font-mono", theme.text)}>{rates[i]}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>

        {/* FUSION */}
        <TabsContent value="fusion" className="mt-0">
          <div className="py-24 text-center glass-card rounded-xl border border-blue-500/20 flex flex-col items-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent" />
            <div className="relative z-10">
              <div className="w-20 h-20 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center mb-6 mx-auto shadow-[0_0_30px_rgba(96,165,250,0.3)]">
                <Flame className="w-10 h-10 text-blue-400 animate-pulse" />
              </div>
              <h3 className="font-serif text-2xl font-bold text-blue-400 mb-3">Card Fusion</h3>
              <p className="text-muted-foreground max-w-md mx-auto mb-4">
                Sacrifice lower-tier cards and Gold to forge a card of higher power. The shadows must be consumed to birth something greater.
              </p>
              <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto mb-8 mt-6">
                <div className="glass-card rounded-lg p-3 border border-gray-500/30 text-center opacity-60">
                  <div className="text-xs text-gray-400 mb-1">T1 + T1</div>
                  <div className="text-xs text-muted-foreground">→ T2</div>
                </div>
                <div className="glass-card rounded-lg p-3 border border-green-500/30 text-center opacity-60">
                  <div className="text-xs text-green-400 mb-1">T2 + T2</div>
                  <div className="text-xs text-muted-foreground">→ T3</div>
                </div>
                <div className="glass-card rounded-lg p-3 border border-blue-500/30 text-center opacity-60">
                  <div className="text-xs text-blue-400 mb-1">T3 + T3</div>
                  <div className="text-xs text-muted-foreground">→ T4</div>
                </div>
              </div>
              <div className="px-6 py-2 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400 text-sm font-bold tracking-widest uppercase">
                Coming Soon — In Development
              </div>
            </div>
          </div>
        </TabsContent>

        {/* AUCTION */}
        <TabsContent value="auction" className="mt-0">
          <div className="py-24 text-center glass-card rounded-xl border border-green-500/20 flex flex-col items-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-green-500/5 to-transparent" />
            <div className="relative z-10">
              <div className="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mb-6 mx-auto shadow-[0_0_30px_rgba(74,222,128,0.3)]">
                <Gavel className="w-10 h-10 text-green-400" />
              </div>
              <h3 className="font-serif text-2xl font-bold text-green-400 mb-3">Shadow Auction House</h3>
              <p className="text-muted-foreground max-w-md mx-auto mb-4">
                List your cards for auction and let the highest bidder claim them. Trade rare shadows with operatives across the realm.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-xl mx-auto mb-8 mt-6 text-left">
                <div className="glass-card rounded-lg p-4 border border-green-500/20">
                  <h4 className="text-sm font-bold text-green-400 mb-1">List a Card</h4>
                  <p className="text-xs text-muted-foreground">Set your asking price and duration for the auction.</p>
                </div>
                <div className="glass-card rounded-lg p-4 border border-green-500/20">
                  <h4 className="text-sm font-bold text-green-400 mb-1">Place Bids</h4>
                  <p className="text-xs text-muted-foreground">Outbid rivals to claim powerful cards for your collection.</p>
                </div>
                <div className="glass-card rounded-lg p-4 border border-green-500/20">
                  <h4 className="text-sm font-bold text-green-400 mb-1">Auto-Settle</h4>
                  <p className="text-xs text-muted-foreground">Winner is determined automatically when time expires.</p>
                </div>
              </div>
              <div className="px-6 py-2 rounded-full border border-green-500/30 bg-green-500/10 text-green-400 text-sm font-bold tracking-widest uppercase">
                Coming Soon — In Development
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CardDisplay({ card, count, showOwner }: { card: any, count?: number, showOwner?: boolean }) {
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const theme = TIER_COLORS[card.tier] || TIER_COLORS["T1"];
  
  const wishlistMutation = useAddCardToWishlist({
    mutation: {
      onSuccess: () => {
        toast({
          title: "Wishlist Updated",
          description: `${card.name} added to your wishlist. The owner will be notified.`,
        });
      },
      onError: () => {
        toast({
          title: "Wishlist Failed",
          description: "Could not add to wishlist. Please try again.",
          variant: "destructive",
        });
      }
    }
  });

  const handleWishlist = () => {
    if (!isAuthenticated) {
      toast({
        title: "Login Required",
        description: "You must be logged in to add cards to your wishlist.",
        variant: "destructive",
      });
      return;
    }
    wishlistMutation.mutate({ data: { cardId: card.id } });
  };

  return (
    <div className="relative group">
      <div className={cn(
        "glass-card rounded-xl overflow-hidden border transition-all duration-300 group-hover:-translate-y-2",
        theme.border,
        "hover:" + theme.glow
      )}>
        {/* Card Header image area */}
        <div className={cn("aspect-[7/9] w-full relative", theme.bg)}>
          {card.imageUrl ? (
            <img
              src={card.imageUrl}
              alt={card.name}
              className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center opacity-10">
              <ImageOff className="w-10 h-10" />
            </div>
          )}
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
            {showOwner && card.ownerName && (
              <p className="text-[10px] text-muted-foreground truncate">Owner: {card.ownerName}</p>
            )}
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
          
          {/* Owners */}
          {(card as any).owners?.length > 0 && (
            <div className="mb-3 border-t border-white/5 pt-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1.5">Owners</p>
              <div className="flex flex-wrap gap-1">
                {(card as any).owners.slice(0, 4).map((o: any) => (
                  <span key={o.id} className="text-[10px] bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-white/70 truncate max-w-[90px]">
                    {o.name || "Shadow"}
                  </span>
                ))}
                {(card as any).owners.length > 4 && (
                  <span className="text-[10px] text-muted-foreground">+{(card as any).owners.length - 4} more</span>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-white/5 pt-3">
            <span className="flex items-center gap-1">
              <Star className="w-3 h-3 text-yellow-500/70" />
              {card.totalCopies || 0} issue{(card.totalCopies || 0) !== 1 ? "s" : ""} in existence
            </span>
            <button 
              onClick={handleWishlist}
              disabled={wishlistMutation.isPending}
              className={cn(
                "transition-colors",
                wishlistMutation.isPending ? "opacity-50" : "hover:text-red-400"
              )}
              title="Add to Wishlist — notify the owner"
            >
              <Heart className={cn("w-4 h-4", wishlistMutation.isSuccess && "text-red-400 fill-red-400")} />
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
      <div className="aspect-[7/9] w-full bg-white/5" />
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
