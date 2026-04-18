import { useEffect, useState } from "react";
import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListTasks,
  getListTasksQueryKey,
  useGetGameState,
  getGetGameStateQueryKey,
  useGetMe,
  getGetMeQueryKey,
  useUseTaskCard,
  useSubmitTaskAnswer,
  useAbandonTask,
} from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Brain, Calculator, Flag, Braces, AlertTriangle } from "lucide-react";

const typeIcons = {
  sudoku: Brain,
  math: Calculator,
  ctf: Flag,
  algorithm: Braces,
};

export default function Tasks() {
  const [, setLocation] = useLocation();
  const { token } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [answer, setAnswer] = useState("");
  const [showAbandonConfirm, setShowAbandonConfirm] = useState(false);

  useEffect(() => {
    if (!token) setLocation("/");
  }, [token, setLocation]);

  const { data: tasks, refetch: refetchTasks } = useListTasks({
    query: {
      queryKey: getListTasksQueryKey(),
      refetchInterval: 10000,
    }
  });

  const { data: gameState } = useGetGameState({
    query: {
      queryKey: getGetGameStateQueryKey(),
      refetchInterval: 10000,
    }
  });

  const { data: myTeam, refetch: refetchMe } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      refetchInterval: 5000,
      enabled: !!token,
    }
  });

  const useTaskCardMutation = useUseTaskCard();
  const submitAnswerMutation = useSubmitTaskAnswer();
  const abandonMutation = useAbandonTask();

  const activeTask = myTeam?.activeTaskId
    ? tasks?.find(t => t.id === myTeam.activeTaskId) ?? null
    : null;

  const handleStartTask = (task: any) => {
    useTaskCardMutation.mutate({ data: { taskId: task.id } }, {
      onSuccess: () => {
        toast({ title: "Task Claimed", description: `"${task.title}" is now active. Solve it to earn ${task.apReward} AP.` });
        refetchMe();
        refetchTasks();
        setAnswer("");
        setSelectedTask(task);
      },
      onError: (err: any) => {
        toast({ title: "Cannot Claim Task", description: err.data?.error || err.message, variant: "destructive" });
      }
    });
  };

  const handleOpenActiveTask = () => {
    if (activeTask) {
      setSelectedTask(activeTask);
      setAnswer("");
    }
  };

  const handleSubmitAnswer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer.trim() || !selectedTask) return;

    submitAnswerMutation.mutate(
      { id: selectedTask.id, data: { answer: answer.trim() } },
      {
        onSuccess: (res) => {
          if (res.correct) {
            toast({ title: "Correct!", description: res.message });
            setSelectedTask(null);
            setAnswer("");
            refetchMe();
            refetchTasks();
            queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          } else {
            toast({ title: "Wrong Answer", description: res.message, variant: "destructive" });
          }
        },
        onError: (err: any) => {
          toast({ title: "Error", description: err.data?.error || err.message, variant: "destructive" });
        }
      }
    );
  };

  const handleAbandon = () => {
    abandonMutation.mutate(undefined, {
      onSuccess: (res) => {
        toast({ title: "Task Abandoned", description: res.message, variant: "destructive" });
        setSelectedTask(null);
        setAnswer("");
        setShowAbandonConfirm(false);
        refetchMe();
        refetchTasks();
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err.data?.error || err.message, variant: "destructive" });
      }
    });
  };

  const isTaskPhase = gameState?.phase === "task" && gameState?.status === "active";
  const hasActiveTask = !!myTeam?.activeTaskId;

  const diffColors: Record<string, string> = {
    easy: "text-green-500 border-green-500/30 bg-green-500/10",
    medium: "text-yellow-500 border-yellow-500/30 bg-yellow-500/10",
    hard: "text-red-500 border-red-500/30 bg-red-500/10",
  };

  return (
    <Layout>
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-serif text-white tracking-wider uppercase">War Bounties</h2>
            <p className="text-muted-foreground font-mono mt-2">Solve challenges to gather Action Points for your house.</p>
          </div>
          <div className="flex items-center gap-3">
            {!isTaskPhase && gameState?.status === "active" && (
              <Badge variant="destructive" className="px-4 py-2 font-mono uppercase tracking-widest bg-destructive/20 text-destructive border-destructive/50">
                Attack Phase — Tasks Disabled
              </Badge>
            )}
            {gameState?.status === "waiting" && (
              <Badge variant="outline" className="px-4 py-2 font-mono uppercase tracking-widest">
                Awaiting War Start
              </Badge>
            )}
          </div>
        </header>

        {activeTask && (
          <div className="border border-primary/50 bg-primary/10 rounded-lg p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-mono uppercase tracking-widest text-primary mb-1">Active Challenge</p>
              <p className="text-white font-serif text-lg">{activeTask.title}</p>
              <p className="text-muted-foreground text-sm font-mono">+{activeTask.apReward} AP on completion</p>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => { setShowAbandonConfirm(true); }}
                variant="outline"
                className="border-destructive/50 text-destructive hover:bg-destructive/10 font-mono uppercase tracking-wider text-xs"
              >
                Give Up (-50 AP)
              </Button>
              <Button
                onClick={handleOpenActiveTask}
                className="font-serif uppercase tracking-widest"
              >
                Solve Now
              </Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tasks?.map(task => {
            const Icon = typeIcons[task.type as keyof typeof typeIcons] || Brain;
            const isMyActiveTask = myTeam?.activeTaskId === task.id;

            return (
              <Card key={task.id} className={`border-border bg-card/80 backdrop-blur p-6 flex flex-col transition-colors group relative overflow-hidden ${isMyActiveTask ? "border-primary/70 shadow-lg shadow-primary/10" : "hover:border-primary/30"}`}>
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative z-10 flex flex-col h-full">
                  <div className="flex justify-between items-start mb-4">
                    <div className={`p-2 rounded-lg border ${isMyActiveTask ? "bg-primary/20 border-primary/50" : "bg-secondary border-border"}`}>
                      <Icon className={`w-6 h-6 ${isMyActiveTask ? "text-primary" : "text-muted-foreground"}`} />
                    </div>
                    <div className="flex items-center gap-2">
                      {isMyActiveTask && (
                        <Badge className="text-[10px] font-mono uppercase tracking-widest bg-primary/20 text-primary border-primary/30">
                          Active
                        </Badge>
                      )}
                      <Badge variant="outline" className={`font-mono uppercase tracking-widest text-[10px] ${diffColors[task.difficulty] || ""}`}>
                        {task.difficulty}
                      </Badge>
                    </div>
                  </div>

                  <h3 className="text-xl font-serif text-white mb-2 line-clamp-1">{task.title}</h3>
                  <p className="text-sm text-muted-foreground font-mono line-clamp-2 mb-6 flex-1">
                    {task.description}
                  </p>

                  <div className="flex items-center justify-between mt-auto pt-4 border-t border-border">
                    <div className="font-mono">
                      <span className="text-muted-foreground text-xs uppercase tracking-wider block">Reward</span>
                      <span className="text-primary font-bold">{task.apReward} AP</span>
                    </div>

                    {isMyActiveTask ? (
                      <Button
                        onClick={handleOpenActiveTask}
                        className="font-serif uppercase tracking-widest"
                      >
                        Solve
                      </Button>
                    ) : (
                      <Button
                        onClick={() => handleStartTask(task)}
                        disabled={!isTaskPhase || hasActiveTask || useTaskCardMutation.isPending}
                        variant="outline"
                        className="font-serif uppercase tracking-widest border-primary/50 text-primary hover:bg-primary hover:text-primary-foreground disabled:opacity-40"
                      >
                        {hasActiveTask ? "Task Active" : "Claim"}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      <Dialog open={!!selectedTask} onOpenChange={(open) => { if (!open) { setSelectedTask(null); setAnswer(""); } }}>
        <DialogContent className="max-w-3xl bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-2xl font-serif text-primary uppercase tracking-wider">
              {selectedTask?.title}
            </DialogTitle>
            <DialogDescription className="font-mono text-muted-foreground flex items-center gap-3">
              <Badge variant="outline" className={`font-mono uppercase tracking-widest text-[10px] ${diffColors[selectedTask?.difficulty] || ""}`}>
                {selectedTask?.difficulty}
              </Badge>
              <span>Reward: <span className="text-primary font-bold">{selectedTask?.apReward} AP</span></span>
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="h-[40vh] mt-4 rounded-md border border-border bg-secondary/50 p-4">
            <div className="font-mono text-sm whitespace-pre-wrap text-foreground leading-relaxed">
              {selectedTask?.content}
            </div>
          </ScrollArea>

          <form onSubmit={handleSubmitAnswer} className="mt-4 space-y-3">
            <Input
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              placeholder="Enter your answer..."
              className="bg-secondary border-border font-mono text-base focus-visible:ring-primary h-12"
              autoFocus
            />
            <div className="flex gap-3">
              <Button
                type="submit"
                className="flex-1 h-11 font-serif uppercase tracking-widest"
                disabled={submitAnswerMutation.isPending || !answer.trim()}
              >
                {submitAnswerMutation.isPending ? "Checking..." : "Submit Answer"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 font-mono border-destructive/50 text-destructive hover:bg-destructive/10 uppercase tracking-wider text-xs px-4"
                onClick={() => { setSelectedTask(null); setShowAbandonConfirm(true); }}
              >
                Give Up (-50 AP)
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showAbandonConfirm} onOpenChange={setShowAbandonConfirm}>
        <DialogContent className="max-w-md bg-card border-destructive/30">
          <DialogHeader>
            <DialogTitle className="text-xl font-serif text-destructive uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Abandon Challenge?
            </DialogTitle>
            <DialogDescription className="font-mono text-muted-foreground mt-2">
              Surrendering this challenge will cost your house <span className="text-destructive font-bold">50 AP</span> as a penalty. Your active task will be cleared.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowAbandonConfirm(false)}
            >
              Keep Fighting
            </Button>
            <Button
              variant="destructive"
              className="flex-1 font-serif uppercase tracking-widest"
              onClick={handleAbandon}
              disabled={abandonMutation.isPending}
            >
              {abandonMutation.isPending ? "Surrendering..." : "Surrender (-50 AP)"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
