"use client";

import { useState } from "react";
import Header, { ConnectionStatus } from "@/components/Header";
import Panel from "@/components/Panel";
import ChatPanel from "@/components/ChatPanel";

export default function Home() {
  const [connectionStatus] = useState<ConnectionStatus>("disconnected");

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
            <Panel title="Watchlist" className="w-64 shrink-0 overflow-auto" />

            {/* Main chart */}
            <Panel title="Chart" className="min-w-0 flex-1" />

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
