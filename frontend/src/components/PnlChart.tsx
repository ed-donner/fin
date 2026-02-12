"use client";

import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { api, type SnapshotResponse } from "@/lib/api";

const REFRESH_MS = 30_000;

export default function PnlChart() {
  const [snapshots, setSnapshots] = useState<SnapshotResponse[]>([]);

  useEffect(() => {
    let mounted = true;

    async function fetchHistory() {
      try {
        const data = await api.getPortfolioHistory();
        if (mounted) setSnapshots(data);
      } catch {
        // silently retry on next interval
      }
    }

    fetchHistory();
    const interval = setInterval(fetchHistory, REFRESH_MS);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if (snapshots.length < 2) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-text-secondary">
        Waiting for data...
      </div>
    );
  }

  const chartData = snapshots.map((s) => ({
    time: new Date(s.recorded_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    value: s.total_value,
  }));

  const values = chartData.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = (max - min) * 0.1 || 100;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
        <XAxis dataKey="time" tick={{ fontSize: 9, fill: "#8b949e" }} tickLine={false} axisLine={false} />
        <YAxis
          domain={[min - padding, max + padding]}
          tick={{ fontSize: 9, fill: "#8b949e" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => `$${(v / 1000).toFixed(1)}k`}
          width={45}
        />
        <Tooltip
          contentStyle={{ background: "#161b22", border: "1px solid #30363d", fontSize: 11 }}
          labelStyle={{ color: "#8b949e" }}
          formatter={(v) => [`$${Number(v).toFixed(2)}`, "Value"]}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="#209dd7"
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
