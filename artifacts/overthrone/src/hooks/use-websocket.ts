import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetGameStateQueryKey, getGetLeaderboardQueryKey, getGetMapDataQueryKey, getGetRecentEventsQueryKey, getGetTeamQueryKey, getListTeamsQueryKey } from "@workspace/api-client-react";

export function useGameWebsocket(teamId?: number) {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const wsEnv = import.meta.env.VITE_ENABLE_WEBSOCKET;
    const websocketEnabled = wsEnv === "true" || (wsEnv == null && import.meta.env.DEV);

    if (!websocketEnabled) {
      return;
    }

    // Determine the WS URL correctly depending on the environment
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;
    let isUnmounted = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (isUnmounted) return;

      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        if (import.meta.env.DEV) {
          console.log("WebSocket connected");
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          switch (data.type) {
            case "gameState":
              queryClient.invalidateQueries({ queryKey: getGetGameStateQueryKey() });
              break;
            case "leaderboard":
              queryClient.invalidateQueries({ queryKey: getGetLeaderboardQueryKey() });
              break;
            case "mapData":
              queryClient.invalidateQueries({ queryKey: getGetMapDataQueryKey() });
              break;
            case "recentEvents":
              queryClient.invalidateQueries({ queryKey: getGetRecentEventsQueryKey() });
              break;
            case "teamUpdate":
              queryClient.invalidateQueries({ queryKey: getListTeamsQueryKey() });
              if (teamId && data.teamId === teamId) {
                 queryClient.invalidateQueries({ queryKey: getGetTeamQueryKey(teamId) });
              }
              break;
          }
        } catch (e) {
          console.error("Error parsing WS message", e);
        }
      };

      ws.onclose = () => {
        if (isUnmounted) return;
        if (import.meta.env.DEV) {
          console.log("WebSocket disconnected, reconnecting in 5s...");
        }
        reconnectTimer = setTimeout(connect, 5000);
      };

      ws.onerror = (err) => {
        if (import.meta.env.DEV) {
          console.error("WebSocket error", err);
        }
      };

      wsRef.current = ws;
    };

    connect();

    return () => {
      isUnmounted = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [queryClient, teamId]);
}
