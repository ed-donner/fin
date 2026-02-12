"use client";

import { useState, useEffect, useCallback } from "react";
import Header from "@/components/Header";
import Panel from "@/components/Panel";
import PortfolioHeatmap from "@/components/PortfolioHeatmap";
import PnlChart from "@/components/PnlChart";
import PositionsTable from "@/components/PositionsTable";
import TradeBar from "@/components/TradeBar";
import { useMarketData } from "@/hooks/useMarketData";
import { api } from "@/lib/api";
import type { PortfolioResponse, SnapshotResponse, Position } from "@/lib/api";

export default function Home() {
  const { prices, connectionStatus } = useMarketData();
  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);
  const [snapshots, setSnapshots] = useState<SnapshotResponse[]>([]);

  const fetchPortfolio = useCallback(async () => {
    try {
      setPortfolio(await api.getPortfolio());
    } catch {
      /* backend not ready yet */
    }
  }, []);

  const fetchSnapshots = useCallback(async () => {
    try {
      setSnapshots(await api.getPortfolioHistory());
    } catch {
      /* backend not ready yet */
    }
  }, []);

  useEffect(() => {
    fetchPortfolio();
    fetchSnapshots();
    const id = setInterval(() => {
      fetchPortfolio();
      fetchSnapshots();
    }, 15_000);
    return () => clearInterval(id);
  }, [fetchPortfolio, fetchSnapshots]);

  // Merge live SSE prices into positions
  const positions: Position[] = (portfolio?.positions ?? []).map((p) => {
    const live = prices[p.ticker];
    if (!live) return p;
    const currentPrice = live.price;
    const costBasis = p.avg_cost * p.quantity;
    const marketValue = currentPrice * p.quantity;
    const unrealizedPnl = marketValue - costBasis;
    const pnlPercent = costBasis > 0 ? (unrealizedPnl / costBasis) * 100 : 0;
    return {
      ...p,
      current_price: currentPrice,
      unrealized_pnl: unrealizedPnl,
      pnl_percent: pnlPercent,
    };
  });

  // Compute live total value
  const totalPositionValue = positions.reduce(
    (sum, p) => sum + p.current_price * p.quantity,
    0,
  );
  const cashBalance = portfolio?.cash_balance ?? 10000;
  const totalValue = portfolio ? totalPositionValue + cashBalance : 10000;

  function handleTradeExecuted() {
    fetchPortfolio();
    fetchSnapshots();
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header
        totalValue={totalValue}
        cashBalance={cashBalance}
        connectionStatus={connectionStatus}
      />

      <div className="flex min-h-0 flex-1">
        {/* Main content area */}
        <div className="flex min-w-0 flex-1 flex-col gap-1 p-1">
          {/* Top row: watchlist + chart + portfolio */}
          <div className="flex min-h-0 flex-1 gap-1">
            {/* Watchlist */}
            <Panel title="Watchlist" className="w-64 shrink-0 overflow-auto" />

            {/* Main chart */}
            <Panel title="Chart" className="min-w-0 flex-1" />

            {/* Right column: portfolio views */}
            <div className="flex w-72 shrink-0 flex-col gap-1">
              <Panel title="Portfolio Heatmap" className="flex-1 overflow-hidden">
                <div className="h-full min-h-0">
                  <PortfolioHeatmap positions={positions} />
                </div>
              </Panel>
              <Panel title="P&L" className="flex-1 overflow-hidden">
                <div className="h-full min-h-0">
                  <PnlChart snapshots={snapshots} />
                </div>
              </Panel>
              <Panel title="Positions" className="flex-1 overflow-auto">
                <PositionsTable positions={positions} />
              </Panel>
            </div>
          </div>

          {/* Trade bar */}
          <Panel title="Trade" className="h-14 shrink-0">
            <TradeBar onTradeExecuted={handleTradeExecuted} />
          </Panel>
        </div>

        {/* Chat sidebar */}
        <Panel
          title="AI Chat"
          className="w-80 shrink-0 border-l border-border"
        />
      </div>
    </div>
  );
}
