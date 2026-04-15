import { useState } from "react";
import { useLocation } from "wouter";
import { useSendOtp, useVerifyOtp } from "@workspace/api-client-react/src/generated/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function Login() {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const sendOtpMutation = useSendOtp({
    mutation: {
      onSuccess: () => {
        setStep("code");
        toast({
          title: "Code Sent",
          description: "Check your WhatsApp for the verification code from the Shadow Garden bot.",
        });
      },
      onError: (error) => {
        toast({
          title: "Error",
          description: error.message || "Failed to send code. Please try again.",
          variant: "destructive",
        });
      }
    }
  });

  const verifyOtpMutation = useVerifyOtp({
    mutation: {
      onSuccess: (data) => {
        if (data.success && data.token) {
          login(data.token, data.user);
          toast({
            title: "Welcome",
            description: "You have successfully entered the Shadow Garden.",
          });
          setLocation("/profile");
        } else {
          toast({
            title: "Authentication Failed",
            description: "Invalid response from server.",
            variant: "destructive",
          });
        }
      },
      onError: (error) => {
        toast({
          title: "Invalid Code",
          description: error.message || "The code you entered is incorrect or expired.",
          variant: "destructive",
        });
      }
    }
  });

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone) return;
    sendOtpMutation.mutate({ data: { phone } });
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code) return;
    verifyOtpMutation.mutate({ data: { phone, code } });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-background">
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
        <div className="absolute inset-0 bg-black/60" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-serif text-4xl font-bold bg-gradient-to-br from-purple-400 to-primary bg-clip-text text-transparent neon-text-purple tracking-widest uppercase mb-2">
            Shadow Garden
          </h1>
          <p className="text-muted-foreground tracking-widest uppercase text-sm">Authentication Protocol</p>
        </div>

        <Card className="glass-card border-primary/20 bg-black/40">
          <CardHeader>
            <CardTitle className="font-serif text-2xl text-center text-white">
              {step === "phone" ? "Identify Yourself" : "Verify Identity"}
            </CardTitle>
            <CardDescription className="text-center">
              {step === "phone" 
                ? "Enter your registered WhatsApp number to receive an access code." 
                : "Enter the 6-digit access code sent to your device."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === "phone" ? (
              <form onSubmit={handleSendOtp} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-primary tracking-wider uppercase text-xs">WhatsApp Number</Label>
                  <Input 
                    id="phone" 
                    placeholder="e.g. +2347012345678" 
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="bg-black/50 border-primary/30 text-white placeholder:text-muted-foreground focus-visible:ring-primary focus-visible:border-primary"
                    required
                  />
                  <p className="text-xs text-muted-foreground">Must include country code (+).</p>
                </div>
                <Button 
                  type="submit" 
                  className="w-full bg-primary hover:bg-primary/80 text-white font-bold tracking-widest uppercase h-12 neon-border-purple"
                  disabled={!phone || sendOtpMutation.isPending}
                >
                  {sendOtpMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Request Access"}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="code" className="text-primary tracking-wider uppercase text-xs">Access Code</Label>
                  <Input 
                    id="code" 
                    placeholder="6-digit code" 
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="bg-black/50 border-primary/30 text-white text-center tracking-[0.5em] text-lg focus-visible:ring-primary focus-visible:border-primary"
                    maxLength={6}
                    required
                  />
                </div>
                <div className="flex gap-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="flex-1 border-primary/30 text-white hover:bg-primary/20"
                    onClick={() => setStep("phone")}
                    disabled={verifyOtpMutation.isPending}
                  >
                    Back
                  </Button>
                  <Button 
                    type="submit" 
                    className="flex-[2] bg-primary hover:bg-primary/80 text-white font-bold tracking-widest uppercase h-12 neon-border-purple"
                    disabled={!code || verifyOtpMutation.isPending}
                  >
                    {verifyOtpMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Verify & Enter"}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
          <CardFooter className="justify-center border-t border-primary/10 pt-6">
            <p className="text-xs text-muted-foreground">
              Not a member? <a href="https://chat.whatsapp.com/LDnXqYWuvZMELxVaOpAAHI" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Join the Shadow Garden</a>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
