import { useMemo, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChangeText } from "@/components/change-text";
import { CompareChart, RANGES, type RangeId } from "@/components/quote-chart";
import { compact, money, multiple } from "@/lib/format";
import { getCompare } from "@/lib/market.functions";

type CompareSearch = { symbols: string[] };

function readSymbols(raw: unknown): string[] {
  let parts: string[] = [];
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (Array.isArray(parsed)) parts = parsed.map(String);
        else parts = trimmed.split(",");
      } catch {
        parts = trimmed.split(",");
      }
    } else {
      parts = trimmed.split(/[,\s]+/);
    }
  } else if (Array.isArray(raw)) {
    parts = raw.flatMap((item) => (typeof item === "string" ? item.split(",") : []));
  }
  return [
    ...new Set(
      parts
        .map((symbol) => symbol.trim().toUpperCase())
        .filter((symbol) => /^[A-Z0-9.^=-]{1,12}$/.test(symbol)),
    ),
  ].slice(0, 4);
}

export const Route = createFileRoute("/compare")({
  validateSearch: (search: Record<string, unknown>): CompareSearch => {
    return { symbols: readSymbols(search.symbols) };
  },
  loaderDeps: ({ search }) => ({ symbols: search.symbols }),
  loader: ({ deps }) => getCompare({ data: deps.symbols }),
  staleTime: 30_000,
  head: () => ({ meta: [{ title: "Compare · BASIS" }] }),
  pendingComponent: () => <p className="py-16 text-sm text-mute">Lining up the names…</p>,
  component: ComparePage,
});

const LINE = ["bg-brass", "bg-up", "bg-paper", "bg-down"];

function ComparePage() {
  const data = Route.useLoaderData();
  const { symbols } = Route.useSearch();
  const navigate = useNavigate({ from: "/compare" });
  const [query, setQuery] = useState("");
  const [range, setRange] = useState<RangeId>("6M");

  const picks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.choices
      .filter((row) => !symbols.includes(row.symbol))
      .filter((row) => !q || row.symbol.toLowerCase().includes(q) || row.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [data.choices, query, symbols]);

  function setSymbols(next: string[]) {
    void navigate({
      search: { symbols: next.slice(0, 4) },
      replace: true,
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-xs tracking-wide text-brass uppercase">Compare</p>
        <h1 className="mt-2 font-serif text-3xl md:text-4xl">Same window, rebased to 100</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-mute">
          Pick up to four names already in the database. Each line starts at 100 on the first session of the window,
          so you are looking at relative performance, not price.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {symbols.map((symbol) => (
          <button key={symbol} type="button" className="chip" data-on="true" onClick={() => setSymbols(symbols.filter((item) => item !== symbol))}>
            {symbol} · remove
          </button>
        ))}
        {symbols.length < 4 ? (
          <span className="self-center text-sm text-mute">{4 - symbols.length} slots left</span>
        ) : (
          <span className="self-center text-sm text-mute">Four is the limit.</span>
        )}
      </div>

      {symbols.length < 4 ? (
        <div>
          <label className="sr-only" htmlFor="compare-find">
            Find a name to compare
          </label>
          <input
            id="compare-find"
            className="field"
            placeholder="Add a name from the database"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <ul className="mt-2">
            {picks.map((row) => (
              <li key={row.symbol} className="border-b border-line">
                <button
                  type="button"
                  className="flex min-h-11 w-full items-center gap-3 py-2 text-left"
                  onClick={() => {
                    setSymbols([...symbols, row.symbol]);
                    setQuery("");
                  }}
                >
                  <span className="w-16 font-medium">{row.symbol}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-mute">{row.name}</span>
                  <span className="tabular-nums text-sm">{money(row.price)}</span>
                  <ChangeText value={row.changePct} className="text-sm" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {data.missing.length ? (
        <p className="text-sm text-mute">Not in the database: {data.missing.join(", ")}. Add them from search first.</p>
      ) : null}

      {symbols.length < 2 ? (
        <p className="rounded-xl border border-line bg-panel px-4 py-4 text-sm text-mute">
          Add a second name to plot the pair. Suggestions:{" "}
          {["AAPL", "MSFT", "NVDA", "SPY"]
            .filter((symbol) => !symbols.includes(symbol))
            .slice(0, 3)
            .map((symbol, index, list) => (
              <span key={symbol}>
                <button type="button" className="text-brass" onClick={() => setSymbols([...symbols, symbol])}>
                  {symbol}
                </button>
                {index < list.length - 1 ? ", " : ""}
              </span>
            ))}
          .
        </p>
      ) : (
        <section className="rounded-xl border border-line bg-panel p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-3">
              {data.series.map((item, index) => (
                <span key={item.symbol} className="inline-flex items-center gap-2 text-sm">
                  <span className={`size-2 rounded-full ${LINE[index % LINE.length]}`} />
                  {item.symbol}
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              {RANGES.map((item) => (
                <button key={item.id} type="button" className="chip" data-on={range === item.id} onClick={() => setRange(item.id)}>
                  {item.id}
                </button>
              ))}
            </div>
          </div>
          <CompareChart series={data.series} range={range} />
        </section>
      )}

      {data.quotes.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {data.quotes.map((quote) => (
            <Link key={quote.symbol} to="/s/$symbol" params={{ symbol: quote.symbol }} className="rounded-xl border border-line bg-panel p-4">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium">{quote.symbol}</span>
                <ChangeText value={quote.changePct} />
              </div>
              <div className="mt-1 truncate text-sm text-mute">{quote.name}</div>
              <div className="mt-3 font-serif text-3xl tabular-nums">{money(quote.price)}</div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-mute">Market cap</dt>
                  <dd className="tabular-nums">{compact(quote.marketCap)}</dd>
                </div>
                <div>
                  <dt className="text-mute">Trailing P/E</dt>
                  <dd className="tabular-nums">{multiple(quote.trailingPe)}</dd>
                </div>
                <div>
                  <dt className="text-mute">52-week change</dt>
                  <dd>
                    <ChangeText value={quote.week52ChangePct} />
                  </dd>
                </div>
                <div>
                  <dt className="text-mute">Sector</dt>
                  <dd>{quote.sector}</dd>
                </div>
              </dl>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
