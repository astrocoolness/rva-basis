import { pct, toneClass } from "@/lib/format";

export function ChangeText({
  value,
  className = "",
}: {
  value: number | null | undefined;
  className?: string;
}) {
  return <span className={`tabular-nums ${toneClass(value)} ${className}`}>{pct(value)}</span>;
}
