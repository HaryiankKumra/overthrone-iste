import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useLoginTeam, useRegisterTeam } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Swords, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");

  const loginMutation = useLoginTeam();
  const registerMutation = useRegisterTeam();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !password) return;

    if (isRegister) {
      registerMutation.mutate(
        { data: { name, password, members: [] } },
        {
          onSuccess: (data) => {
            login(data.token, data.team);
            setLocation("/game");
          },
          onError: (error: any) => {
            toast({
              title: "Registration Failed",
              description: error.message || "Failed to forge alliance.",
              variant: "destructive",
            });
          },
        }
      );
    } else {
      loginMutation.mutate(
        { data: { name, password } },
        {
          onSuccess: (data) => {
            login(data.token, data.team);
            setLocation("/game");
          },
          onError: (error: any) => {
            toast({
              title: "Access Denied",
              description: error.message || "Invalid credentials.",
              variant: "destructive",
            });
          },
        }
      );
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1536762391219-c29db42d7653?q=80&w=2940&auto=format&fit=crop')] opacity-10 bg-cover bg-center mix-blend-luminosity"></div>
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent"></div>
      
      <div className="z-10 w-full max-w-md p-8 bg-card border border-border rounded-lg shadow-2xl shadow-black/50 backdrop-blur-sm relative">
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-background p-4 rounded-full border border-border shadow-xl">
          {isRegister ? <Shield className="w-12 h-12 text-primary" /> : <Swords className="w-12 h-12 text-primary" />}
        </div>
        
        <h1 className="text-3xl font-serif text-center mt-6 text-white uppercase tracking-widest">
          {isRegister ? "Forge a House" : "Enter the War"}
        </h1>
        <p className="text-center text-muted-foreground mt-2 font-mono text-sm uppercase tracking-wide">
          Overthrone
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">House Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-background/50 border-border text-white text-lg h-12 focus-visible:ring-primary font-serif placeholder:font-sans"
                placeholder="House Stark"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">Secret Seal</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-background/50 border-border text-white text-lg h-12 focus-visible:ring-primary"
                placeholder="••••••••"
              />
            </div>
          </div>

          <Button 
            type="submit" 
            className="w-full h-12 text-lg font-serif tracking-widest uppercase"
            disabled={loginMutation.isPending || registerMutation.isPending}
          >
            {isRegister ? "Pledge Fealty" : "Open the Gates"}
          </Button>
        </form>

        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={() => setIsRegister(!isRegister)}
            className="text-sm text-muted-foreground hover:text-primary transition-colors font-mono uppercase tracking-wide"
          >
            {isRegister ? "Already hold a banner? Enter here" : "No banner? Forge one"}
          </button>
        </div>
      </div>
    </div>
  );
}
