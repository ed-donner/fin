"use client";

import { LineChart, Line, YAxis } from "recharts";

interface SparklineProps {
  data: { price: number }[];
  width?: number;
  height?: number;
  color?: string;
}

export default function Sparkline({
  data,
  width = 80,
  height = 24,
  color,
}: SparklineProps) {
  if (data.length < 2) return null;

  const first = data[0].price;
  const last = data[data.length - 1].price;
  const strokeColor = color ?? (last >= first ? "#3fb950" : "#f85149");

  return (
    <LineChart width={width} height={height} data={data}>
      <YAxis domain={["dataMin", "dataMax"]} hide />
      <Line
        type="monotone"
        dataKey="price"
        stroke={strokeColor}
        strokeWidth={1.5}
        dot={false}
        isAnimationActive={false}
      />
    </LineChart>
  );
}
