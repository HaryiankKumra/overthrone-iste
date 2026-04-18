import { useEffect, useRef, useState } from "react";
import { useGetMapData, getGetMapDataQueryKey } from "@workspace/api-client-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function KingdomMap() {
  const { data: mapData } = useGetMapData({
    query: {
      queryKey: getGetMapDataQueryKey(),
      refetchInterval: 5000,
    }
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredEntry, setHoveredEntry] = useState<any | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mapData) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      if (containerRef.current) {
        canvas.width = containerRef.current.clientWidth;
        canvas.height = containerRef.current.clientHeight;
        drawMap(ctx, canvas.width, canvas.height, mapData);
      }
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [mapData]);

  const drawMap = (ctx: CanvasRenderingContext2D, width: number, height: number, data: any) => {
    ctx.clearRect(0, 0, width, height);

    // simple drawing for now
    data.forEach((entry: any) => {
      if (entry.isEliminated) return;
      const x = (entry.x / 100) * width;
      const y = (entry.y / 100) * height;
      const radius = Math.max(10, Math.min(entry.size, 50)); // scaled by HP

      // Draw territory
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = entry.allianceId ? "rgba(43, 74%, 49%, 0.4)" : "rgba(200, 50, 50, 0.4)";
      ctx.fill();

      // Border
      ctx.lineWidth = 2;
      ctx.strokeStyle = entry.allianceId ? "hsl(43 74% 49%)" : "hsl(0 63% 31%)";
      ctx.stroke();

      // Text
      ctx.fillStyle = "#fff";
      ctx.font = "12px var(--app-font-serif)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(entry.teamName, x, y);
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!mapData || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const width = rect.width;
    const height = rect.height;

    let found = null;
    for (const entry of mapData) {
      if (entry.isEliminated) continue;
      const ex = (entry.x / 100) * width;
      const ey = (entry.y / 100) * height;
      const radius = Math.max(10, Math.min(entry.size, 50));

      const dist = Math.hypot(ex - x, ey - y);
      if (dist <= radius) {
        found = entry;
        break;
      }
    }
    setHoveredEntry(found);
  };

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredEntry(null)}
        className="w-full h-full absolute inset-0 cursor-crosshair"
      />
      {hoveredEntry && (
        <div
          className="absolute pointer-events-none bg-card border border-border p-3 rounded-lg shadow-xl shadow-black/50 z-50 backdrop-blur"
          style={{
            left: `${(hoveredEntry.x / 100) * 100}%`,
            top: `${(hoveredEntry.y / 100) * 100}%`,
            transform: "translate(-50%, -120%)",
          }}
        >
          <div className="font-serif font-bold text-white mb-1 uppercase tracking-wider">{hoveredEntry.teamName}</div>
          <div className="grid grid-cols-2 gap-4 text-sm font-mono mt-2">
            <div>
              <div className="text-muted-foreground uppercase text-xs">Health</div>
              <div className="text-destructive font-bold">{hoveredEntry.hp}</div>
            </div>
            <div>
              <div className="text-muted-foreground uppercase text-xs">Action Pts</div>
              <div className="text-primary font-bold">{hoveredEntry.ap}</div>
            </div>
          </div>
          {hoveredEntry.allianceId && (
            <div className="mt-2 text-xs font-mono text-primary border-t border-border pt-2">
              Allied Forces
            </div>
          )}
        </div>
      )}
    </div>
  );
}
