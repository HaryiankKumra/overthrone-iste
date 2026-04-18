import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useLogoutTeam } from "@workspace/api-client-react";
import { Shield, Swords, Scroll, Trophy, History, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { team, logout } = useAuth();
  const logoutMutation = useLogoutTeam();

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSettled: () => {
        logout();
      }
    });
  };

  const navItems = [
    { href: "/game", label: "War Room", icon: Shield },
    { href: "/tasks", label: "Tasks", icon: Scroll },
    { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
    { href: "/events", label: "Chronicle", icon: History },
  ];

  if (team?.isAdmin) {
    navItems.push({ href: "/admin", label: "Admin", icon: Settings });
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      <nav className="w-full md:w-64 bg-card border-r border-border shrink-0 flex flex-col relative z-10">
        <div className="p-6 border-b border-border">
          <h1 className="text-2xl font-serif font-bold text-primary tracking-wider uppercase text-center flex items-center justify-center gap-2">
            <Swords className="w-6 h-6" />
            Overthrone
          </h1>
          {team && (
            <div className="mt-4 text-center">
              <div className="text-sm text-muted-foreground uppercase tracking-widest font-mono">House</div>
              <div className="text-lg font-serif text-white mt-1">{team.name}</div>
            </div>
          )}
        </div>
        <div className="flex-1 py-6 flex flex-col gap-2 px-4">
          {navItems.map((item) => {
            const isActive = location === item.href || location.startsWith(item.href + "/");
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-md transition-all cursor-pointer select-none",
                    isActive
                      ? "bg-primary/10 text-primary border border-primary/30"
                      : "text-muted-foreground hover:text-white hover:bg-secondary border border-transparent"
                  )}
                >
                  <item.icon className={cn("w-5 h-5", isActive ? "text-primary" : "")} />
                  <span className="font-medium tracking-wide">{item.label}</span>
                </div>
              </Link>
            );
          })}
        </div>
        <div className="p-4 border-t border-border">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Surrender</span>
          </button>
        </div>
      </nav>
      <main className="flex-1 relative overflow-x-hidden overflow-y-auto">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1595867160755-6b27072551bd?q=80&w=2938&auto=format&fit=crop')] opacity-[0.03] pointer-events-none mix-blend-overlay"></div>
        {children}
      </main>
    </div>
  );
}
