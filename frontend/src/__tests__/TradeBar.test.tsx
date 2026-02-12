import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import TradeBar from "@/components/TradeBar";

vi.mock("@/lib/api", () => ({
  api: {
    trade: vi.fn(),
  },
  apiFetch: vi.fn(),
}));

import { api } from "@/lib/api";

describe("TradeBar", () => {
  const onTradeExecuted = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders ticker input, quantity input, and buy/sell buttons", () => {
    render(<TradeBar onTradeExecuted={onTradeExecuted} />);
    expect(screen.getByPlaceholderText("Ticker")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Qty")).toBeInTheDocument();
    expect(screen.getByText("BUY")).toBeInTheDocument();
    expect(screen.getByText("SELL")).toBeInTheDocument();
  });

  it("calls api.trade with buy side on BUY click", async () => {
    vi.mocked(api.trade).mockResolvedValue({
      id: "t1",
      ticker: "AAPL",
      side: "buy",
      quantity: 10,
      price: 150.0,
      executed_at: "2026-01-01T00:00:00Z",
    });

    render(<TradeBar onTradeExecuted={onTradeExecuted} />);
    fireEvent.change(screen.getByPlaceholderText("Ticker"), {
      target: { value: "aapl" },
    });
    fireEvent.change(screen.getByPlaceholderText("Qty"), {
      target: { value: "10" },
    });
    fireEvent.click(screen.getByText("BUY"));

    await waitFor(() => {
      expect(api.trade).toHaveBeenCalledWith({
        ticker: "AAPL",
        quantity: 10,
        side: "buy",
      });
    });
    expect(onTradeExecuted).toHaveBeenCalled();
  });

  it("calls api.trade with sell side on SELL click", async () => {
    vi.mocked(api.trade).mockResolvedValue({
      id: "t2",
      ticker: "AAPL",
      side: "sell",
      quantity: 5,
      price: 155.0,
      executed_at: "2026-01-01T00:00:00Z",
    });

    render(<TradeBar onTradeExecuted={onTradeExecuted} />);
    fireEvent.change(screen.getByPlaceholderText("Ticker"), {
      target: { value: "AAPL" },
    });
    fireEvent.change(screen.getByPlaceholderText("Qty"), {
      target: { value: "5" },
    });
    fireEvent.click(screen.getByText("SELL"));

    await waitFor(() => {
      expect(api.trade).toHaveBeenCalledWith({
        ticker: "AAPL",
        quantity: 5,
        side: "sell",
      });
    });
    expect(onTradeExecuted).toHaveBeenCalled();
  });

  it("shows success status after trade", async () => {
    vi.mocked(api.trade).mockResolvedValue({
      id: "t3",
      ticker: "AAPL",
      side: "buy",
      quantity: 10,
      price: 150.0,
      executed_at: "2026-01-01T00:00:00Z",
    });

    render(<TradeBar onTradeExecuted={onTradeExecuted} />);
    fireEvent.change(screen.getByPlaceholderText("Ticker"), {
      target: { value: "AAPL" },
    });
    fireEvent.change(screen.getByPlaceholderText("Qty"), {
      target: { value: "10" },
    });
    fireEvent.click(screen.getByText("BUY"));

    await waitFor(() => {
      expect(screen.getByText("BUY 10 AAPL @ $150.00")).toBeInTheDocument();
    });
  });

  it("clears inputs after successful trade", async () => {
    vi.mocked(api.trade).mockResolvedValue({
      id: "t4",
      ticker: "AAPL",
      side: "buy",
      quantity: 10,
      price: 150.0,
      executed_at: "2026-01-01T00:00:00Z",
    });

    render(<TradeBar onTradeExecuted={onTradeExecuted} />);
    const tickerInput = screen.getByPlaceholderText("Ticker");
    const qtyInput = screen.getByPlaceholderText("Qty");
    fireEvent.change(tickerInput, { target: { value: "AAPL" } });
    fireEvent.change(qtyInput, { target: { value: "10" } });
    fireEvent.click(screen.getByText("BUY"));

    await waitFor(() => {
      expect(tickerInput).toHaveValue("");
      expect(qtyInput).toHaveValue(null);
    });
  });

  it("shows error on API failure", async () => {
    vi.mocked(api.trade).mockRejectedValue(
      new Error("API 400: Insufficient cash")
    );

    render(<TradeBar onTradeExecuted={onTradeExecuted} />);
    fireEvent.change(screen.getByPlaceholderText("Ticker"), {
      target: { value: "AAPL" },
    });
    fireEvent.change(screen.getByPlaceholderText("Qty"), {
      target: { value: "10" },
    });
    fireEvent.click(screen.getByText("BUY"));

    await waitFor(() => {
      expect(
        screen.getByText("Error: API 400: Insufficient cash")
      ).toBeInTheDocument();
    });
    expect(onTradeExecuted).not.toHaveBeenCalled();
  });

  it("does not call api.trade with empty ticker", async () => {
    render(<TradeBar onTradeExecuted={onTradeExecuted} />);
    fireEvent.change(screen.getByPlaceholderText("Qty"), {
      target: { value: "10" },
    });
    fireEvent.click(screen.getByText("BUY"));

    // Give a tick for any async to settle
    await new Promise((r) => setTimeout(r, 50));
    expect(api.trade).not.toHaveBeenCalled();
  });

  it("does not call api.trade with zero quantity", async () => {
    render(<TradeBar onTradeExecuted={onTradeExecuted} />);
    fireEvent.change(screen.getByPlaceholderText("Ticker"), {
      target: { value: "AAPL" },
    });
    fireEvent.change(screen.getByPlaceholderText("Qty"), {
      target: { value: "0" },
    });
    fireEvent.click(screen.getByText("BUY"));

    await new Promise((r) => setTimeout(r, 50));
    expect(api.trade).not.toHaveBeenCalled();
  });

  it("does not call api.trade with invalid quantity", async () => {
    render(<TradeBar onTradeExecuted={onTradeExecuted} />);
    fireEvent.change(screen.getByPlaceholderText("Ticker"), {
      target: { value: "AAPL" },
    });
    fireEvent.change(screen.getByPlaceholderText("Qty"), {
      target: { value: "abc" },
    });
    fireEvent.click(screen.getByText("SELL"));

    await new Promise((r) => setTimeout(r, 50));
    expect(api.trade).not.toHaveBeenCalled();
  });

  it("uppercases ticker before sending", async () => {
    vi.mocked(api.trade).mockResolvedValue({
      id: "t5",
      ticker: "GOOGL",
      side: "buy",
      quantity: 1,
      price: 175.0,
      executed_at: "2026-01-01T00:00:00Z",
    });

    render(<TradeBar onTradeExecuted={onTradeExecuted} />);
    fireEvent.change(screen.getByPlaceholderText("Ticker"), {
      target: { value: "  googl  " },
    });
    fireEvent.change(screen.getByPlaceholderText("Qty"), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByText("BUY"));

    await waitFor(() => {
      expect(api.trade).toHaveBeenCalledWith({
        ticker: "GOOGL",
        quantity: 1,
        side: "buy",
      });
    });
  });
});
