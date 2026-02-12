"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { SnapshotResponse } from "@/lib/api";

interface Props {
  snapshots: SnapshotResponse[];
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatValue(v: number): string {
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PnlChart({ snapshots }: Props) {
  if (snapshots.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-text-secondary">
        No data yet
      </div>
    );
  }

  const data = snapshots.map((s) => ({
    time: formatTime(s.recorded_at),
    value: s.total_value,
  }));

  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = (max - min) * 0.1 || 100;

  const startValue = data[0].value;
  const endValue = data[data.length - 1].value;
  const lineColor = endValue >= startValue ? "#3fb950" : "#f85149";

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <XAxis
          dataKey="time"
          tick={{ fontSize: 9, fill: "#8b949e" }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[min - padding, max + padding]}
          tick={{ fontSize: 9, fill: "#8b949e" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
          width={48}
        />
        <Tooltip
          contentStyle={{
            background: "#161b22",
            border: "1px solid #30363d",
            borderRadius: 4,
            fontSize: 11,
            fontFamily: "var(--font-mono), monospace",
            color: "#e6edf3",
          }}
          formatter={(v) => [formatValue(v as number), "Value"]}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke={lineColor}
          strokeWidth={1.5}
          dot={false}
          activeDot={{ r: 3, fill: lineColor }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
