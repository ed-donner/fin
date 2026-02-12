"use client";

import type { Position } from "@/lib/api";
import type { PriceMap } from "@/hooks/useMarketData";

interface PositionsTableProps {
  positions: Position[];
  prices: PriceMap;
}

export default function PositionsTable({ positions, prices }: PositionsTableProps) {
  if (positions.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-text-secondary">
        No positions
      </div>
    );
  }

  return (
    <div className="overflow-auto text-xs">
      <table className="w-full">
        <thead>
          <tr className="text-left text-text-secondary">
            <th className="pb-1 pr-2">Ticker</th>
            <th className="pb-1 pr-2 text-right">Qty</th>
            <th className="pb-1 pr-2 text-right">Avg</th>
            <th className="pb-1 pr-2 text-right">Price</th>
            <th className="pb-1 pr-2 text-right">P&L</th>
            <th className="pb-1 text-right">%</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((pos) => {
            const livePrice = prices[pos.ticker]?.price ?? pos.current_price;
            const pnl = (livePrice - pos.avg_cost) * pos.quantity;
            const pnlPct = pos.avg_cost > 0 ? ((livePrice - pos.avg_cost) / pos.avg_cost) * 100 : 0;
            const color = pnl >= 0 ? "text-green" : "text-red";

            return (
              <tr key={pos.ticker} className="border-t border-border">
                <td className="py-1 pr-2 font-semibold text-accent-yellow">{pos.ticker}</td>
                <td className="py-1 pr-2 text-right">{pos.quantity}</td>
                <td className="py-1 pr-2 text-right">${pos.avg_cost.toFixed(2)}</td>
                <td className="py-1 pr-2 text-right">${livePrice.toFixed(2)}</td>
                <td className={`py-1 pr-2 text-right ${color}`}>
                  {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                </td>
                <td className={`py-1 text-right ${color}`}>
                  {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(1)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
