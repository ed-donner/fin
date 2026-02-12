"use client";

import { useState } from "react";
import { api } from "@/lib/api";

interface TradeBarProps {
  onTradeExecuted: () => void;
}

export default function TradeBar({ onTradeExecuted }: TradeBarProps) {
  const [ticker, setTicker] = useState("");
  const [quantity, setQuantity] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function executeTrade(side: "buy" | "sell") {
    const qty = parseInt(quantity, 10);
    if (!ticker.trim() || isNaN(qty) || qty <= 0) return;

    try {
      const result = await api.trade({
        ticker: ticker.trim().toUpperCase(),
        quantity: qty,
        side,
      });
      setStatus(`${result.side.toUpperCase()} ${result.quantity} ${result.ticker} @ $${result.price.toFixed(2)}`);
      setTicker("");
      setQuantity("");
      onTradeExecuted();
      setTimeout(() => setStatus(null), 3000);
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : "Trade failed"}`);
      setTimeout(() => setStatus(null), 3000);
    }
  }

  return (
    <div className="flex h-full items-center gap-3 text-xs">
      <input
        type="text"
        placeholder="Ticker"
        value={ticker}
        onChange={(e) => setTicker(e.target.value)}
        className="w-24 rounded border border-border bg-bg-secondary px-2 py-1 text-text-primary outline-none focus:border-accent-blue"
      />
      <input
        type="number"
        placeholder="Qty"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        min="1"
        className="w-20 rounded border border-border bg-bg-secondary px-2 py-1 text-text-primary outline-none focus:border-accent-blue"
      />
      <button
        onClick={() => executeTrade("buy")}
        className="rounded bg-green px-3 py-1 font-semibold text-bg-primary hover:brightness-110"
      >
        BUY
      </button>
      <button
        onClick={() => executeTrade("sell")}
        className="rounded bg-red px-3 py-1 font-semibold text-bg-primary hover:brightness-110"
      >
        SELL
      </button>
      {status && (
        <span className="text-text-secondary">{status}</span>
      )}
    </div>
  );
}
