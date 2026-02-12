"use client";

import type { Position } from "@/lib/api";
import type { PriceMap } from "@/hooks/useMarketData";

interface PortfolioHeatmapProps {
  positions: Position[];
  prices: PriceMap;
}

export default function PortfolioHeatmap({ positions, prices }: PortfolioHeatmapProps) {
  if (positions.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-text-secondary">
        No positions
      </div>
    );
  }

  // Compute live values and total
  const items = positions.map((pos) => {
    const livePrice = prices[pos.ticker]?.price ?? pos.current_price;
    const value = Math.abs(livePrice * pos.quantity);
    const pnlPct = pos.avg_cost > 0 ? ((livePrice - pos.avg_cost) / pos.avg_cost) * 100 : 0;
    return { ticker: pos.ticker, value, pnlPct };
  });

  const totalValue = items.reduce((sum, i) => sum + i.value, 0);
  if (totalValue === 0) return null;

  // Sort by value descending for better treemap layout
  items.sort((a, b) => b.value - a.value);

  return (
    <div className="flex h-full flex-wrap gap-px overflow-hidden">
      {items.map((item) => {
        const weight = item.value / totalValue;
        const intensity = Math.min(Math.abs(item.pnlPct) / 5, 1);
        const bg = item.pnlPct >= 0
          ? `rgba(63, 185, 80, ${0.15 + intensity * 0.45})`
          : `rgba(248, 81, 73, ${0.15 + intensity * 0.45})`;

        return (
          <div
            key={item.ticker}
            style={{
              flexBasis: `${Math.max(weight * 100, 15)}%`,
              flexGrow: weight,
              backgroundColor: bg,
            }}
            className="flex min-h-[28px] min-w-[40px] flex-col items-center justify-center rounded-sm px-1"
          >
            <span className="text-[10px] font-bold text-text-primary">{item.ticker}</span>
            <span className={`text-[9px] ${item.pnlPct >= 0 ? "text-green" : "text-red"}`}>
              {item.pnlPct >= 0 ? "+" : ""}{item.pnlPct.toFixed(1)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
