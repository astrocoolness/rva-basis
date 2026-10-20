import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Bar } from "@/lib/types";
import { money, shortDate } from "@/lib/format";

const RANGES = [
  { id: "1M", sessions: 21 },
  { id: "3M", sessions: 63 },
  { id: "6M", sessions: 126 },
  { id: "1Y", sessions: 0 },
] as const;

type RangeId = (typeof RANGES)[number]["id"];

function sliceBars(bars: Bar[], sessions: number) {
  const sorted = [...bars].sort((a, b) => a.date.localeCompare(b.date));
  if (!sessions || sessions >= sorted.length) return sorted;
  return sorted.slice(-sessions);
}

function axisTick(value: number) {
  if (!Number.isFinite(value)) return "";
  if (Math.abs(value) >= 1000) return value.toFixed(0);
  if (Math.abs(value) >= 100) return value.toFixed(0);
  return value.toFixed(1);
}

export function QuoteChart({ bars }: { bars: Bar[] }) {
  const [range, setRange] = useState<RangeId>("6M");
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const data = useMemo(() => {
    const sessions = RANGES.find((item) => item.id === range)?.sessions ?? 0;
    return sliceBars(bars, sessions);
  }, [bars, range]);

  const up = data.length > 1 && data[data.length - 1].close >= data[0].close;
  const stroke = up ? "var(--color-up)" : "var(--color-down)";

  return (
    <div>
      <div className="mb-3 flex gap-2">
        {RANGES.map((item) => (
          <button
            key={item.id}
            type="button"
            className="chip"
            data-on={range === item.id}
            onClick={() => setRange(item.id)}
          >
            {item.id}
          </button>
        ))}
      </div>
      <div className="h-64 w-full">
        {ready && data.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="basis-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={stroke} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={stroke} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--color-line)" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={shortDate}
                minTickGap={48}
                tick={{ fill: "var(--color-mute)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={["auto", "auto"]}
                tickFormatter={axisTick}
                width={48}
                tick={{ fill: "var(--color-mute)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const close = Number(payload[0].value);
                  return (
                    <div className="rounded-lg border border-line bg-panel px-3 py-2 text-xs">
                      <div className="text-mute">{shortDate(String(label))}</div>
                      <div className="tabular-nums text-paper">{money(close)}</div>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="close"
                stroke={stroke}
                strokeWidth={1.75}
                fill="url(#basis-fill)"
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center text-sm text-mute">
            {bars.length ? "Chart loading." : "No daily bars yet."}
          </div>
        )}
      </div>
    </div>
  );
}

const LINE_COLORS = ["var(--color-brass)", "var(--color-up)", "var(--color-paper)", "var(--color-down)"];

export function CompareChart({
  series,
  range,
}: {
  series: { symbol: string; bars: Bar[] }[];
  range: RangeId;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const sessions = RANGES.find((item) => item.id === range)?.sessions ?? 0;

  const data = useMemo(() => {
    const windows = series.map((item) => {
      const sliced = sliceBars(item.bars, sessions);
      const base = sliced[0]?.close;
      const points = new Map<string, number>();
      if (base) {
        for (const bar of sliced) points.set(bar.date, (bar.close / base) * 100);
      }
      return { symbol: item.symbol, points };
    });
    const dates = [...new Set(windows.flatMap((item) => [...item.points.keys()]))].sort();
    return dates.map((date) => {
      const row: Record<string, string | number | null> = { date };
      for (const item of windows) row[item.symbol] = item.points.get(date) ?? null;
      return row;
    });
  }, [series, sessions]);

  if (!series.length) return null;

  return (
    <div className="h-72 w-full">
      {ready && data.length > 1 ? (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-line)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={shortDate}
              minTickGap={48}
              tick={{ fill: "var(--color-mute)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={["auto", "auto"]}
              width={44}
              tick={{ fill: "var(--color-mute)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="rounded-lg border border-line bg-panel px-3 py-2 text-xs">
                    <div className="mb-1 text-mute">{shortDate(String(label))}</div>
                    {payload.map((item) => (
                      <div key={String(item.dataKey)} className="flex items-center justify-between gap-4 tabular-nums">
                        <span className="text-mute">{String(item.dataKey)}</span>
                        <span className="text-paper">{Number(item.value).toFixed(1)}</span>
                      </div>
                    ))}
                  </div>
                );
              }}
            />
            {series.map((item, index) => (
              <Line
                key={item.symbol}
                type="monotone"
                dataKey={item.symbol}
                stroke={LINE_COLORS[index % LINE_COLORS.length]}
                strokeWidth={1.75}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-full items-center text-sm text-mute">Need two dates of history to plot.</div>
      )}
    </div>
  );
}

export { RANGES };
export type { RangeId };
