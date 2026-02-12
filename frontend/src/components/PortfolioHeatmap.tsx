"use client";

import { Treemap, ResponsiveContainer } from "recharts";
import type { Position } from "@/lib/api";

interface Props {
  positions: Position[];
}

interface TreemapNode {
  [key: string]: string | number;
  name: string;
  size: number;
  pnlPercent: number;
  fill: string;
}

function pnlColor(pct: number): string {
  if (pct > 5) return "#2ea043";
  if (pct > 2) return "#3fb950";
  if (pct > 0) return "#56d364";
  if (pct > -2) return "#f85149";
  if (pct > -5) return "#da3633";
  return "#b62324";
}

function CustomContent(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  pnlPercent?: number;
  fill?: string;
}) {
  const { x = 0, y = 0, width = 0, height = 0, name, pnlPercent, fill } = props;
  if (width < 4 || height < 4) return null;

  const showLabel = width > 30 && height > 20;
  const showPnl = width > 40 && height > 34;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill}
        stroke="#0d1117"
        strokeWidth={2}
        rx={3}
      />
      {showLabel && (
        <text
          x={x + width / 2}
          y={y + height / 2 + (showPnl ? -6 : 0)}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#e6edf3"
          fontSize={11}
          fontWeight={600}
          fontFamily="var(--font-mono), monospace"
        >
          {name}
        </text>
      )}
      {showPnl && pnlPercent !== undefined && (
        <text
          x={x + width / 2}
          y={y + height / 2 + 10}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#e6edf3"
          fontSize={10}
          fontFamily="var(--font-mono), monospace"
        >
          {pnlPercent >= 0 ? "+" : ""}
          {pnlPercent.toFixed(1)}%
        </text>
      )}
    </g>
  );
}

export default function PortfolioHeatmap({ positions }: Props) {
  if (positions.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-text-secondary">
        No positions
      </div>
    );
  }

  const totalValue = positions.reduce(
    (sum, p) => sum + p.current_price * p.quantity,
    0,
  );

  const data: TreemapNode[] = positions.map((p) => ({
    name: p.ticker,
    size: Math.max((p.current_price * p.quantity) / totalValue, 0.01),
    pnlPercent: p.pnl_percent,
    fill: pnlColor(p.pnl_percent),
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <Treemap
        data={data}
        dataKey="size"
        aspectRatio={1}
        content={<CustomContent />}
      />
    </ResponsiveContainer>
  );
}
