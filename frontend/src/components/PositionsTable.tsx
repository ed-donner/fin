import type { Position } from "@/lib/api";

interface Props {
  positions: Position[];
}

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export default function PositionsTable({ positions }: Props) {
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
            <th className="pb-1 pr-2 font-medium">Ticker</th>
            <th className="pb-1 pr-2 text-right font-medium">Qty</th>
            <th className="pb-1 pr-2 text-right font-medium">Avg</th>
            <th className="pb-1 pr-2 text-right font-medium">Price</th>
            <th className="pb-1 pr-2 text-right font-medium">P&L</th>
            <th className="pb-1 text-right font-medium">%</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((p) => {
            const color =
              p.unrealized_pnl >= 0 ? "text-green" : "text-red";
            return (
              <tr key={p.ticker} className="border-t border-border/50">
                <td className="py-0.5 pr-2 font-semibold">{p.ticker}</td>
                <td className="py-0.5 pr-2 text-right">{fmt(p.quantity, 0)}</td>
                <td className="py-0.5 pr-2 text-right">${fmt(p.avg_cost)}</td>
                <td className="py-0.5 pr-2 text-right">
                  ${fmt(p.current_price)}
                </td>
                <td className={`py-0.5 pr-2 text-right ${color}`}>
                  {p.unrealized_pnl >= 0 ? "+" : ""}${fmt(p.unrealized_pnl)}
                </td>
                <td className={`py-0.5 text-right ${color}`}>
                  {p.pnl_percent >= 0 ? "+" : ""}
                  {fmt(p.pnl_percent, 1)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
