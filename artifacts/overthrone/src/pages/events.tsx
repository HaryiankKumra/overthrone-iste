import { useEffect } from "react";
import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useGetRecentEvents, getGetRecentEventsQueryKey } from "@workspace/api-client-react";
import { useGameWebsocket } from "@/hooks/use-websocket";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Crosshair, Handshake, Skull, Scroll, ShieldAlert, Eye } from "lucide-react";
import { format } from "date-fns";

export default function Events() {
  const [, setLocation] = useLocation();
  const { token } = useAuth();

  useEffect(() => {
    if (!token) setLocation("/");
  }, [token, setLocation]);

  useGameWebsocket();

  const { data: events } = useGetRecentEvents({
    query: {
      queryKey: getGetRecentEventsQueryKey(),
      refetchInterval: 5000,
    }
  });

  const getEventIcon = (type: string) => {
    switch (type) {
      case "attack": return <Crosshair className="w-5 h-5 text-destructive" />;
      case "alliance_formed": return <Handshake className="w-5 h-5 text-green-500" />;
      case "alliance_broken": return <ShieldAlert className="w-5 h-5 text-yellow-500" />;
      case "backstab": return <Skull className="w-5 h-5 text-purple-500" />;
      case "task_completed": return <Scroll className="w-5 h-5 text-primary" />;
      case "team_eliminated": return <Skull className="w-5 h-5 text-destructive" />;
      case "suspicion": return <Eye className="w-5 h-5 text-blue-500" />;
      default: return <Scroll className="w-5 h-5 text-muted-foreground" />;
    }
  };

  return (
    <Layout>
      <div className="p-8 max-w-4xl mx-auto h-[calc(100vh-2rem)] flex flex-col">
        <header className="mb-8 shrink-0">
          <h2 className="text-3xl font-serif text-white tracking-widest uppercase">The Chronicle</h2>
          <p className="text-muted-foreground font-mono mt-2 uppercase tracking-widest text-sm">
            History of the Realm
          </p>
        </header>

        <ScrollArea className="flex-1 bg-card border border-border rounded-lg p-6 relative">
          <div className="absolute left-10 top-0 bottom-0 w-px bg-border"></div>
          
          <div className="space-y-8 relative z-10">
            {events?.map((event) => (
              <div key={event.id} className="flex gap-6 relative">
                <div className="w-8 h-8 rounded-full bg-secondary border-2 border-border flex items-center justify-center shrink-0 mt-1 shadow-lg shadow-black/50 z-10">
                  {getEventIcon(event.type)}
                </div>
                
                <div className="bg-secondary/50 border border-border rounded-lg p-4 flex-1 backdrop-blur-sm">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
                      Epoch {event.epoch}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {format(new Date(event.createdAt), 'HH:mm:ss')}
                    </span>
                  </div>
                  
                  <div className="font-serif text-lg text-white">
                    {event.description}
                  </div>
                  
                  <div className="mt-3 flex items-center gap-2 font-mono text-xs text-muted-foreground">
                    {event.fromTeamName && (
                      <span className="px-2 py-1 bg-card rounded border border-border">{event.fromTeamName}</span>
                    )}
                    {event.toTeamName && (
                      <>
                        <span>→</span>
                        <span className="px-2 py-1 bg-card rounded border border-border">{event.toTeamName}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {events?.length === 0 && (
              <div className="text-center py-20 font-mono text-muted-foreground uppercase tracking-widest">
                The pages are empty.
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </Layout>
  );
}
