import { useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ChangeText } from "@/components/change-text";
import { StarButton } from "@/components/star-button";
import { compact, money, multiple } from "@/lib/format";
import { listSecurities } from "@/lib/market.functions";
import type { Quote } from "@/lib/types";

export const Route = createFileRoute("/database")({
  loader: () => listSecurities(),
  staleTime: 30_000,
  head: () => ({ meta: [{ title: "Database · BASIS" }] }),
  pendingComponent: () => <p className="py-16 text-sm text-mute">Opening the database…</p>,
  component: DatabasePage,
});

type SortKey = "symbol" | "price" | "changePct" | "marketCap" | "trailingPe" | "week52ChangePct" | "volume";
type Scope = "all" | "equity" | "etf" | "watched";

const COLUMNS: { key: SortKey; label: string; align: "left" | "right" }[] = [
  { key: "symbol", label: "Symbol", align: "left" },
  { key: "price", label: "Last", align: "right" },
  { key: "changePct", label: "Change", align: "right" },
  { key: "marketCap", label: "Mkt cap", align: "right" },
  { key: "trailingPe", label: "P/E", align: "right" },
  { key: "week52ChangePct", label: "52w", align: "right" },
  { key: "volume", label: "Volume", align: "right" },
];

function compareValue(row: Quote, key: SortKey): string | number | null {
  if (key === "symbol") return row.symbol;
  return row[key];
}

function DatabasePage() {
  const { rows, coverage, quoteError } = Route.useLoaderData();
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState("All");
  const [scope, setScope] = useState<Scope>("all");
  const [sortKey, setSortKey] = useState<SortKey>("marketCap");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);

  const sectors = useMemo(() => {
    return ["All", ...new Set(rows.map((row) => row.sector))];
  }, [rows]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = rows.filter((row) => {
      if (sector !== "All" && row.sector !== sector) return false;
      if (scope === "equity" && row.kind !== "equity") return false;
      if (scope === "etf" && row.kind !== "etf") return false;
      if (scope === "watched" && !row.watched) return false;
      if (!q) return true;
      return row.symbol.toLowerCase().includes(q) || row.name.toLowerCase().includes(q) || row.industry.toLowerCase().includes(q);
    });
    const sorted = [...filtered].sort((a, b) => {
      const av = compareValue(a, sortKey);
      const bv = compareValue(b, sortKey);
      if (typeof av === "string" || typeof bv === "string") {
        return String(av ?? "").localeCompare(String(bv ?? "")) * sortDir;
      }
      if (av == null && bv == null) return a.symbol.localeCompare(b.symbol);
      if (av == null) return 1;
      if (bv == null) return -1;
      const delta = (av - bv) * sortDir;
      return delta === 0 ? a.symbol.localeCompare(b.symbol) : delta;
    });
    return sorted;
  }, [rows, query, sector, scope, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((dir) => (dir === 1 ? -1 : 1));
    else {
      setSortKey(key);
      setSortDir(key === "symbol" ? 1 : -1);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-xs tracking-wide text-brass uppercase">Database</p>
        <h1 className="mt-2 font-serif text-3xl md:text-4xl">The book</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-mute">
          {rows.length} securities. Daily bars are cached for {coverage.names}{" "}
          {coverage.names === 1 ? "name" : "names"} ({coverage.bars.toLocaleString("en-US")} closes). Two tables:
          listings, with the last quote and your stance, and price bars once a name is opened.
        </p>
      </header>

      {quoteError ? <p className="rounded-xl border border-line bg-panel px-4 py-3 text-sm">{quoteError}</p> : null}

      <div className="flex flex-col gap-3">
        <label className="sr-only" htmlFor="db-filter">
          Filter the database
        </label>
        <input
          id="db-filter"
          className="field"
          placeholder="Filter by name, symbol, or industry"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(
            [
              ["all", "All"],
              ["equity", "Stocks"],
              ["etf", "Funds"],
              ["watched", "Watched"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" className="chip" data-on={scope === id} onClick={() => setScope(id)}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {sectors.map((item) => (
            <button key={item} type="button" className="chip" data-on={sector === item} onClick={() => setSector(item)}>
              {item}
            </button>
          ))}
        </div>
        <p className="text-sm text-mute">
          {visible.length} of {rows.length}
        </p>
      </div>

      <ul className="md:hidden">
        {visible.map((row) => (
          <li key={row.symbol} className="flex items-center border-b border-line">
            <Link to="/s/$symbol" params={{ symbol: row.symbol }} className="min-w-0 flex-1 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium">{row.symbol}</span>
                <span className="tabular-nums">{money(row.price)}</span>
              </div>
              <div className="mt-0.5 flex items-baseline justify-between gap-3">
                <span className="truncate text-sm text-mute">{row.name}</span>
                <ChangeText value={row.changePct} className="text-sm" />
              </div>
              <div className="mt-1 text-xs text-mute">
                {row.sector} · {multiple(row.trailingPe)} · {compact(row.marketCap)}
              </div>
            </Link>
            <StarButton symbol={row.symbol} watched={row.watched} />
          </li>
        ))}
      </ul>

      <div className="hidden max-w-full overflow-x-auto rounded-xl border border-line md:block">
        <table className="w-full min-w-[44rem] border-collapse text-sm">
          <thead className="bg-panel text-left text-mute">
            <tr>
              <th className="px-3 py-3 font-medium"> </th>
              {COLUMNS.map((column) => (
                <th key={column.key} className={`px-3 py-3 font-medium ${column.align === "right" ? "text-right" : ""}`}>
                  <button type="button" className="min-h-11" onClick={() => toggleSort(column.key)}>
                    {column.label}
                    {sortKey === column.key ? (sortDir < 0 ? " ↓" : " ↑") : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.symbol} className="border-t border-line">
                <td className="px-1">
                  <StarButton symbol={row.symbol} watched={row.watched} />
                </td>
                <td className="px-3 py-2">
                  <Link to="/s/$symbol" params={{ symbol: row.symbol }} className="font-medium">
                    {row.symbol}
                  </Link>
                  <div className="max-w-56 truncate text-mute">{row.name}</div>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{money(row.price)}</td>
                <td className="px-3 py-2 text-right">
                  <ChangeText value={row.changePct} />
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{compact(row.marketCap)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{multiple(row.trailingPe)}</td>
                <td className="px-3 py-2 text-right">
                  <ChangeText value={row.week52ChangePct} />
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{compact(row.volume)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!visible.length ? <p className="text-sm text-mute">No names match that filter.</p> : null}

      <p className="text-xs leading-relaxed text-mute">
        Watchlist, stance, and notes live in this shared database. There are no accounts, so anyone who opens the desk
        can edit them.
      </p>
    </div>
  );
}
