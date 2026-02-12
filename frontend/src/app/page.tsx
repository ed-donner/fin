"use client";

import { useState } from "react";
import Header from "@/components/Header";
import Panel from "@/components/Panel";
import ChatPanel from "@/components/ChatPanel";
import Watchlist from "@/components/Watchlist";
import MainChart from "@/components/MainChart";
import { useMarketData } from "@/hooks/useMarketData";

export default function Home() {
  const { prices, connectionStatus, priceHistory } = useMarketData();
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header
        totalValue={10000}
        cashBalance={10000}
        connectionStatus={connectionStatus}
      />

      <div className="flex min-h-0 flex-1">
        {/* Main content area */}
        <div className="flex min-w-0 flex-1 flex-col gap-1 p-1">
          {/* Top row: watchlist + chart + portfolio */}
          <div className="flex min-h-0 flex-1 gap-1">
            {/* Watchlist */}
            <Panel title="Watchlist" className="w-64 shrink-0 overflow-auto">
              <Watchlist
                prices={prices}
                priceHistory={priceHistory}
                selectedTicker={selectedTicker}
                onSelectTicker={setSelectedTicker}
              />
            </Panel>

            {/* Main chart */}
            <Panel title="Chart" className="min-w-0 flex-1">
              <MainChart
                ticker={selectedTicker}
                priceHistory={priceHistory}
              />
            </Panel>

            {/* Right column: portfolio views */}
            <div className="flex w-72 shrink-0 flex-col gap-1">
              <Panel title="Portfolio Heatmap" className="flex-1" />
              <Panel title="P&L" className="flex-1" />
              <Panel title="Positions" className="flex-1" />
            </div>
          </div>

          {/* Trade bar */}
          <Panel title="Trade" className="h-14 shrink-0" />
        </div>

        {/* Chat sidebar */}
        <ChatPanel />
      </div>
    </div>
  );
}
