"use client";

export type ConnectionStatus = "connected" | "reconnecting" | "disconnected";

interface HeaderProps {
  totalValue: number;
  cashBalance: number;
  connectionStatus: ConnectionStatus;
}

const statusColors: Record<ConnectionStatus, string> = {
  connected: "bg-green",
  reconnecting: "bg-accent-yellow",
  disconnected: "bg-red",
};

export default function Header({
  totalValue,
  cashBalance,
  connectionStatus,
}: HeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-border bg-bg-secondary px-4 py-2">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-bold text-accent-yellow">FinAlly</h1>
      </div>
      <div className="flex items-center gap-6 text-sm">
        <div>
          <span className="text-text-secondary">Portfolio </span>
          <span className="font-bold text-accent-blue">
            ${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div>
          <span className="text-text-secondary">Cash </span>
          <span className="font-bold">
            ${cashBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className={`h-2.5 w-2.5 rounded-full ${statusColors[connectionStatus]}`}
          />
          <span className="text-text-secondary text-xs">{connectionStatus}</span>
        </div>
      </div>
    </header>
  );
}
