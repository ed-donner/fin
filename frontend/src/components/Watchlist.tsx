"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { PriceUpdate } from "@/hooks/useMarketData";
import { api } from "@/lib/api";
import Sparkline from "./Sparkline";

interface WatchlistProps {
  prices: Record<string, PriceUpdate>;
  priceHistory: Record<string, { price: number }[]>;
  selectedTicker: string | null;
  onSelectTicker: (ticker: string) => void;
}

export default function Watchlist({
  prices,
  priceHistory,
  selectedTicker,
  onSelectTicker,
}: WatchlistProps) {
  const [tickers, setTickers] = useState<string[]>([]);
  const [newTicker, setNewTicker] = useState("");

  useEffect(() => {
    api.getWatchlist().then((items) => {
      setTickers(items.map((i) => i.ticker));
    }).catch(() => {});
  }, []);

  const addTicker = useCallback(() => {
    const t = newTicker.trim().toUpperCase();
    if (!t || tickers.includes(t)) return;
    setTickers((prev) => [...prev, t]);
    setNewTicker("");
    api.addTicker(t).catch(() => {
      setTickers((prev) => prev.filter((x) => x !== t));
    });
  }, [newTicker, tickers]);

  const removeTicker = useCallback((ticker: string) => {
    setTickers((prev) => prev.filter((t) => t !== ticker));
    api.removeTicker(ticker).catch(() => {
      setTickers((prev) => [...prev, ticker]);
    });
  }, []);

  return (
    <div className="flex h-full flex-col">
      {/* Add ticker input */}
      <div className="mb-2 flex gap-1">
        <input
          type="text"
          value={newTicker}
          onChange={(e) => setNewTicker(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTicker()}
          placeholder="Add ticker"
          className="min-w-0 flex-1 rounded border border-border bg-bg-primary px-2 py-1 text-xs text-text-primary placeholder:text-text-secondary focus:border-accent-blue focus:outline-none"
        />
        <button
          onClick={addTicker}
          className="rounded bg-accent-purple px-2 py-1 text-xs font-semibold text-white hover:opacity-80"
        >
          +
        </button>
      </div>

      {/* Ticker rows */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-text-secondary">
              <th className="pb-1 font-medium">Ticker</th>
              <th className="pb-1 text-right font-medium">Price</th>
              <th className="pb-1 text-right font-medium">Chg%</th>
              <th className="pb-1 font-medium"></th>
              <th className="pb-1 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {tickers.map((ticker) => (
              <WatchlistRow
                key={ticker}
                ticker={ticker}
                priceData={prices[ticker]}
                history={priceHistory[ticker] ?? []}
                selected={ticker === selectedTicker}
                onSelect={() => onSelectTicker(ticker)}
                onRemove={() => removeTicker(ticker)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface WatchlistRowProps {
  ticker: string;
  priceData?: PriceUpdate;
  history: { price: number }[];
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}

function WatchlistRow({
  ticker,
  priceData,
  history,
  selected,
  onSelect,
  onRemove,
}: WatchlistRowProps) {
  const rowRef = useRef<HTMLTableRowElement>(null);
  const prevDirection = useRef<string | null>(null);

  useEffect(() => {
    if (!priceData || !rowRef.current) return;
    const dir = priceData.direction;
    if (dir === "flat" || dir === prevDirection.current) return;
    prevDirection.current = dir;

    const el = rowRef.current;
    el.classList.remove("flash-up", "flash-down", "flash-fade");
    // Force reflow
    void el.offsetWidth;
    el.classList.add(dir === "up" ? "flash-up" : "flash-down");

    const timer = setTimeout(() => {
      el.classList.remove("flash-up", "flash-down");
      el.classList.add("flash-fade");
    }, 50);

    return () => clearTimeout(timer);
  }, [priceData]);

  const price = priceData?.price;
  const prevPrice = priceData?.previous_price;
  const changePct =
    price != null && prevPrice != null && prevPrice > 0
      ? ((price - prevPrice) / prevPrice) * 100
      : null;

  return (
    <tr
      ref={rowRef}
      onClick={onSelect}
      className={`cursor-pointer border-b border-border/50 hover:bg-bg-secondary/50 ${
        selected ? "bg-bg-secondary" : ""
      }`}
    >
      <td className="py-1 font-semibold text-accent-yellow">{ticker}</td>
      <td className="py-1 text-right tabular-nums">
        {price != null ? price.toFixed(2) : "--"}
      </td>
      <td
        className={`py-1 text-right tabular-nums ${
          changePct != null && changePct > 0
            ? "text-green"
            : changePct != null && changePct < 0
              ? "text-red"
              : "text-text-secondary"
        }`}
      >
        {changePct != null
          ? `${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%`
          : "--"}
      </td>
      <td className="py-1">
        <Sparkline data={history} />
      </td>
      <td className="py-1 text-right">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="text-text-secondary hover:text-red"
          title="Remove"
        >
          x
        </button>
      </td>
    </tr>
  );
}
