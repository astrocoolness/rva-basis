import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { Database, LayoutDashboard, RefreshCw, Scale, Search } from "lucide-react";
import { addListing, refreshTape, searchTape } from "@/lib/market.functions";
import type { DirectoryEntry } from "@/lib/types";

const NAV = [
  { to: "/", label: "Desk", icon: LayoutDashboard },
  { to: "/database", label: "Database", icon: Database },
  { to: "/compare", label: "Compare", icon: Scale },
] as const;

function Clock() {
  const [label, setLabel] = useState("ET");
  useEffect(() => {
    const format = () =>
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date());
    setLabel(`${format()} ET`);
    const id = window.setInterval(() => setLabel(`${format()} ET`), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return <span className="tabular-nums text-sm text-mute">{label}</span>;
}

function TapeSearch({ directory }: { directory: DirectoryEntry[] }) {
  const navigate = useNavigate();
  const wrap = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<{ symbol: string; name: string; inDatabase: boolean }[]>([]);
  const [searching, setSearching] = useState(false);
  const [note, setNote] = useState("");

  const local = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return directory
      .filter((row) => row.symbol.toLowerCase().includes(q) || row.name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [directory, query]);

  useEffect(() => {
    function onDoc(event: MouseEvent) {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const id = window.setTimeout(() => {
      searchTape({ data: q })
        .then((rows) => {
          const known = new Set(local.map((row) => row.symbol));
          setHits(rows.filter((row) => !known.has(row.symbol)));
          setNote("");
        })
        .catch(() => setNote("Lookup failed."))
        .finally(() => setSearching(false));
    }, 280);
    return () => window.clearTimeout(id);
  }, [query, local]);

  function go(symbol: string) {
    setOpen(false);
    setQuery("");
    void navigate({ to: "/s/$symbol", params: { symbol } });
  }

  async function add(symbol: string) {
    setSearching(true);
    setNote("");
    try {
      const result = await addListing({ data: symbol });
      go(result.symbol);
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Could not add that symbol.");
    } finally {
      setSearching(false);
    }
  }

  return (
    <div ref={wrap} className="relative min-w-0 flex-1">
      <label className="sr-only" htmlFor="tape-search">
        Search the database
      </label>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-mute" />
      <input
        id="tape-search"
        className="field pl-10"
        placeholder="Search names or symbols"
        value={query}
        autoComplete="off"
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
          if (event.key === "Enter" && local[0]) {
            event.preventDefault();
            go(local[0].symbol);
          }
        }}
      />
      {open && query.trim() ? (
        <div className="absolute top-full right-0 left-0 z-40 mt-2 overflow-hidden rounded-xl border border-line bg-panel">
          {local.length ? (
            <ul>
              {local.map((row) => (
                <li key={row.symbol}>
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-baseline gap-3 px-3 text-left"
                    onClick={() => go(row.symbol)}
                  >
                    <span className="font-medium">{row.symbol}</span>
                    <span className="truncate text-sm text-mute">{row.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {hits.length ? (
            <ul className="border-t border-line">
              {hits.map((row) => (
                <li key={row.symbol} className="flex items-center gap-2 px-3">
                  <button
                    type="button"
                    className="flex min-h-11 min-w-0 flex-1 items-baseline gap-3 text-left"
                    onClick={() => (row.inDatabase ? go(row.symbol) : add(row.symbol))}
                  >
                    <span className="font-medium">{row.symbol}</span>
                    <span className="truncate text-sm text-mute">{row.name}</span>
                  </button>
                  {!row.inDatabase ? (
                    <button type="button" className="btn px-3" onClick={() => add(row.symbol)}>
                      Add
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          {!local.length && !hits.length ? (
            <p className="px-3 py-3 text-sm text-mute">{searching ? "Checking the tape…" : "Nothing matches."}</p>
          ) : null}
          {note ? <p className="border-t border-line px-3 py-2 text-sm text-down">{note}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

export function Shell({ directory, children }: { directory: DirectoryEntry[]; children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);

  async function sync() {
    setSyncing(true);
    try {
      await refreshTape();
      await router.invalidate();
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="min-h-dvh bg-ink text-paper">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-line bg-ink px-4 py-6 md:flex">
        <Link to="/" className="px-2">
          <div className="font-serif text-3xl leading-none">BASIS</div>
          <div className="mt-1 text-sm text-mute">Equity desk</div>
        </Link>
        <div className="mt-3 h-0.5 w-8 bg-brass" />
        <nav className="mt-8 flex flex-col gap-1">
          {NAV.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm ${active ? "bg-panel-2 text-paper" : "text-mute"}`}
              >
                <Icon className="size-4" strokeWidth={1.75} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <p className="mt-auto px-2 text-xs leading-relaxed text-mute">
          Quotes are delayed. This is a research desk, not advice.
        </p>
      </aside>

      <div className="min-w-0 md:pl-56">
        <header className="sticky top-0 z-20 border-b border-line bg-ink/95 backdrop-blur-sm">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 md:px-8">
            <Link to="/" className="shrink-0 md:hidden">
              <span className="font-serif text-2xl leading-none">BASIS</span>
            </Link>
            <div className="order-3 w-full min-w-0 md:order-none md:w-auto md:flex-1">
              <TapeSearch directory={directory} />
            </div>
            <div className="ml-auto flex items-center gap-3">
              <Clock />
              <button type="button" className="btn shrink-0 px-3" onClick={() => void sync()} disabled={syncing}>
                <RefreshCw className={`size-4 ${syncing ? "animate-spin" : ""}`} strokeWidth={1.75} />
                <span className="hidden sm:inline">{syncing ? "Syncing" : "Sync"}</span>
              </button>
            </div>
          </div>
        </header>
        <main className="mx-auto min-w-0 max-w-6xl px-4 pt-5 pb-28 md:px-8 md:pb-12">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ink/95 backdrop-blur-sm md:hidden">
        <div className="grid grid-cols-3 px-2 pt-1 pb-[max(0.4rem,env(safe-area-inset-bottom))]">
          {NAV.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex min-h-12 flex-col items-center justify-center gap-1 text-xs ${active ? "text-brass" : "text-mute"}`}
              >
                <Icon className="size-4" strokeWidth={1.75} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
