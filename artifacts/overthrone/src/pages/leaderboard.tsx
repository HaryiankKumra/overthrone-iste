import { useEffect } from "react";
import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useGetLeaderboard, getGetLeaderboardQueryKey } from "@workspace/api-client-react";
import { useGameWebsocket } from "@/hooks/use-websocket";
import { Trophy, Shield, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Leaderboard() {
  const [, setLocation] = useLocation();
  const { team, token } = useAuth();

  useEffect(() => {
    if (!token) setLocation("/");
  }, [token, setLocation]);

  useGameWebsocket();

  const { data: leaderboard } = useGetLeaderboard({
    query: {
      queryKey: getGetLeaderboardQueryKey(),
      refetchInterval: 5000,
    }
  });

  return (
    <Layout>
      <div className="p-8 max-w-5xl mx-auto space-y-8">
        <header className="text-center mb-12">
          <Trophy className="w-16 h-16 text-primary mx-auto mb-6 opacity-80" />
          <h2 className="text-4xl font-serif text-white tracking-widest uppercase">The Ledger of Kings</h2>
          <p className="text-muted-foreground font-mono mt-4 uppercase tracking-widest text-sm">
            Current Standings in the Realm
          </p>
        </header>

        <div className="border border-border rounded-lg bg-card/80 backdrop-blur p-4 md:p-5 flex items-start gap-3">
          <Info className="w-4 h-4 mt-0.5 text-primary shrink-0" />
          <div className="space-y-1 text-sm">
            <p className="font-mono uppercase tracking-wide text-foreground">Scoring Formula</p>
            <p className="text-muted-foreground font-mono text-xs leading-relaxed">
              Team score is <span className="text-white">HP + AP</span>. Alliances do not merge ranking points.
              Alliance HP/AP is shown only as shared war strength context.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Header Row */}
          <div className="grid grid-cols-13 gap-4 px-6 py-3 text-xs font-mono text-muted-foreground uppercase tracking-widest border-b border-border">
            <div className="col-span-1 text-center">Rank</div>
            <div className="col-span-4">House</div>
            <div className="col-span-3">Alliance</div>
            <div className="col-span-2 text-right">Health</div>
            <div className="col-span-1 text-right">AP</div>
            <div className="col-span-2 text-right">Score</div>
          </div>

          {leaderboard?.entries.map((entry) => (
            <div 
              key={entry.teamId}
              className={cn(
                "grid grid-cols-13 gap-4 px-6 py-4 items-center bg-card border border-border rounded-lg transition-all",
                entry.teamId === team?.id ? "border-primary/50 shadow-[0_0_15px_rgba(200,150,50,0.1)]" : "hover:border-primary/30",
                entry.isEliminated ? "opacity-50 grayscale" : ""
              )}
            >
              <div className="col-span-1 text-center font-serif text-xl text-muted-foreground">
                #{entry.rank}
              </div>
              <div className="col-span-4">
                <div className="font-serif text-lg text-white flex items-center gap-2">
                  {entry.teamName}
                  {entry.teamId === team?.id && (
                    <span className="text-[10px] font-mono uppercase tracking-widest text-primary border border-primary px-2 py-0.5 rounded-full ml-2">You</span>
                  )}
                  {entry.isEliminated && (
                    <span className="text-[10px] font-mono uppercase tracking-widest text-destructive border border-destructive px-2 py-0.5 rounded-full ml-2">Eliminated</span>
                  )}
                </div>
              </div>
              <div className="col-span-3">
                {entry.allianceName ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-mono text-green-500">
                      <Shield className="w-4 h-4" />
                      {entry.allianceName}
                    </div>
                    {entry.allianceHP != null && entry.allianceAP != null && (
                      <div className="text-[10px] uppercase tracking-widest font-mono text-emerald-300/80">
                        Shared {entry.allianceHP} HP | {entry.allianceAP} AP
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-foreground text-sm font-mono">-</span>
                )}
              </div>
              <div className="col-span-2 text-right font-mono">
                <div className="text-destructive font-bold text-lg">{entry.hp}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-widest">HP</div>
              </div>
              <div className="col-span-1 text-right font-mono">
                <div className="text-primary font-bold text-lg">{entry.ap}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-widest">AP</div>
              </div>
              <div className="col-span-2 text-right font-mono">
                <div className="text-primary font-bold text-xl">{entry.totalScore}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-widest">PTS</div>
              </div>
            </div>
          ))}

          {leaderboard?.entries.length === 0 && (
            <div className="text-center py-20 text-muted-foreground font-mono uppercase tracking-widest">
              The realm is empty.
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
