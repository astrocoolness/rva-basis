import { useEffect, useRef, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { QuoteChart } from "@/components/quote-chart";
import { ChangeText } from "@/components/change-text";
import { StarButton } from "@/components/star-button";
import { compact, money, multiple, pct, quoteStamp, signedMoney } from "@/lib/format";
import { dropListing, getSymbol, setResearch } from "@/lib/market.functions";
import type { Quote, Stance } from "@/lib/types";

export const Route = createFileRoute("/s/$symbol")({
  loader: ({ params }) => getSymbol({ data: params.symbol }),
  staleTime: 30_000,
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData?.ok ? `${loaderData.quote.symbol} · BASIS` : "BASIS" }],
  }),
  pendingComponent: () => <p className="py-16 text-sm text-mute">Opening the name…</p>,
  component: SymbolPage,
});

const STANCES: { id: Stance; label: string }[] = [
  { id: "bullish", label: "Bullish" },
  { id: "neutral", label: "Neutral" },
  { id: "bearish", label: "Bearish" },
  { id: "unrated", label: "Unrated" },
];

const TREND_LABEL = {
  uptrend: "Uptrend",
  downtrend: "Downtrend",
  mixed: "Mixed",
  unknown: "Unclear",
} as const;

function SymbolPage() {
  const data = Route.useLoaderData();
  if (!data.ok) {
    return (
      <div className="py-10">
        <h1 className="font-serif text-3xl">{data.symbol}</h1>
        <p className="mt-3 text-sm text-mute">{data.message}</p>
        <Link to="/database" className="mt-6 inline-flex min-h-11 items-center text-sm text-brass">
          Back to the database
        </Link>
      </div>
    );
  }

  const { quote, bars, read } = data;
  const returns = [
    ["1W", read.ret5],
    ["1M", read.ret21],
    ["3M", read.ret63],
    ["6M", read.ret126],
    ["1Y", read.ret252],
  ] as const;

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="text-xs tracking-wide text-brass uppercase">
          {quote.exchange || quote.sector} · {quote.kind === "etf" ? "Fund" : quote.sector}
        </p>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-serif text-4xl leading-none">{quote.symbol}</h1>
            <p className="mt-2 text-sm text-mute">{quote.name}</p>
          </div>
          <StarButton symbol={quote.symbol} watched={quote.watched} />
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-x-4 gap-y-1">
          <div className="font-serif text-5xl tabular-nums">{money(quote.price)}</div>
          <div className="pb-1">
            <ChangeText value={quote.changePct} className="text-lg" />
            <span className="ml-2 tabular-nums text-mute">{signedMoney(quote.change)}</span>
          </div>
        </div>
        <p className="mt-2 text-xs text-mute">
          {quote.industry}
          {quote.quoteAt ? ` · ${quoteStamp(quote.quoteAt)} ET` : ""}
        </p>
      </header>

      <section className="rounded-xl border border-line bg-panel p-4">
        <QuoteChart bars={bars} />
      </section>

      <section>
        <h2 className="font-serif text-2xl">Window</h2>
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {returns.map(([label, value]) => (
            <div key={label} className="rounded-xl border border-line bg-panel px-2 py-3 text-center">
              <div className="text-xs text-mute">{label}</div>
              <ChangeText value={value} className="mt-1 block text-sm" />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-line bg-panel p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-serif text-2xl">Tape read</h2>
          <span className="text-sm text-brass">{TREND_LABEL[read.trend]}</span>
        </div>
        <ul className="mt-3 flex flex-col gap-2 text-sm leading-relaxed">
          {read.bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
        {read.rsi14 != null ? (
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-xs text-mute">
              <span>RSI 14</span>
              <span className="tabular-nums text-paper">{read.rsi14.toFixed(0)}</span>
            </div>
            <div className="relative h-1.5 rounded-full bg-panel-2">
              <span
                className="absolute top-1/2 size-2.5 -translate-y-1/2 rounded-full bg-brass"
                style={{ left: `calc(${Math.min(100, Math.max(0, read.rsi14))}% - 5px)` }}
              />
            </div>
          </div>
        ) : null}
        <p className="mt-4 text-xs text-mute">A description of the tape in this database. Not a recommendation.</p>
      </section>

      <section>
        <h2 className="font-serif text-2xl">Statistics</h2>
        <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-4">
          <Stat label="Open" value={money(quote.open)} />
          <Stat label="Day high" value={money(quote.dayHigh)} />
          <Stat label="Day low" value={money(quote.dayLow)} />
          <Stat label="Prev close" value={money(quote.prevClose)} />
          <Stat label="Volume" value={compact(quote.volume)} />
          <Stat label="Avg volume" value={compact(quote.avgVolume)} />
          <Stat label="Market cap" value={compact(quote.marketCap)} />
          <Stat label="From high" value={pct(read.vsHigh)} />
          <Stat label="Trailing P/E" value={multiple(quote.trailingPe)} />
          <Stat label="Forward P/E" value={multiple(quote.forwardPe)} />
          <Stat label="EPS" value={money(quote.eps)} />
          <Stat label="Yield" value={quote.dividendYield == null ? "—" : `${quote.dividendYield.toFixed(2)}%`} />
          <Stat label="Price / book" value={multiple(quote.priceToBook)} />
          <Stat label="50-day" value={money(read.sma50)} />
          <Stat label="200-day" value={money(read.sma200)} />
          <Stat label="52-week range" value={`${money(quote.week52Low)} – ${money(quote.week52High)}`} />
        </div>
        {read.universeMedianPe != null && quote.kind === "equity" ? (
          <p className="mt-3 text-sm text-mute">
            Database median trailing P/E is {multiple(read.universeMedianPe)}
            {read.sectorMedianPe != null ? `, ${quote.sector} median ${multiple(read.sectorMedianPe)}` : ""}.
          </p>
        ) : null}
      </section>

      <Research quote={quote} />

      <div className="flex flex-wrap items-center gap-4">
        <Link to="/compare" search={{ symbols: [quote.symbol] }} className="text-sm text-brass">
          Compare {quote.symbol}
        </Link>
        {!quote.seeded ? <RemoveButton symbol={quote.symbol} /> : null}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-panel px-3 py-3">
      <div className="text-xs text-mute">{label}</div>
      <div className="mt-1 text-sm tabular-nums">{value}</div>
    </div>
  );
}

function Research({ quote }: { quote: Quote }) {
  const [stance, setStance] = useState<Stance>(quote.stance);
  const [thesis, setThesis] = useState(quote.thesis);
  const [status, setStatus] = useState("");
  const timer = useRef<number | null>(null);

  useEffect(() => {
    setStance(quote.stance);
    setThesis(quote.thesis);
    setStatus("");
  }, [quote.symbol]);

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  function save(nextStance: Stance, nextThesis: string) {
    if (timer.current) window.clearTimeout(timer.current);
    setStatus("Saving");
    timer.current = window.setTimeout(() => {
      setResearch({ data: { symbol: quote.symbol, stance: nextStance, thesis: nextThesis } })
        .then(() => setStatus("Saved to the database"))
        .catch(() => setStatus("Not saved"));
    }, 450);
  }

  return (
    <section>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-serif text-2xl">Notes</h2>
        <span className="text-xs text-mute" aria-live="polite">
          {status}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {STANCES.map((item) => (
          <button
            key={item.id}
            type="button"
            className="chip"
            data-on={stance === item.id}
            onClick={() => {
              setStance(item.id);
              save(item.id, thesis);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      <label className="sr-only" htmlFor="thesis">
        Research note
      </label>
      <textarea
        id="thesis"
        className="field mt-3 min-h-36 resize-y"
        maxLength={2000}
        placeholder="What would have to be true, and what would change your mind?"
        value={thesis}
        onChange={(event) => {
          const next = event.target.value;
          setThesis(next);
          save(stance, next);
        }}
      />
      <p className="mt-2 text-xs text-mute">{thesis.length}/2000 · saved in the shared database</p>
    </section>
  );
}

function RemoveButton({ symbol }: { symbol: string }) {
  const navigate = useNavigate();
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState("");

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        className="btn"
        onClick={() => {
          if (!armed) {
            setArmed(true);
            return;
          }
          dropListing({ data: symbol })
            .then(() => navigate({ to: "/database" }))
            .catch((err: unknown) => {
              setError(err instanceof Error ? err.message : "Could not remove it.");
              setArmed(false);
            });
        }}
      >
        {armed ? "Confirm remove" : "Remove from database"}
      </button>
      {error ? <span className="text-sm text-down">{error}</span> : null}
    </div>
  );
}
