"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { ConnectionStatus } from "@/components/Header";

export interface PriceUpdate {
  ticker: string;
  price: number;
  previous_price: number;
  timestamp: string;
  direction: "up" | "down" | "flat";
}

export type PriceMap = Record<string, PriceUpdate>;

export function useMarketData() {
  const [prices, setPrices] = useState<PriceMap>({});
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
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

    es.onmessage = (event) => {
      const data = JSON.parse(event.data) as PriceUpdate | PriceUpdate[];
      setPrices((prev) => {
        const next = { ...prev };
        const updates = Array.isArray(data) ? data : [data];
        for (const u of updates) {
          next[u.ticker] = u;
        }
        return next;
      });
    };

    es.onerror = () => {
      setStatus("reconnecting");
      // EventSource auto-reconnects; we just track the status
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
    };
  }, [connect]);

  return { prices, connectionStatus: status };
}
