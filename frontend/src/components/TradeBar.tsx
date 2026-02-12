"use client";

import { useState } from "react";
import { api } from "@/lib/api";

interface Props {
  onTradeExecuted: () => void;
}

export default function TradeBar({ onTradeExecuted }: Props) {
  const [ticker, setTicker] = useState("");
  const [quantity, setQuantity] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function executeTrade(side: "buy" | "sell") {
    const t = ticker.trim().toUpperCase();
    const q = Number(quantity);
    if (!t || !q || q <= 0) return;

    setSubmitting(true);
    try {
      await api.trade({ ticker: t, quantity: q, side });
      setTicker("");
      setQuantity("");
      onTradeExecuted();
    } catch (err) {
      console.error("Trade failed:", err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        placeholder="TICKER"
        value={ticker}
        onChange={(e) => setTicker(e.target.value)}
        className="w-24 rounded border border-border bg-bg-primary px-2 py-1 text-xs uppercase text-text-primary placeholder:text-text-secondary focus:border-accent-blue focus:outline-none"
        disabled={submitting}
      />
      <input
        type="number"
        placeholder="Qty"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        min={1}
        className="w-20 rounded border border-border bg-bg-primary px-2 py-1 text-xs text-text-primary placeholder:text-text-secondary focus:border-accent-blue focus:outline-none"
        disabled={submitting}
      />
      <button
        onClick={() => executeTrade("buy")}
        disabled={submitting || !ticker.trim() || !quantity}
        className="rounded bg-green px-3 py-1 text-xs font-semibold text-bg-primary hover:brightness-110 disabled:opacity-40"
      >
        BUY
      </button>
      <button
        onClick={() => executeTrade("sell")}
        disabled={submitting || !ticker.trim() || !quantity}
        className="rounded bg-red px-3 py-1 text-xs font-semibold text-bg-primary hover:brightness-110 disabled:opacity-40"
      >
        SELL
      </button>
    </div>
  );
}
