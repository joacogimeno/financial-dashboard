interface Entry {
  name?: string;
  value?: number | null;
  color?: string;
}

interface Props {
  active?: boolean;
  payload?: Entry[];
  label?: string | number;
  formatter?: (value: number, name: string) => string;
}

export default function ChartTooltip({ active, payload, label, formatter }: Props) {
  if (!active || !payload?.length) return null;
  const visible = payload.filter((p) => p.value != null);
  if (!visible.length) return null;
  return (
    <div style={{
      background: "#1e293b",
      border: "1px solid #475569",
      borderRadius: 8,
      padding: "10px 14px",
      fontSize: 13,
      boxShadow: "0 8px 24px rgba(2,6,23,0.4)",
    }}>
      {label != null && (
        <div style={{ color: "#94a3b8", fontWeight: 600, marginBottom: 6, fontSize: 12 }}>{label}</div>
      )}
      {visible.map((entry, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 24, padding: "2px 0" }}>
          <span style={{ color: entry.color ?? "#94a3b8" }}>{entry.name}</span>
          <span style={{ color: entry.color ?? "#e2e8f0", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
            {formatter && entry.value != null
              ? formatter(entry.value, entry.name ?? "")
              : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}
