import { useEffect } from "react";
import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { 
  useAdminListTeams, getAdminListTeamsQueryKey,
  useGetGameState, getGetGameStateQueryKey,
  useStartGame, useResetGame, useAdvanceEpoch, useEliminateTeam, useCreateTask
} from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Play, RotateCcw, FastForward, Skull, Plus } from "lucide-react";
import { useState } from "react";

export default function Admin() {
  const [, setLocation] = useLocation();
  const { team, token } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!token || !team?.isAdmin) {
      setLocation("/");
    }
  }, [token, team, setLocation]);

  const { data: gameState, refetch: refetchGame } = useGetGameState({
    query: { queryKey: getGetGameStateQueryKey(), refetchInterval: 5000 }
  });

  const { data: teams, refetch: refetchTeams } = useAdminListTeams({
    query: { queryKey: getAdminListTeamsQueryKey(), refetchInterval: 5000 }
  });

  const startGameMutation = useStartGame();
  const resetGameMutation = useResetGame();
  const advanceEpochMutation = useAdvanceEpoch();
  const eliminateTeamMutation = useEliminateTeam();

  const handleAction = (mutation: any, actionName: string) => {
    mutation.mutate(undefined, {
      onSuccess: () => {
        toast({ title: "Success", description: `${actionName} executed.` });
        refetchGame();
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    });
  };

  const handleEliminate = (teamId: number) => {
    if (confirm("Eliminate this team forever?")) {
      eliminateTeamMutation.mutate({ id: teamId }, {
        onSuccess: () => {
          toast({ title: "Team Eliminated", description: "The execution was successful." });
          refetchTeams();
        },
        onError: (err: any) => {
          toast({ title: "Error", description: err.message, variant: "destructive" });
        }
      });
    }
  };

  return (
    <Layout>
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        <header className="mb-8">
          <h2 className="text-3xl font-serif text-white tracking-widest uppercase">The Architect's Chamber</h2>
          <p className="text-muted-foreground font-mono mt-2 uppercase tracking-widest text-sm">
            Control the flow of time and war
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="p-6 bg-card border-border col-span-1 md:col-span-4 flex flex-wrap gap-4 items-center justify-between">
            <div className="font-mono uppercase tracking-widest">
              <span className="text-muted-foreground mr-2">Status:</span>
              <span className="text-white font-bold">{gameState?.status}</span>
              <span className="text-muted-foreground ml-6 mr-2">Epoch:</span>
              <span className="text-primary font-bold">{gameState?.currentEpoch}</span>
              <span className="text-muted-foreground ml-6 mr-2">Phase:</span>
              <span className="text-white font-bold">{gameState?.phase}</span>
            </div>
            <div className="flex gap-4">
              <Button onClick={() => handleAction(startGameMutation, "Start Game")} variant="outline" className="font-serif">
                <Play className="w-4 h-4 mr-2" /> Start
              </Button>
              <Button onClick={() => handleAction(advanceEpochMutation, "Advance Epoch")} variant="outline" className="font-serif">
                <FastForward className="w-4 h-4 mr-2" /> Next Epoch
              </Button>
              <Button onClick={() => handleAction(resetGameMutation, "Reset Game")} variant="destructive" className="font-serif">
                <RotateCcw className="w-4 h-4 mr-2" /> Reset
              </Button>
              <CreateTaskDialog />
            </div>
          </Card>

          <Card className="p-6 bg-card border-border col-span-1 md:col-span-4">
            <h3 className="font-serif text-xl text-white mb-6 uppercase tracking-wider">All Houses</h3>
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="font-mono text-xs uppercase tracking-widest">ID</TableHead>
                  <TableHead className="font-mono text-xs uppercase tracking-widest">Name</TableHead>
                  <TableHead className="font-mono text-xs uppercase tracking-widest text-right">HP</TableHead>
                  <TableHead className="font-mono text-xs uppercase tracking-widest text-right">AP</TableHead>
                  <TableHead className="font-mono text-xs uppercase tracking-widest text-right">Tasks</TableHead>
                  <TableHead className="font-mono text-xs uppercase tracking-widest text-right">Attacks</TableHead>
                  <TableHead className="font-mono text-xs uppercase tracking-widest text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams?.map(t => (
                  <TableRow key={t.id} className="border-border bg-secondary/20 hover:bg-secondary/50">
                    <TableCell className="font-mono text-muted-foreground">{t.id}</TableCell>
                    <TableCell className="font-serif text-white">
                      {t.name} {t.isEliminated && <span className="text-destructive text-[10px] ml-2 font-mono uppercase">Eliminated</span>}
                    </TableCell>
                    <TableCell className="text-right font-mono text-destructive">{t.hp}</TableCell>
                    <TableCell className="text-right font-mono text-primary">{t.ap}</TableCell>
                    <TableCell className="text-right font-mono">{t.tasksCompleted}</TableCell>
                    <TableCell className="text-right font-mono">{t.attacksMade}</TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleEliminate(t.id)}
                        disabled={t.isEliminated || t.isAdmin}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Skull className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      </div>
    </Layout>
  );
}

function CreateTaskDialog() {
  const { toast } = useToast();
  const createTaskMutation = useCreateTask();
  const [open, setOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    type: "sudoku" as "sudoku" | "math" | "ctf" | "algorithm",
    difficulty: "easy" as "easy" | "medium" | "hard",
    content: "",
    answer: ""
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createTaskMutation.mutate({ data: formData }, {
      onSuccess: () => {
        toast({ title: "Task Created" });
        setOpen(false);
        setFormData({ title: "", description: "", type: "sudoku", difficulty: "easy", content: "", answer: "" });
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="font-serif border-primary text-primary hover:bg-primary/10">
          <Plus className="w-4 h-4 mr-2" /> New Task
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl uppercase tracking-wider text-primary">Forge New Challenge</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-mono text-xs uppercase text-muted-foreground">Title</Label>
              <Input 
                required
                value={formData.title}
                onChange={e => setFormData({...formData, title: e.target.value})}
                className="bg-secondary border-border"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-mono text-xs uppercase text-muted-foreground">Type</Label>
              <Select value={formData.type} onValueChange={(v: any) => setFormData({...formData, type: v})}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sudoku">Sudoku</SelectItem>
                  <SelectItem value="math">Math</SelectItem>
                  <SelectItem value="ctf">CTF</SelectItem>
                  <SelectItem value="algorithm">Algorithm</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label className="font-mono text-xs uppercase text-muted-foreground">Description (Short)</Label>
            <Input 
              required
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
              className="bg-secondary border-border"
            />
          </div>

          <div className="space-y-2">
            <Label className="font-mono text-xs uppercase text-muted-foreground">Content (Full Challenge Text/Code)</Label>
            <Textarea 
              required
              rows={5}
              value={formData.content}
              onChange={e => setFormData({...formData, content: e.target.value})}
              className="bg-secondary border-border font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-mono text-xs uppercase text-muted-foreground">Difficulty</Label>
              <Select value={formData.difficulty} onValueChange={(v: any) => setFormData({...formData, difficulty: v})}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="font-mono text-xs uppercase text-muted-foreground">Exact Answer</Label>
              <Input 
                required
                value={formData.answer}
                onChange={e => setFormData({...formData, answer: e.target.value})}
                className="bg-secondary border-border font-mono"
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <Button type="submit" disabled={createTaskMutation.isPending} className="font-serif uppercase tracking-widest">
              Create Task
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
