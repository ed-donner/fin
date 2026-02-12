"use client";

import { useEffect, useRef } from "react";
import { createChart, type IChartApi, type ISeriesApi, ColorType, LineSeries } from "lightweight-charts";

interface MainChartProps {
  ticker: string | null;
  priceHistory: Record<string, { price: number; time: string }[]>;
}

export default function MainChart({ ticker, priceHistory }: MainChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  // Create chart once
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#8b949e",
        fontFamily: "monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(48, 54, 61, 0.5)" },
        horzLines: { color: "rgba(48, 54, 61, 0.5)" },
      },
      crosshair: {
        vertLine: { color: "#30363d" },
        horzLine: { color: "#30363d" },
      },
      rightPriceScale: {
        borderColor: "#30363d",
      },
      timeScale: {
        borderColor: "#30363d",
        timeVisible: true,
        secondsVisible: true,
      },
    });

    const series = chart.addSeries(LineSeries, {
      color: "#209dd7",
      lineWidth: 2,
      priceFormat: { type: "price", precision: 2, minMove: 0.01 },
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    const observer = new ResizeObserver(handleResize);
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Update data when ticker or history changes
  useEffect(() => {
    if (!seriesRef.current || !ticker) return;

    const history = priceHistory[ticker] ?? [];
    const data = history.map((p) => ({
      time: Math.floor(new Date(p.time).getTime() / 1000) as import("lightweight-charts").UTCTimestamp,
      value: p.price,
    }));

    seriesRef.current.setData(data);

    if (data.length > 0) {
      chartRef.current?.timeScale().fitContent();
    }
  }, [ticker, priceHistory]);

  if (!ticker) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-text-secondary">
        Select a ticker from the watchlist
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-1 text-sm font-semibold text-accent-yellow">{ticker}</div>
      <div ref={containerRef} className="min-h-0 flex-1" />
    </div>
  );
}
