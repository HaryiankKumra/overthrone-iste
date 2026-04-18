import { useMemo, useState } from "react";
import { useGetMapData, getGetMapDataQueryKey } from "@workspace/api-client-react";

type TerritoryEntry = {
  teamId: number;
  teamName: string;
  hp: number;
  ap: number;
  isEliminated: boolean;
  allianceId: number | null;
  x: number;
  y: number;
  size: number;
  color: string;
  width: number;
  height: number;
  landShare: number;
  rank: number;
  tilePath: string;
  labelY: number;
};

type AllianceLink = {
  allianceId: number;
  teamA: TerritoryEntry;
  teamB: TerritoryEntry;
};

function buildTerritoryPath(x: number, y: number, width: number, height: number) {
  const halfW = width / 2;
  const halfH = height / 2;
  const left = x - halfW;
  const right = x + halfW;
  const top = y - halfH;
  const bottom = y + halfH;
  const shoulder = Math.min(2.4, halfW * 0.35);
  const notch = Math.min(1.8, halfH * 0.38);

  return [
    `M ${x} ${top}`,
    `L ${right - shoulder} ${top + notch}`,
    `L ${right} ${y}`,
    `L ${right - shoulder} ${bottom - notch}`,
    `L ${x} ${bottom}`,
    `L ${left + shoulder} ${bottom - notch}`,
    `L ${left} ${y}`,
    `L ${left + shoulder} ${top + notch}`,
    "Z",
  ].join(" ");
}

export function KingdomMap() {
  const { data: mapData } = useGetMapData({
    query: {
      queryKey: getGetMapDataQueryKey(),
      refetchInterval: 5000,
    },
  });

  const [hoveredTeamId, setHoveredTeamId] = useState<number | null>(null);

  const territoryEntries = useMemo<TerritoryEntry[]>(() => {
    if (!mapData) return [];

    const palette = [
      "hsl(11 76% 58%)",
      "hsl(42 74% 52%)",
      "hsl(191 71% 52%)",
      "hsl(147 56% 46%)",
      "hsl(269 58% 62%)",
      "hsl(336 72% 56%)",
      "hsl(27 80% 54%)",
      "hsl(208 63% 56%)",
    ];

    const active = mapData.filter((entry) => !entry.isEliminated);
    const totalActiveHp = active.reduce((sum, entry) => sum + Math.max(entry.hp, 0), 0) || 1;

    const sorted = mapData
      .map((entry) => {
        const color = palette[(entry.teamId * 13) % palette.length];
        const baseWidth = Math.max(9, Math.min(24, entry.size * 0.85));
        const baseHeight = Math.max(5.8, Math.min(12.8, baseWidth * 0.62));
        const width = entry.isEliminated ? baseWidth * 0.72 : baseWidth;
        const height = entry.isEliminated ? baseHeight * 0.72 : baseHeight;
        const landShare = entry.isEliminated ? 0 : (Math.max(entry.hp, 0) / totalActiveHp) * 100;

        return {
          ...entry,
          color,
          width,
          height,
          landShare,
          tilePath: buildTerritoryPath(entry.x, entry.y, width, height),
          labelY: entry.y + height / 2 + 2.6,
        };
      })
      .sort((a, b) => b.landShare - a.landShare);

    return sorted.map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
  }, [mapData]);

  const allianceLinks = useMemo<AllianceLink[]>(() => {
    const byAlliance = new Map<number, TerritoryEntry[]>();

    for (const entry of territoryEntries) {
      if (entry.isEliminated || entry.allianceId == null) continue;
      const current = byAlliance.get(entry.allianceId) ?? [];
      current.push(entry);
      byAlliance.set(entry.allianceId, current);
    }

    const links: AllianceLink[] = [];
    for (const [allianceId, members] of byAlliance) {
      if (members.length < 2) continue;
      links.push({
        allianceId,
        teamA: members[0],
        teamB: members[1],
      });
    }

    return links;
  }, [territoryEntries]);

  const activeEntries = territoryEntries.filter((entry) => !entry.isEliminated);
  const leadingTeamId = activeEntries[0]?.teamId ?? null;
  const eliminatedCount = territoryEntries.length - activeEntries.length;
  const hoveredEntry = territoryEntries.find((entry) => entry.teamId === hoveredTeamId) ?? null;

  return (
    <div className="w-full h-full relative bg-[linear-gradient(160deg,rgba(40,22,16,0.35),transparent_45%),radial-gradient(circle_at_20%_10%,rgba(248,184,90,0.12),transparent_36%),radial-gradient(circle_at_78%_88%,rgba(58,120,170,0.18),transparent_45%)]">
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full"
        onMouseLeave={() => setHoveredTeamId(null)}
      >
        <defs>
          <linearGradient id="campaign-bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgba(20, 24, 34, 0.98)" />
            <stop offset="42%" stopColor="rgba(10, 13, 22, 0.97)" />
            <stop offset="100%" stopColor="rgba(5, 7, 14, 0.99)" />
          </linearGradient>

          <linearGradient id="campaign-lane" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(102, 133, 171, 0.08)" />
            <stop offset="50%" stopColor="rgba(197, 165, 92, 0.14)" />
            <stop offset="100%" stopColor="rgba(102, 133, 171, 0.08)" />
          </linearGradient>

          <pattern id="campaign-grid" width="5" height="5" patternUnits="userSpaceOnUse">
            <path d="M 5 0 L 0 0 0 5" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.16" />
          </pattern>

          <filter id="territory-shadow" x="-50%" y="-50%" width="220%" height="220%">
            <feDropShadow dx="0" dy="0.35" stdDeviation="0.5" floodColor="rgba(0,0,0,0.8)" />
          </filter>

          {territoryEntries.map((entry) => (
            <linearGradient id={`territory-${entry.teamId}`} key={entry.teamId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="rgba(255,255,255,0.64)" />
              <stop offset="35%" stopColor={entry.color} />
              <stop offset="100%" stopColor="rgba(0,0,0,0.38)" />
            </linearGradient>
          ))}
        </defs>

        <rect x="0" y="0" width="100" height="100" fill="url(#campaign-bg)" />
        <rect x="0" y="0" width="100" height="100" fill="url(#campaign-grid)" opacity="0.45" />

        {Array.from({ length: 4 }, (_, lane) => {
          const y = 13 + lane * 19.5;
          return <rect key={`lane-${lane}`} x="5" y={y} width="90" height="10.4" rx="2" fill="url(#campaign-lane)" opacity="0.8" />;
        })}

        {allianceLinks.map((link) => {
          const isFocused = hoveredTeamId === link.teamA.teamId || hoveredTeamId === link.teamB.teamId;
          return (
            <g key={`alliance-${link.allianceId}`} opacity={isFocused ? 1 : 0.75}>
              <line
                x1={link.teamA.x}
                y1={link.teamA.y}
                x2={link.teamB.x}
                y2={link.teamB.y}
                stroke="rgba(88, 221, 189, 0.3)"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <line
                x1={link.teamA.x}
                y1={link.teamA.y}
                x2={link.teamB.x}
                y2={link.teamB.y}
                stroke="rgba(174, 255, 232, 0.82)"
                strokeWidth="0.38"
                strokeLinecap="round"
                strokeDasharray="1.2 1"
              />
            </g>
          );
        })}

        {territoryEntries.map((entry) => (
          <g
            key={entry.teamId}
            onMouseEnter={() => setHoveredTeamId(entry.teamId)}
            style={{ cursor: "crosshair" }}
            filter="url(#territory-shadow)"
          >
            <path
              d={entry.tilePath}
              fill={`url(#territory-${entry.teamId})`}
              opacity={entry.isEliminated ? 0.33 : hoveredTeamId === entry.teamId ? 0.93 : 0.78}
              stroke={entry.isEliminated ? "rgba(255,255,255,0.25)" : entry.color}
              strokeWidth={hoveredTeamId === entry.teamId ? 0.95 : 0.45}
              strokeDasharray={entry.isEliminated ? "1.4 1.1" : "none"}
            />
            <path
              d={entry.tilePath}
              fill="transparent"
              stroke={entry.isEliminated ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.26)"}
              strokeWidth="0.18"
              transform={`translate(0 ${entry.isEliminated ? 0.1 : 0.2})`}
            />

            {!entry.isEliminated && entry.teamId === leadingTeamId && (
              <path
                d={`M ${entry.x - 1.8} ${entry.y - entry.height / 2 - 1.8} L ${entry.x - 0.7} ${entry.y - entry.height / 2 - 0.2} L ${entry.x} ${entry.y - entry.height / 2 - 1.5} L ${entry.x + 0.7} ${entry.y - entry.height / 2 - 0.2} L ${entry.x + 1.8} ${entry.y - entry.height / 2 - 1.8} Z`}
                fill="rgba(255,228,138,0.95)"
              />
            )}

            {entry.isEliminated && (
              <g opacity="0.72">
                <line
                  x1={entry.x - entry.width * 0.22}
                  y1={entry.y - entry.height * 0.2}
                  x2={entry.x + entry.width * 0.22}
                  y2={entry.y + entry.height * 0.2}
                  stroke="rgba(255,255,255,0.7)"
                  strokeWidth="0.34"
                />
                <line
                  x1={entry.x + entry.width * 0.22}
                  y1={entry.y - entry.height * 0.2}
                  x2={entry.x - entry.width * 0.22}
                  y2={entry.y + entry.height * 0.2}
                  stroke="rgba(255,255,255,0.7)"
                  strokeWidth="0.34"
                />
              </g>
            )}

            <text
              x={entry.x}
              y={entry.labelY}
              textAnchor="middle"
              fill="rgba(255,255,255,0.92)"
              fontSize="2.1"
              style={{ fontFamily: "var(--app-font-mono)", letterSpacing: "0.14px" }}
            >
              {entry.teamName.length > 14 ? `${entry.teamName.slice(0, 14)}...` : entry.teamName}
            </text>
          </g>
        ))}
      </svg>

      {hoveredEntry && (
        <div
          className="absolute pointer-events-none bg-card border border-border p-3 rounded-lg shadow-xl shadow-black/50 z-50 backdrop-blur"
          style={{
            left: `${hoveredEntry.x}%`,
            top: `${hoveredEntry.y}%`,
            transform: "translate(-50%, -120%)",
          }}
        >
          <div className="flex items-center justify-between gap-4 mb-1">
            <div className="font-serif font-bold text-white uppercase tracking-wider">{hoveredEntry.teamName}</div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-primary">Rank #{hoveredEntry.rank}</div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm font-mono mt-2">
            <div>
              <div className="text-muted-foreground uppercase text-xs">Health</div>
              <div className="text-destructive font-bold">{hoveredEntry.hp}</div>
            </div>
            <div>
              <div className="text-muted-foreground uppercase text-xs">Action Pts</div>
              <div className="text-primary font-bold">{hoveredEntry.ap}</div>
            </div>
            <div>
              <div className="text-muted-foreground uppercase text-xs">Land</div>
              <div className="text-emerald-400 font-bold">{hoveredEntry.landShare.toFixed(1)}%</div>
            </div>
          </div>
          {hoveredEntry.allianceId && (
            <div className="mt-2 text-xs font-mono text-primary border-t border-border pt-2">
              Alliance #{hoveredEntry.allianceId} Active
            </div>
          )}
        </div>
      )}

      <div className="absolute bottom-3 left-3 right-3 rounded-lg border border-border/80 bg-background/80 backdrop-blur p-3">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Territory Influence</div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Alliances {allianceLinks.length} | Fallen {eliminatedCount}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-28 overflow-auto pr-1">
          {territoryEntries
            .filter((entry) => !entry.isEliminated)
            .slice(0, 8)
            .map((entry) => (
              <div key={entry.teamId} className="space-y-1">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="truncate text-foreground flex items-center gap-2">
                    <span className="w-2 h-2 rotate-45" style={{ backgroundColor: entry.color }} />
                    {entry.rank === 1 && <span className="text-amber-300">#1</span>}
                    {entry.teamName}
                  </span>
                  <span className="text-emerald-400">{entry.landShare.toFixed(1)}%</span>
                </div>
                <div className="h-1.5 rounded-sm bg-secondary/60 overflow-hidden">
                  <div className="h-full" style={{ width: `${Math.min(100, entry.landShare)}%`, backgroundColor: entry.color }} />
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
