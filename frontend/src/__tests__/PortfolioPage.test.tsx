import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock recharts
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => children,
  LineChart: ({ children }: { children: React.ReactNode }) => <svg>{children}</svg>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
}));

// Mock lightweight-charts
vi.mock("lightweight-charts", () => ({
  createChart: () => ({
    addLineSeries: () => ({ setData: vi.fn(), update: vi.fn() }),
    timeScale: () => ({ fitContent: vi.fn() }),
    applyOptions: vi.fn(),
    remove: vi.fn(),
  }),
  ColorType: { Solid: 0 },
  LineType: { Simple: 0 },
}));

// Mock EventSource for useMarketData
class MockEventSource {
  onopen: (() => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  close = vi.fn();
  constructor() {
    setTimeout(() => this.onopen?.(), 0);
  }
}
vi.stubGlobal("EventSource", MockEventSource);

// Mock api module
vi.mock("@/lib/api", () => ({
  api: {
    getPortfolio: vi.fn(),
    trade: vi.fn(),
    getPortfolioHistory: vi.fn(),
    getWatchlist: vi.fn(),
    addTicker: vi.fn(),
    removeTicker: vi.fn(),
    chat: vi.fn(),
  },
  apiFetch: vi.fn(),
}));

import { api } from "@/lib/api";
import Home from "@/app/page";

describe("Portfolio Page Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getWatchlist).mockResolvedValue([]);
    vi.mocked(api.getPortfolioHistory).mockResolvedValue([]);
  });

  it("fetches portfolio data and renders in header", async () => {
    vi.mocked(api.getPortfolio).mockResolvedValue({
      cash_balance: 7500.0,
      total_value: 12500.0,
      positions: [],
    });

    render(<Home />);

    await waitFor(() => {
      expect(api.getPortfolio).toHaveBeenCalled();
    });

    // Portfolio and Cash display different values
    expect(await screen.findByText("$12,500.00")).toBeInTheDocument();
    expect(await screen.findByText("$7,500.00")).toBeInTheDocument();
  });

  it("shows portfolio value with positions", async () => {
    vi.mocked(api.getPortfolio).mockResolvedValue({
      cash_balance: 8165.4,
      total_value: 10000.0,
      positions: [
        {
          ticker: "AAPL",
          quantity: 10,
          avg_cost: 183.46,
          current_price: 183.46,
          unrealized_pnl: 0,
          pnl_percent: 0,
        },
      ],
    });

    render(<Home />);

    expect(await screen.findByText("$8,165.40")).toBeInTheDocument();
    expect(await screen.findByText("$10,000.00")).toBeInTheDocument();
    // AAPL appears in both heatmap and positions table
    const tickers = await screen.findAllByText("AAPL");
    expect(tickers.length).toBeGreaterThanOrEqual(1);
  });

  it("refreshes portfolio after trade execution", async () => {
    vi.mocked(api.getPortfolio)
      .mockResolvedValueOnce({
        cash_balance: 10000.0,
        total_value: 10000.0,
        positions: [],
      })
      .mockResolvedValueOnce({
        cash_balance: 8165.4,
        total_value: 10000.0,
        positions: [
          {
            ticker: "AAPL",
            quantity: 10,
            avg_cost: 183.46,
            current_price: 183.46,
            unrealized_pnl: 0,
            pnl_percent: 0,
          },
        ],
      });

    vi.mocked(api.trade).mockResolvedValue({
      id: "test-id",
      ticker: "AAPL",
      side: "buy",
      quantity: 10,
      price: 183.46,
      executed_at: "2026-01-01T00:00:00Z",
    });

    render(<Home />);

    await waitFor(() => {
      expect(api.getPortfolio).toHaveBeenCalledTimes(1);
    });

    // Execute a trade
    const tickerInput = screen.getByPlaceholderText("Ticker");
    const qtyInput = screen.getByPlaceholderText("Qty");
    fireEvent.change(tickerInput, { target: { value: "AAPL" } });
    fireEvent.change(qtyInput, { target: { value: "10" } });
    fireEvent.click(screen.getByText("BUY"));

    await waitFor(() => {
      expect(api.trade).toHaveBeenCalledWith({
        ticker: "AAPL",
        quantity: 10,
        side: "buy",
      });
    });

    // Portfolio should refresh after trade
    await waitFor(() => {
      expect(api.getPortfolio).toHaveBeenCalledTimes(2);
    });
  });

  it("handles API failure gracefully", async () => {
    vi.mocked(api.getPortfolio).mockRejectedValue(new Error("Network error"));

    render(<Home />);

    await waitFor(() => {
      expect(api.getPortfolio).toHaveBeenCalled();
    });

    // Should show $0.00 (initial state) without crashing
    const zeros = screen.getAllByText("$0.00");
    expect(zeros.length).toBe(2); // Portfolio and Cash both show $0.00
  });
});
