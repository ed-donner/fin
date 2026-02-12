"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import type { ConnectionStatus } from "@/components/Header";

export interface PriceUpdate {
  ticker: string;
  price: number;
  previous_price: number;
  timestamp: string;
  direction: "up" | "down" | "flat";
}

export type PriceMap = Record<string, PriceUpdate>;
export type PriceHistory = Record<string, { price: number; time: string }[]>;

const MAX_HISTORY = 500;

export function useMarketData() {
  const [prices, setPrices] = useState<PriceMap>({});
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const historyRef = useRef<PriceHistory>({});
  const [historyVersion, setHistoryVersion] = useState(0);
  const esRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
    }

    const es = new EventSource("/api/stream/prices");
    esRef.current = es;

    es.onopen = () => {
      setStatus("connected");
    };

    es.addEventListener("price", (event) => {
      const data = JSON.parse(event.data) as PriceUpdate | PriceUpdate[];
      const updates = Array.isArray(data) ? data : [data];

      setPrices((prev) => {
        const next = { ...prev };
        for (const u of updates) {
          next[u.ticker] = u;
        }
        return next;
      });

      // Accumulate history
      const h = historyRef.current;
      for (const u of updates) {
        if (!h[u.ticker]) h[u.ticker] = [];
        h[u.ticker].push({ price: u.price, time: u.timestamp });
        if (h[u.ticker].length > MAX_HISTORY) {
          h[u.ticker] = h[u.ticker].slice(-MAX_HISTORY);
        }
      }
      setHistoryVersion((v) => v + 1);
    });

    es.onerror = () => {
      setStatus("reconnecting");
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
    };
  }, [connect]);

  // Snapshot ref into a render-safe value keyed on historyVersion
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const priceHistory = useMemo(() => historyRef.current, [historyVersion]);

  return {
    prices,
    connectionStatus: status,
    priceHistory,
    historyVersion,
  };
}
