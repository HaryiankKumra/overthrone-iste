import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Layout } from "@/components/layout";
import {
  useGetGameState,
  useGetMe,
  useListTeams,
  getGetGameStateQueryKey,
  getGetMeQueryKey,
  getListTeamsQueryKey,
  useUseAttackCard,
  useUseAllianceCard,
  useUseBackstabCard,
  useUseSuspicionCard,
  useGetPendingAllianceRequests,
  getGetPendingAllianceRequestsQueryKey,
  useRespondToAlliance,
} from "@workspace/api-client-react";
import { useGameWebsocket } from "@/hooks/use-websocket";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Crosshair, Skull, Handshake, Eye, ShieldAlert, Bell } from "lucide-react";
import { KingdomMap } from "@/components/map";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function GameDashboard() {
  const [, setLocation] = useLocation();
  const { team, token } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!token) setLocation("/");
  }, [token, setLocation]);

  useGameWebsocket(team?.id);

  const { data: gameState } = useGetGameState({
    query: { queryKey: getGetGameStateQueryKey(), refetchInterval: 5000 }
  });

  const { data: myTeam, refetch: refetchMe } = useGetMe({
    query: { queryKey: getGetMeQueryKey(), enabled: !!token, refetchInterval: 5000 }
  });

  const { data: teams } = useListTeams({
    query: { queryKey: getListTeamsQueryKey(), refetchInterval: 10000 }
  });

  const { data: pendingRequests = [], refetch: refetchPending } = useGetPendingAllianceRequests({
    query: {
      queryKey: getGetPendingAllianceRequestsQueryKey(),
      enabled: !!token,
      refetchInterval: 8000,
    }
  });

  const [activeCard, setActiveCard] = useState<string | null>(null);
  const [targetId, setTargetId] = useState<string>("");
  const [apToSpend, setApToSpend] = useState<string>("");
  const [allianceRequestDialog, setAllianceRequestDialog] = useState<typeof pendingRequests[0] | null>(null);
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    if (pendingRequests.length > 0 && !allianceRequestDialog) {
      setAllianceRequestDialog(pendingRequests[0]);
    }
  }, [pendingRequests]);

  useEffect(() => {
    if (!gameState?.epochEndsAt) return;
    const interval = setInterval(() => {
      const endsAt = new Date(gameState.epochEndsAt!).getTime();
      const diff = endsAt - Date.now();
      if (diff <= 0) { setTimeLeft("00:00"); return; }
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft(`${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [gameState?.epochEndsAt]);

  const attackMutation = useUseAttackCard();
  const allianceMutation = useUseAllianceCard();
  const backstabMutation = useUseBackstabCard();
  const suspicionMutation = useUseSuspicionCard();
  const respondMutation = useRespondToAlliance();

  const invalidate = () => {
    refetchMe();
    queryClient.invalidateQueries({ queryKey: getListTeamsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetPendingAllianceRequestsQueryKey() });
  };

  const handleCardAction = () => {
    const targetTeamId = parseInt(targetId);

    const onSuccess = (res: any) => {
      toast({ title: "Order Executed", description: res.message });
      setActiveCard(null);
      setTargetId("");
      setApToSpend("");
      invalidate();
      // For backstab/suspicion: secret task assigned — go to tasks page
      if (res.secretTaskTitle) {
        toast({ title: "Secret Task Assigned", description: `Solve "${res.secretTaskTitle}" to complete your order.`, variant: "default" });
        setTimeout(() => setLocation("/tasks"), 1200);
      }
    };

    const onError = (err: any) => {
      toast({ title: "Order Failed", description: err.data?.error || err.message, variant: "destructive" });
    };

    if (activeCard === "attack") {
      attackMutation.mutate({ data: { targetTeamId, apSpent: parseInt(apToSpend) } }, { onSuccess, onError });
    } else if (activeCard === "alliance") {
      allianceMutation.mutate({ data: { targetTeamId } }, { onSuccess, onError });
    } else if (activeCard === "backstab") {
      backstabMutation.mutate({} as any, { onSuccess, onError });
    } else if (activeCard === "suspicion") {
      suspicionMutation.mutate({} as any, { onSuccess, onError });
    }
  };

  const handleAllianceResponse = (accept: boolean) => {
    if (!allianceRequestDialog) return;
    respondMutation.mutate(
      { data: { requestingTeamId: allianceRequestDialog.fromTeamId, accept } },
      {
        onSuccess: (res) => {
          toast({ title: accept ? "Alliance Forged!" : "Request Rejected", description: res.message });
          setAllianceRequestDialog(null);
          refetchPending();
          invalidate();
        },
        onError: (err: any) => {
          toast({ title: "Error", description: err.data?.error || err.message, variant: "destructive" });
        }
      }
    );
  };

  if (!token) return null;

  const isGameActive = gameState?.status === "active";
  const isAttackPhase = gameState?.phase === "attack";
  const aliveTeams = teams?.filter(t => !t.isEliminated && t.id !== myTeam?.id) || [];
  const hasAlliance = !!myTeam?.allianceId;
  const isEliminated = !!myTeam?.isEliminated;

  return (
    <Layout>
      <div className="p-8 max-w-7xl mx-auto space-y-8">

        {/* Pending alliance request notification banner */}
        {pendingRequests.length > 0 && (
          <div
            className="border border-green-500/50 bg-green-500/10 rounded-lg p-4 flex items-center justify-between cursor-pointer hover:bg-green-500/20 transition-colors"
            onClick={() => setAllianceRequestDialog(pendingRequests[0])}
          >
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-green-400 animate-pulse" />
              <div>
                <p className="text-green-400 font-serif uppercase tracking-wider text-sm">Alliance Proposal Received</p>
                <p className="text-muted-foreground font-mono text-xs">{pendingRequests[0].fromTeamName} seeks to forge a pact with you</p>
              </div>
            </div>
            <Button size="sm" className="bg-green-600 hover:bg-green-700 font-mono uppercase tracking-wider text-xs">
              Respond
            </Button>
          </div>
        )}

        <header className="flex flex-col md:flex-row items-center justify-between gap-4 bg-card border border-border p-6 rounded-lg relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent pointer-events-none" />
          <div className="relative z-10">
            <h2 className="text-3xl font-serif text-white tracking-wider uppercase">War Room</h2>
            <p className="text-muted-foreground font-mono mt-1 uppercase tracking-widest text-sm">
              Status: <span className="text-primary font-bold uppercase">{gameState?.status || "Waiting"}</span>
            </p>
          </div>
          <div className="flex items-center gap-8 relative z-10">
            <div className="text-center bg-background/50 p-3 rounded border border-border">
              <div className="text-xs text-muted-foreground uppercase tracking-widest font-mono mb-1">Time Remaining</div>
              <div className="text-3xl font-mono text-white tracking-widest">{timeLeft || "00:00"}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-muted-foreground uppercase tracking-widest font-mono">Epoch</div>
              <div className="text-3xl font-serif text-white">{gameState?.currentEpoch || 0} / {gameState?.totalEpochs || 0}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-muted-foreground uppercase tracking-widest font-mono">Phase</div>
              <div className={`text-2xl font-serif uppercase tracking-widest ${isAttackPhase ? "text-destructive" : "text-primary"}`}>
                {gameState?.phase || "Waiting"}
              </div>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-8">
            <Card className="p-6 border-border bg-card/80 backdrop-blur relative overflow-hidden">
              {isEliminated && (
                <div className="absolute inset-0 bg-destructive/20 backdrop-blur-sm z-20 flex items-center justify-center border border-destructive">
                  <div className="text-4xl font-serif text-white uppercase tracking-widest bg-destructive p-4 rounded-lg shadow-2xl rotate-12">Eliminated</div>
                </div>
              )}
              <h3 className="text-xl font-serif tracking-wider text-white mb-6 uppercase border-b border-border pb-4">House Status</h3>
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between text-sm mb-2 font-mono">
                    <span className="text-muted-foreground uppercase tracking-wider">Health</span>
                    <span className="text-destructive font-bold text-lg">{myTeam?.hp || 0} HP</span>
                  </div>
                  <Progress value={Math.min(100, ((myTeam?.hp || 0) / 10000) * 100)} className="h-4 [&>div]:bg-destructive bg-secondary" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2 font-mono">
                    <span className="text-muted-foreground uppercase tracking-wider">Action Points</span>
                    <span className="text-primary font-bold text-lg">{myTeam?.ap || 0} AP</span>
                  </div>
                  <Progress value={Math.min(100, ((myTeam?.ap || 0) / 1000) * 100)} className="h-4 [&>div]:bg-primary bg-secondary" />
                </div>
                {hasAlliance && (
                  <div className="pt-4 border-t border-border">
                    <div className="text-sm text-muted-foreground uppercase tracking-wider font-mono mb-2">Current Pact</div>
                    <div className="flex items-center gap-2 text-green-500 font-mono">
                      <Handshake className="w-4 h-4" /> Alliance Active
                    </div>
                  </div>
                )}
              </div>
            </Card>

            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-xl font-serif tracking-wider text-white uppercase">Strategic Orders</h3>
                {!isAttackPhase && isGameActive && (
                  <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-widest text-primary border-primary/30">
                    Task Phase
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <StrategicCard
                  title="Attack"
                  icon={Crosshair}
                  color="text-destructive"
                  description="Spend AP to deal damage"
                  locked={!isAttackPhase}
                  lockedLabel="Attack Phase Only"
                  disabled={isEliminated || !isGameActive}
                  onClick={() => setActiveCard("attack")}
                />
                <StrategicCard
                  title="Alliance"
                  icon={Handshake}
                  color="text-green-500"
                  description="Propose a pact with a house"
                  disabled={isEliminated || !isGameActive || hasAlliance}
                  disabledLabel={hasAlliance ? "Already Allied" : undefined}
                  onClick={() => setActiveCard("alliance")}
                />
                <StrategicCard
                  title="Backstab"
                  icon={Skull}
                  color="text-purple-500"
                  description="Secretly betray your ally"
                  disabled={isEliminated || !isGameActive || !hasAlliance}
                  disabledLabel={!hasAlliance ? "No Alliance" : undefined}
                  onClick={() => setActiveCard("backstab")}
                />
                <StrategicCard
                  title="Suspicion"
                  icon={Eye}
                  color="text-blue-500"
                  description="Suspect ally of treachery"
                  disabled={isEliminated || !isGameActive || !hasAlliance}
                  disabledLabel={!hasAlliance ? "No Alliance" : undefined}
                  onClick={() => setActiveCard("suspicion")}
                />
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <Card className="h-[600px] border-border bg-card/80 backdrop-blur p-1 flex flex-col relative overflow-hidden">
              <div className="p-4 border-b border-border bg-card relative z-10 flex justify-between items-center">
                <h3 className="text-xl font-serif tracking-wider text-white uppercase">Kingdom Map</h3>
                <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" /> Live Intel
                </div>
              </div>
              <div className="flex-1 bg-[#0a0a0a] relative overflow-hidden border border-border/50 rounded-b-lg m-1">
                <KingdomMap />
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Card Action Dialog */}
      <Dialog open={!!activeCard} onOpenChange={() => { setActiveCard(null); setTargetId(""); setApToSpend(""); }}>
        <DialogContent className="bg-card border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-serif text-white uppercase tracking-wider text-center flex flex-col items-center gap-4">
              {activeCard === "attack" && <><Crosshair className="w-12 h-12 text-destructive" /> Declare War</>}
              {activeCard === "alliance" && <><Handshake className="w-12 h-12 text-green-500" /> Propose Alliance</>}
              {activeCard === "backstab" && <><Skull className="w-12 h-12 text-purple-500" /> Backstab Ally</>}
              {activeCard === "suspicion" && <><Eye className="w-12 h-12 text-blue-500" /> Cast Suspicion</>}
            </DialogTitle>
            <DialogDescription className="text-center font-mono text-xs text-muted-foreground uppercase tracking-widest mt-2">
              {activeCard === "backstab" && "A secret task will be assigned. Solve it to steal your ally's last task AP and break the alliance."}
              {activeCard === "suspicion" && "A secret task will be assigned. Solve it to detect if your ally is backstabbing you."}
              {activeCard === "attack" && "Spend your Action Points to deal direct damage to an enemy house."}
              {activeCard === "alliance" && "Propose a mutual pact. The target house will receive a notification to accept or reject."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {(activeCard === "attack" || activeCard === "alliance") && (
              <div className="space-y-2">
                <Label className="font-mono text-xs uppercase text-muted-foreground tracking-widest">Select Target House</Label>
                <Select value={targetId} onValueChange={setTargetId}>
                  <SelectTrigger className="bg-secondary border-border h-12 font-serif text-lg">
                    <SelectValue placeholder="Choose a banner..." />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {aliveTeams
                      .filter(t => activeCard === "attack" ? !t.isEliminated : true)
                      .map(t => (
                        <SelectItem key={t.id} value={t.id.toString()} className="font-serif">
                          {t.name} <span className="font-mono text-xs ml-2 opacity-50">({t.hp} HP / {t.ap} AP)</span>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {activeCard === "attack" && (
              <div className="space-y-2">
                <Label className="font-mono text-xs uppercase text-muted-foreground tracking-widest">Action Points to Spend</Label>
                <div className="flex items-center gap-4">
                  <Input
                    type="number"
                    min="1"
                    max={myTeam?.ap || 0}
                    value={apToSpend}
                    onChange={e => setApToSpend(e.target.value)}
                    className="bg-secondary border-border font-mono text-xl h-12 text-center"
                    placeholder="0"
                  />
                  <span className="font-mono text-sm text-primary whitespace-nowrap">/ {myTeam?.ap || 0} Available</span>
                </div>
              </div>
            )}

            {(activeCard === "backstab" || activeCard === "suspicion") && (
              <div className="border border-border rounded-lg p-4 bg-secondary/30 font-mono text-sm text-muted-foreground space-y-2">
                {activeCard === "backstab" && (
                  <>
                    <p>• You will receive a <span className="text-purple-400">secret task</span> to solve</p>
                    <p>• If solved before your ally suspects you, you steal their last-task AP</p>
                    <p>• The alliance is broken once the backstab resolves</p>
                  </>
                )}
                {activeCard === "suspicion" && (
                  <>
                    <p>• You will receive a <span className="text-blue-400">secret task</span> to solve</p>
                    <p>• If your ally is backstabbing, solving this cancels their betrayal</p>
                    <p>• Either way, you earn the task AP when you solve it</p>
                  </>
                )}
              </div>
            )}

            <Button
              className={`w-full h-14 font-serif uppercase tracking-widest text-lg ${
                activeCard === "attack" ? "bg-destructive hover:bg-destructive/90 text-white" :
                activeCard === "alliance" ? "bg-green-600 hover:bg-green-700 text-white" :
                activeCard === "backstab" ? "bg-purple-600 hover:bg-purple-700 text-white" :
                "bg-blue-600 hover:bg-blue-700 text-white"
              }`}
              onClick={handleCardAction}
              disabled={
                ((activeCard === "attack" || activeCard === "alliance") && !targetId) ||
                (activeCard === "attack" && (!apToSpend || parseInt(apToSpend) <= 0 || parseInt(apToSpend) > (myTeam?.ap || 0))) ||
                attackMutation.isPending || allianceMutation.isPending || backstabMutation.isPending || suspicionMutation.isPending
              }
            >
              {attackMutation.isPending || allianceMutation.isPending || backstabMutation.isPending || suspicionMutation.isPending
                ? "Executing..." : "Execute Order"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Alliance Request Response Dialog */}
      <Dialog open={!!allianceRequestDialog} onOpenChange={() => setAllianceRequestDialog(null)}>
        <DialogContent className="bg-card border-green-500/30 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-serif text-green-400 uppercase tracking-wider text-center flex flex-col items-center gap-4">
              <Handshake className="w-12 h-12 text-green-500" />
              Alliance Proposal
            </DialogTitle>
            <DialogDescription className="text-center font-mono text-muted-foreground mt-2">
              <span className="text-white font-bold">{allianceRequestDialog?.fromTeamName}</span> seeks to forge a sacred pact with your house.
              Accept to fight as one, or reject to remain independent.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-4">
            <Button
              variant="outline"
              className="flex-1 border-destructive/50 text-destructive hover:bg-destructive/10 font-mono uppercase tracking-wider"
              onClick={() => handleAllianceResponse(false)}
              disabled={respondMutation.isPending}
            >
              Reject
            </Button>
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-serif uppercase tracking-widest"
              onClick={() => handleAllianceResponse(true)}
              disabled={respondMutation.isPending}
            >
              Accept Alliance
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

function StrategicCard({
  title, icon: Icon, color, description,
  disabled, disabledLabel, locked, lockedLabel, onClick
}: {
  title: string; icon: any; color: string; description: string;
  disabled?: boolean; disabledLabel?: string; locked?: boolean; lockedLabel?: string; onClick?: () => void;
}) {
  const isDisabled = disabled || locked;
  const label = locked ? lockedLabel : disabledLabel;

  return (
    <button
      onClick={isDisabled ? undefined : onClick}
      disabled={isDisabled}
      className={`group relative flex flex-col items-center justify-center p-4 bg-card border rounded-lg transition-all overflow-hidden text-center gap-3 aspect-[3/4] ${
        isDisabled
          ? "opacity-50 grayscale cursor-not-allowed border-border"
          : "border-border hover:border-primary/50 cursor-pointer shadow-[0_4px_20px_rgba(0,0,0,0.5)] hover:-translate-y-1"
      }`}
    >
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1578308802951-6d7ab7a6db06?q=80&w=600&auto=format&fit=crop')] opacity-10 bg-cover mix-blend-overlay pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/80" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-primary/10 opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="relative z-10 bg-background/80 p-3 rounded-full border border-border shadow-xl">
        <Icon className={`w-8 h-8 ${color}`} />
      </div>
      <div className="relative z-10 w-full mt-auto pt-4 border-t border-border/50">
        <div className="font-serif tracking-widest text-white uppercase text-sm drop-shadow-md">{title}</div>
        <div className="text-[10px] text-muted-foreground font-mono mt-1 uppercase tracking-wider">
          {label || description}
        </div>
      </div>
    </button>
  );
}
