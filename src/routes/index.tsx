import { Link, createFileRoute } from "@tanstack/react-router";
import { ChangeText } from "@/components/change-text";
import { StarButton } from "@/components/star-button";
import { compact, money, quoteStamp, signedMoney } from "@/lib/format";
import { getDesk } from "@/lib/market.functions";
import type { Quote } from "@/lib/types";
import { INDEX_LABEL } from "@/lib/universe";

export const Route = createFileRoute("/")({
  loader: () => getDesk(),
  staleTime: 30_000,
  pendingComponent: Pending,
  component: DeskPage,
});

function Pending() {
  return <p className="py-16 text-sm text-mute">Pulling the tape…</p>;
}

function DeskPage() {
  const data = Route.useLoaderData();
  const breadth = data.breadth;
  const upWidth = breadth.total ? (breadth.up / breadth.total) * 100 : 0;
  const flatWidth = breadth.total ? (breadth.flat / breadth.total) * 100 : 0;
  const downWidth = breadth.total ? (breadth.down / breadth.total) * 100 : 0;

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="text-xs tracking-wide text-brass uppercase">Desk</p>
        <h1 className="mt-2 max-w-3xl font-serif text-3xl leading-tight md:text-4xl">{data.lede}</h1>
        <p className="mt-3 text-sm text-mute">
          {data.count} names in the database
          {data.asOf ? ` · quotes as of ${quoteStamp(data.asOf)} ET` : ""}.
        </p>
      </header>

      {data.quoteError ? (
        <p className="rounded-xl border border-line bg-panel px-4 py-3 text-sm text-paper">{data.quoteError}</p>
      ) : null}

      <section className="min-w-0">
        <div className="flex gap-3 overflow-x-auto pb-1">
          {data.indices.map((row) => (
            <Link
              key={row.symbol}
              to="/s/$symbol"
              params={{ symbol: row.symbol }}
              className="min-w-40 shrink-0 rounded-xl border border-line bg-panel px-4 py-3"
            >
              <div className="text-xs text-mute">{INDEX_LABEL[row.symbol] ?? row.name}</div>
              <div className="mt-2 font-serif text-2xl tabular-nums">{money(row.price)}</div>
              <div className="mt-1 flex items-baseline gap-2 text-sm">
                <ChangeText value={row.changePct} />
                <span className="tabular-nums text-mute">{signedMoney(row.change)}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-serif text-2xl">Breadth</h2>
          <p className="text-sm text-mute">
            {breadth.up} higher · {breadth.down} lower
            {breadth.flat ? ` · ${breadth.flat} flat` : ""}
          </p>
        </div>
        <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-panel-2">
          <div className="bg-up" style={{ width: `${upWidth}%` }} />
          <div className="bg-mute/40" style={{ width: `${flatWidth}%` }} />
          <div className="bg-down" style={{ width: `${downWidth}%` }} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {data.sectors.map((sector) => (
            <div key={sector.sector} className="rounded-xl border border-line bg-panel px-3 py-3">
              <div className="text-xs text-mute">
                {sector.count} {sector.count === 1 ? "name" : "names"}
              </div>
              <div className="mt-1 text-sm">{sector.sector}</div>
              <ChangeText value={sector.avgChange} className="mt-1 block text-sm" />
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-8 md:grid-cols-2">
        <MoverList title="Leaders" rows={data.gainers} />
        <MoverList title="Laggards" rows={data.losers} />
      </section>

      <section>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-serif text-2xl">Watchlist</h2>
          <Link to="/database" className="text-sm text-brass">
            Open database
          </Link>
        </div>
        {data.watchlist.length ? (
          <ul className="mt-2">
            {data.watchlist.map((row) => (
              <li key={row.symbol} className="flex items-center border-b border-line">
                <Link to="/s/$symbol" params={{ symbol: row.symbol }} className="flex min-w-0 flex-1 items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{row.symbol}</div>
                    <div className="truncate text-sm text-mute">{row.name}</div>
                  </div>
                  <div className="text-right">
                    <div className="tabular-nums">{money(row.price)}</div>
                    <ChangeText value={row.changePct} className="text-sm" />
                  </div>
                </Link>
                <StarButton symbol={row.symbol} watched={row.watched} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-mute">
            Nothing starred yet. Open the database and star a name — it stays on this desk.
          </p>
        )}
      </section>

      <p className="text-xs leading-relaxed text-mute">
        Prices come from Yahoo Finance and are cached in the research database. They are delayed, and nothing here
        is a recommendation to buy or sell.
      </p>
    </div>
  );
}

function MoverList({ title, rows }: { title: string; rows: Quote[] }) {
  return (
    <div>
      <h2 className="font-serif text-2xl">{title}</h2>
      {rows.length ? (
        <ul className="mt-2">
          {rows.map((row) => (
            <li key={row.symbol} className="border-b border-line">
              <Link to="/s/$symbol" params={{ symbol: row.symbol }} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium">{row.symbol}</span>
                    <span className="truncate text-sm text-mute">{row.name}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-mute">{compact(row.marketCap)}</div>
                </div>
                <div className="text-right">
                  <div className="tabular-nums">{money(row.price)}</div>
                  <ChangeText value={row.changePct} className="text-sm" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-mute">No priced names yet.</p>
      )}
    </div>
  );
}
