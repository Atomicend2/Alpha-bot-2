import { useGetShopItems, useBuyShopItem, useGetUserStats } from "@workspace/api-client-react/src/generated/api";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wallet, Info, Sparkles, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

export default function Shop() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: shopData, isLoading: loadingShop } = useGetShopItems();
  const { data: userStats } = useGetUserStats({ query: { enabled: isAuthenticated } });

  const buyItemMutation = useBuyShopItem({
    mutation: {
      onSuccess: (data) => {
        toast({
          title: "Purchase Successful",
          description: data.message,
        });
        // Invalidate to update balance and inventory
        queryClient.invalidateQueries({ queryKey: ["/api/v1/user/stats"] });
        queryClient.invalidateQueries({ queryKey: ["/api/v1/user/inventory"] });
      },
      onError: (error) => {
        toast({
          title: "Transaction Failed",
          description: error.message || "You do not have enough currency.",
          variant: "destructive",
        });
      }
    }
  });

  const handleBuy = (itemId: number) => {
    if (!isAuthenticated) {
      toast({
        title: "Authentication Required",
        description: "You must be logged in to make purchases.",
        variant: "destructive"
      });
      return;
    }
    buyItemMutation.mutate({ data: { itemId, quantity: 1 } });
  };

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-4">
        <div>
          <h1 className="font-serif text-3xl md:text-4xl font-bold text-white neon-text-purple tracking-widest uppercase">The Black Market</h1>
          <p className="text-muted-foreground mt-2">Trade your gold for power. All transactions are final.</p>
        </div>
        
        {isAuthenticated && userStats && (
          <div className="glass-card px-4 py-2 flex items-center gap-3 border-primary/30 rounded-full bg-black/60 shadow-[0_0_15px_rgba(0,0,0,0.5)]">
            <Wallet className="w-4 h-4 text-amber-400" />
            <span className="text-sm text-muted-foreground uppercase tracking-widest">Balance:</span>
            <span className="font-mono text-lg font-bold text-amber-400">{userStats.profile.balance.toLocaleString()}</span>
          </div>
        )}
      </div>

      {loadingShop ? (
        <div className="space-y-12">
          {[1, 2].map(cat => (
            <div key={cat}>
              <div className="h-8 w-48 bg-white/5 rounded animate-pulse mb-6" />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {[1,2,3,4].map(i => (
                  <div key={i} className="h-64 glass-card rounded-xl animate-pulse bg-white/5" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : shopData?.categories ? (
        <div className="space-y-16">
          {shopData.categories.map((category) => (
            <div key={category.name}>
              <div className="flex items-center gap-4 mb-6">
                <h2 className="font-serif text-2xl font-bold text-white capitalize tracking-widest">{category.name}</h2>
                <div className="h-[1px] flex-1 bg-gradient-to-r from-primary/50 to-transparent" />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {category.items.map(item => (
                  <Card key={item.id} className="glass-card border-white/10 bg-black/40 flex flex-col group hover:border-primary/50 transition-colors">
                    <CardHeader className="pb-4">
                      <div className="flex justify-between items-start mb-2">
                        <Badge variant="outline" className={cn(
                          "uppercase tracking-widest text-[10px] border-white/20",
                          category.name.toLowerCase() === "passive" ? "text-blue-400 border-blue-400/30" : 
                          category.name.toLowerCase() === "consumable" ? "text-green-400 border-green-400/30" : 
                          "text-purple-400 border-purple-400/30"
                        )}>
                          {category.name}
                        </Badge>
                      </div>
                      <CardTitle className="font-serif text-xl text-white">{item.name}</CardTitle>
                      <CardDescription className="text-muted-foreground min-h-[40px]">
                        {item.description}
                      </CardDescription>
                    </CardHeader>
                    
                    <CardContent className="flex-1 pb-4">
                      <div className="bg-black/50 p-3 rounded-lg border border-white/5 mb-4">
                        <div className="flex items-start gap-2">
                          <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                          <p className="text-xs text-gray-300 leading-relaxed">{item.effect}</p>
                        </div>
                      </div>
                    </CardContent>
                    
                    <CardFooter className="pt-0 flex items-center justify-between border-t border-white/5 px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-lg font-bold text-amber-400">{item.price.toLocaleString()}</span>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Gold</span>
                      </div>
                      <Button 
                        onClick={() => handleBuy(item.id)}
                        disabled={buyItemMutation.isPending || (isAuthenticated && userStats && userStats.profile.balance < item.price)}
                        className="bg-primary/20 hover:bg-primary text-primary hover:text-white border border-primary/50 transition-all text-xs font-bold tracking-widest uppercase rounded-sm"
                      >
                        Purchase
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 text-muted-foreground glass-card rounded-xl">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p>The shop is currently closed. Come back later.</p>
        </div>
      )}
    </div>
  );
}