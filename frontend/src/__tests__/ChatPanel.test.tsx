import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ChatPanel from "@/components/ChatPanel";

// Mock the api module
vi.mock("@/lib/api", () => ({
  api: {
    chat: vi.fn(),
  },
  apiFetch: vi.fn(),
}));

import { api } from "@/lib/api";

describe("ChatPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state message", () => {
    render(<ChatPanel />);
    expect(
      screen.getByText("Ask about stocks, trade, or manage your watchlist.")
    ).toBeInTheDocument();
  });

  it("renders input and send button", () => {
    render(<ChatPanel />);
    expect(screen.getByPlaceholderText("Message...")).toBeInTheDocument();
    expect(screen.getByText("Send")).toBeInTheDocument();
  });

  it("send button is disabled when input is empty", () => {
    render(<ChatPanel />);
    const btn = screen.getByText("Send");
    expect(btn).toBeDisabled();
  });

  it("shows user message on send", async () => {
    vi.mocked(api.chat).mockResolvedValue({
      message: "Mock response",
    });

    render(<ChatPanel />);
    const input = screen.getByPlaceholderText("Message...");
    fireEvent.change(input, { target: { value: "Buy AAPL" } });
    fireEvent.click(screen.getByText("Send"));

    expect(screen.getByText("Buy AAPL")).toBeInTheDocument();
  });

  it("shows assistant response after send", async () => {
    vi.mocked(api.chat).mockResolvedValue({
      message: "Bought 10 shares of AAPL",
      trades: [{ ticker: "AAPL", side: "buy", quantity: 10 }],
    });

    render(<ChatPanel />);
    const input = screen.getByPlaceholderText("Message...");
    fireEvent.change(input, { target: { value: "Buy AAPL" } });
    fireEvent.click(screen.getByText("Send"));

    await waitFor(() => {
      expect(screen.getByText("Bought 10 shares of AAPL")).toBeInTheDocument();
    });

    expect(screen.getByText("Bought 10 AAPL")).toBeInTheDocument();
  });

  it("shows error on API failure", async () => {
    vi.mocked(api.chat).mockRejectedValue(new Error("fail"));

    render(<ChatPanel />);
    const input = screen.getByPlaceholderText("Message...");
    fireEvent.change(input, { target: { value: "test" } });
    fireEvent.click(screen.getByText("Send"));

    await waitFor(() => {
      expect(
        screen.getByText("Error: failed to get response.")
      ).toBeInTheDocument();
    });
  });

  it("collapses and expands", () => {
    render(<ChatPanel />);
    // Click collapse button
    const collapseBtn = screen.getByLabelText("Collapse chat");
    fireEvent.click(collapseBtn);
    // Now should show expand button
    expect(screen.getByLabelText("Expand chat")).toBeInTheDocument();
    // Click expand
    fireEvent.click(screen.getByLabelText("Expand chat"));
    // Should be back to full panel
    expect(screen.getByText("AI Chat")).toBeInTheDocument();
  });

  it("shows loading dots while waiting for response", async () => {
    let resolveChat: (value: { message: string }) => void;
    vi.mocked(api.chat).mockImplementation(
      () => new Promise((resolve) => { resolveChat = resolve; })
    );

    render(<ChatPanel />);
    const input = screen.getByPlaceholderText("Message...");
    fireEvent.change(input, { target: { value: "test" } });
    fireEvent.click(screen.getByText("Send"));

    // Input should be disabled during loading
    expect(screen.getByPlaceholderText("Message...")).toBeDisabled();

    // Resolve the promise
    resolveChat!({ message: "done" });

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Message...")).not.toBeDisabled();
    });
  });

  it("calls onDataRefresh after trades", async () => {
    const onDataRefresh = vi.fn();
    vi.mocked(api.chat).mockResolvedValue({
      message: "Bought 10 shares of AAPL",
      trades: [{ ticker: "AAPL", side: "buy", quantity: 10 }],
    });

    render(<ChatPanel onDataRefresh={onDataRefresh} />);
    const input = screen.getByPlaceholderText("Message...");
    fireEvent.change(input, { target: { value: "Buy AAPL" } });
    fireEvent.click(screen.getByText("Send"));

    await waitFor(() => {
      expect(onDataRefresh).toHaveBeenCalledTimes(1);
    });
  });

  it("calls onDataRefresh after watchlist changes", async () => {
    const onDataRefresh = vi.fn();
    vi.mocked(api.chat).mockResolvedValue({
      message: "Added TSLA to watchlist.",
      watchlist_changes: [{ ticker: "TSLA", action: "add" }],
    });

    render(<ChatPanel onDataRefresh={onDataRefresh} />);
    const input = screen.getByPlaceholderText("Message...");
    fireEvent.change(input, { target: { value: "Add TSLA" } });
    fireEvent.click(screen.getByText("Send"));

    await waitFor(() => {
      expect(onDataRefresh).toHaveBeenCalledTimes(1);
    });
  });

  it("does not call onDataRefresh for plain messages", async () => {
    const onDataRefresh = vi.fn();
    vi.mocked(api.chat).mockResolvedValue({
      message: "Hello! How can I help?",
    });

    render(<ChatPanel onDataRefresh={onDataRefresh} />);
    const input = screen.getByPlaceholderText("Message...");
    fireEvent.change(input, { target: { value: "hello" } });
    fireEvent.click(screen.getByText("Send"));

    await waitFor(() => {
      expect(screen.getByText("Hello! How can I help?")).toBeInTheDocument();
    });
    expect(onDataRefresh).not.toHaveBeenCalled();
  });

  it("shows watchlist change badges", async () => {
    vi.mocked(api.chat).mockResolvedValue({
      message: "Done, added it.",
      watchlist_changes: [{ ticker: "TSLA", action: "add" }],
    });

    render(<ChatPanel />);
    const input = screen.getByPlaceholderText("Message...");
    fireEvent.change(input, { target: { value: "Add TSLA" } });
    fireEvent.click(screen.getByText("Send"));

    await waitFor(() => {
      expect(screen.getByText("Added TSLA to watchlist")).toBeInTheDocument();
    });
  });
});
