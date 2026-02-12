import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import Header from "@/components/Header";

describe("Header", () => {
  it("renders portfolio value formatted as currency", () => {
    render(
      <Header totalValue={12345.67} cashBalance={5000} connectionStatus="connected" />
    );
    expect(screen.getByText("$12,345.67")).toBeInTheDocument();
  });

  it("renders cash balance formatted as currency", () => {
    render(
      <Header totalValue={10000} cashBalance={7890.12} connectionStatus="connected" />
    );
    expect(screen.getByText("$7,890.12")).toBeInTheDocument();
  });

  it("shows connection status indicator", () => {
    render(
      <Header totalValue={10000} cashBalance={10000} connectionStatus="disconnected" />
    );
    expect(screen.getByText("disconnected")).toBeInTheDocument();
  });

  it("shows reconnecting status", () => {
    render(
      <Header totalValue={10000} cashBalance={10000} connectionStatus="reconnecting" />
    );
    expect(screen.getByText("reconnecting")).toBeInTheDocument();
  });

  it("renders the app title", () => {
    render(
      <Header totalValue={10000} cashBalance={10000} connectionStatus="connected" />
    );
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("FinAlly");
  });
});
