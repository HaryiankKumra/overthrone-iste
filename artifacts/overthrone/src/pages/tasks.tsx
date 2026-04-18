import { useEffect, useState } from "react";
import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { 
  useListTasks, 
  getListTasksQueryKey, 
  useGetGameState, 
  getGetGameStateQueryKey,
  useUseTaskCard,
  useSubmitTaskAnswer
} from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Brain, Calculator, Flag, Braces } from "lucide-react";

const typeIcons = {
  sudoku: Brain,
  math: Calculator,
  ctf: Flag,
  algorithm: Braces,
};

export default function Tasks() {
  const [, setLocation] = useLocation();
  const { team, token } = useAuth();
  const { toast } = useToast();
  
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [answer, setAnswer] = useState("");

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

  const useTaskCardMutation = useUseTaskCard();
  const submitAnswerMutation = useSubmitTaskAnswer();

  const handleStartTask = (taskId: number) => {
    useTaskCardMutation.mutate({ data: { taskId } }, {
      onSuccess: () => {
        toast({ title: "Task Started", description: "You have commenced this challenge." });
        refetchTasks();
      },
      onError: (err: any) => {
        toast({ title: "Cannot Start Task", description: err.message, variant: "destructive" });
      }
    });
  };

  const handleSubmitAnswer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer || !selectedTask) return;

    submitAnswerMutation.mutate({ data: { answer } }, {
      onSuccess: (res) => {
        if (res.correct) {
          toast({ title: "Success!", description: res.message });
          setSelectedTask(null);
          setAnswer("");
          refetchTasks();
        } else {
          toast({ title: "Incorrect", description: res.message, variant: "destructive" });
        }
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    });
  };

  const isTaskPhase = gameState?.phase === "task";

  return (
    <Layout>
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-serif text-white tracking-wider uppercase">War Bounties</h2>
            <p className="text-muted-foreground font-mono mt-2">Solve challenges to gather Action Points for your house.</p>
          </div>
          {!isTaskPhase && (
            <Badge variant="destructive" className="px-4 py-2 font-mono uppercase tracking-widest bg-destructive/20 text-destructive border-destructive/50">
              Attack Phase Active - Tasks Disabled
            </Badge>
          )}
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tasks?.map(task => {
            const Icon = typeIcons[task.type as keyof typeof typeIcons] || Brain;
            const diffColors = {
              easy: "text-green-500 border-green-500/30 bg-green-500/10",
              medium: "text-yellow-500 border-yellow-500/30 bg-yellow-500/10",
              hard: "text-red-500 border-red-500/30 bg-red-500/10"
            };
            
            return (
              <Card key={task.id} className="border-border bg-card/80 backdrop-blur p-6 flex flex-col hover:border-primary/50 transition-colors group relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative z-10 flex flex-col h-full">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2 bg-secondary rounded-lg border border-border">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                    <Badge variant="outline" className={`font-mono uppercase tracking-widest text-[10px] ${diffColors[task.difficulty as keyof typeof diffColors]}`}>
                      {task.difficulty}
                    </Badge>
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
                    
                    {team?.activeTaskId === task.id ? (
                      <Button 
                        onClick={() => setSelectedTask(task)} 
                        variant="secondary"
                        className="font-serif uppercase tracking-widest border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                      >
                        Resume
                      </Button>
                    ) : (
                      <Button 
                        onClick={() => handleStartTask(task.id)}
                        disabled={!isTaskPhase || !!team?.activeTaskId}
                        className="font-serif uppercase tracking-widest"
                      >
                        Claim
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      <Dialog open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
        <DialogContent className="max-w-3xl bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-2xl font-serif text-primary uppercase tracking-wider">
              {selectedTask?.title}
            </DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="h-[50vh] mt-4 rounded-md border border-border bg-secondary/50 p-4">
            <div className="font-mono text-sm whitespace-pre-wrap text-muted-foreground">
              {selectedTask?.content}
            </div>
          </ScrollArea>

          <form onSubmit={handleSubmitAnswer} className="mt-6 flex gap-4">
            <Input
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              placeholder="Enter your solution..."
              className="bg-secondary border-border font-mono text-lg focus-visible:ring-primary h-12"
            />
            <Button 
              type="submit" 
              className="h-12 px-8 font-serif uppercase tracking-widest"
              disabled={submitAnswerMutation.isPending}
            >
              Submit
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
