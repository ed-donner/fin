interface PanelProps {
  title: string;
  children?: React.ReactNode;
  className?: string;
}

export default function Panel({ title, children, className = "" }: PanelProps) {
  return (
    <div
      className={`rounded border border-border bg-bg-panel p-3 ${className}`}
    >
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">
        {title}
      </h2>
      {children ?? (
        <div className="flex h-full items-center justify-center text-sm text-text-secondary">
          --
        </div>
      )}
    </div>
  );
}
