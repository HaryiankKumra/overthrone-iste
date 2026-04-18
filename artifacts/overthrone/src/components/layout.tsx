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
          <div className="text-center mt-2 text-[10px] font-mono uppercase tracking-[0.24em] text-muted-foreground">
            Designed by ISTE
          </div>
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
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_18%_12%,rgba(236,176,85,0.09),transparent_42%),radial-gradient(circle_at_76%_82%,rgba(83,132,181,0.1),transparent_48%),linear-gradient(180deg,transparent,rgba(0,0,0,0.24))]" />
        <div className="absolute inset-0 pointer-events-none opacity-[0.16] bg-[repeating-linear-gradient(110deg,rgba(255,255,255,0.06),rgba(255,255,255,0.06)_1px,transparent_1px,transparent_18px)]" />
        {children}
      </main>
    </div>
  );
}
