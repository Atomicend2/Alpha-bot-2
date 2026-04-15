import { MapPin, Skull, Castle, Shield } from "lucide-react";

export default function World() {
  const REGIONS = [
    { id: 1, name: "Oriana Capital", desc: "The heart of the kingdom, currently under surveillance.", x: "50%", y: "40%", icon: Castle, color: "text-amber-400" },
    { id: 2, name: "Shadow Garden HQ", desc: "Our hidden base of operations. Unfindable by ordinary means.", x: "20%", y: "70%", icon: Shield, color: "text-primary" },
    { id: 3, name: "Sanctuary of Diablos", desc: "Ancient ruins where the Cult conducts their dark experiments.", x: "80%", y: "20%", icon: Skull, color: "text-red-500" },
    { id: 4, name: "Midgar Academy", desc: "A prestigious school for dark knights.", x: "35%", y: "30%", icon: MapPin, color: "text-blue-400" },
    { id: 5, name: "Lawless City", desc: "A wretched hive of scum and villainy. Perfect for gathering intel.", x: "70%", y: "80%", icon: MapPin, color: "text-orange-500" },
  ];

  return (
    <div className="min-h-screen relative bg-black overflow-hidden flex flex-col">
      {/* Header overlay */}
      <div className="absolute top-0 left-0 right-0 z-20 p-6 md:p-8 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
        <h1 className="font-serif text-3xl md:text-5xl font-bold text-white neon-text-purple tracking-widest uppercase">The Known World</h1>
        <p className="text-muted-foreground mt-2 max-w-xl">Interactive map of the Oriana Kingdom and surrounding territories. The Cult's influence spreads like a plague.</p>
      </div>

      {/* Map Container */}
      <div className="flex-1 relative w-full h-full min-h-[800px] overflow-hidden group">
        <img 
          src="/images/world-map.png" 
          alt="World Map" 
          className="absolute inset-0 w-full h-full object-cover opacity-60 transition-transform duration-[20s] ease-linear group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
        
        {/* Regions */}
        {REGIONS.map((region) => (
          <div 
            key={region.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 group/marker cursor-crosshair z-10"
            style={{ left: region.x, top: region.y }}
          >
            <div className="relative">
              {/* Pulse effect */}
              <div className={`absolute inset-0 rounded-full animate-ping opacity-20 ${region.color.replace('text', 'bg')}`} />
              
              {/* Marker icon */}
              <div className={`w-12 h-12 rounded-full glass-card border border-white/10 flex items-center justify-center relative z-10 hover:border-primary/50 hover:scale-110 transition-all ${region.color}`}>
                <region.icon className="w-6 h-6" />
              </div>
              
              {/* Tooltip */}
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-4 w-64 glass-panel p-4 rounded-lg opacity-0 translate-y-2 pointer-events-none group-hover/marker:opacity-100 group-hover/marker:translate-y-0 transition-all duration-300 z-50">
                <h3 className="font-serif text-lg font-bold text-white mb-1">{region.name}</h3>
                <p className="text-sm text-gray-400">{region.desc}</p>
                <div className="mt-3 text-xs font-bold text-primary tracking-widest uppercase border-t border-white/10 pt-2 text-center">
                  Survey Region
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Legend */}
      <div className="absolute bottom-20 md:bottom-8 right-4 md:right-8 z-20 glass-panel p-4 rounded-lg">
        <h4 className="text-xs font-bold tracking-widest uppercase text-muted-foreground mb-3 border-b border-white/10 pb-2">Map Legend</h4>
        <ul className="space-y-2 text-sm">
          <li className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-primary shadow-[0_0_8px_rgba(168,85,247,0.8)]" /> Friendly / HQ</li>
          <li className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" /> Hostile / Cult</li>
          <li className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]" /> Capital</li>
          <li className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-blue-400" /> Neutral Zone</li>
        </ul>
      </div>
    </div>
  );
}