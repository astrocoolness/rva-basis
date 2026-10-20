import { average, buildTapeRead, median } from "@/lib/analytics";
import type { TapeRead } from "@/lib/analytics";
import { getSql, type Sql } from "@/lib/db";
import type { Bar, DeskData, DirectoryEntry, Kind, Quote, SectorStat, Stance } from "@/lib/types";
import { UNIVERSE } from "@/lib/universe";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

type YahooQuote = {
  symbol?: string;
  shortName?: string;
  longName?: string;
  quoteType?: string;
  exchange?: string;
  fullExchangeName?: string;
  regularMarketPrice?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
  regularMarketOpen?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketPreviousClose?: number;
  regularMarketVolume?: number;
  regularMarketTime?: number;
  averageDailyVolume3Month?: number;
  marketCap?: number;
  trailingPE?: number;
  forwardPE?: number;
  epsTrailingTwelveMonths?: number;
  dividendYield?: number;
  priceToBook?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  fiftyTwoWeekChangePercent?: number;
  fiftyDayAverage?: number;
  twoHundredDayAverage?: number;
  marketState?: string;
};

type YahooSession = { cookie: string; crumb: string; at: number };

let queue: Promise<unknown> = Promise.resolve();
let sessionCache: YahooSession | null = null;
let lastForce = 0;
const barsFetchedAt = new Map<string, number>();

function serial<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn, fn);
  queue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function int(value: unknown): number | null {
  const n = num(value);
  return n == null ? null : Math.round(n);
}

function positive(value: unknown): number | null {
  const n = num(value);
  if (n == null || n <= 0) return null;
  return n;
}

function asKind(value: unknown): Kind {
  return value === "etf" ? "etf" : "equity";
}

function asStance(value: unknown): Stance {
  return value === "bullish" || value === "neutral" || value === "bearish" || value === "unrated"
    ? value
    : "unrated";
}

function asBool(value: unknown): boolean {
  return value === true || value === "t" || value === "true" || value === 1;
}

function iso(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function nyDate(ms: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await fn(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

async function yahooSession(): Promise<YahooSession> {
  if (sessionCache && Date.now() - sessionCache.at < 20 * 60 * 1000) return sessionCache;
  const fc = await fetch("https://fc.yahoo.com", {
    headers: { "User-Agent": UA },
    redirect: "manual",
    signal: AbortSignal.timeout(8000),
  });
  const setCookies = typeof fc.headers.getSetCookie === "function" ? fc.headers.getSetCookie() : [];
  const cookie = setCookies
    .map((entry) => entry.split(";")[0])
    .filter(Boolean)
    .join("; ");
  const crumbRes = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
    headers: { "User-Agent": UA, Cookie: cookie },
    signal: AbortSignal.timeout(8000),
  });
  const crumb = (await crumbRes.text()).trim();
  if (!crumbRes.ok || !crumb || crumb.includes(" ") || crumb.length > 40) {
    throw new Error("Quote session unavailable");
  }
  sessionCache = { cookie, crumb, at: Date.now() };
  return sessionCache;
}

async function yahooQuotes(symbols: string[]): Promise<YahooQuote[]> {
  if (!symbols.length) return [];
  const session = await yahooSession();
  const out: YahooQuote[] = [];
  for (let i = 0; i < symbols.length; i += 30) {
    const chunk = symbols.slice(i, i + 30);
    const joined = chunk.map((symbol) => encodeURIComponent(symbol)).join(",");
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${joined}&crumb=${encodeURIComponent(session.crumb)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Cookie: session.cookie },
      signal: AbortSignal.timeout(12000),
    });
    if (res.status === 401 || res.status === 403) {
      sessionCache = null;
      throw new Error("Quote feed refused the request");
    }
    if (!res.ok) throw new Error(`Quote feed failed (${res.status})`);
    const body = (await res.json()) as { quoteResponse?: { result?: YahooQuote[] } };
    out.push(...(body.quoteResponse?.result ?? []));
  }
  return out;
}

async function chartQuote(symbol: string): Promise<YahooQuote | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(12000) });
  if (!res.ok) return null;
  const body = (await res.json()) as {
    chart?: { result?: { meta?: Record<string, unknown> }[] };
  };
  const meta = body.chart?.result?.[0]?.meta;
  if (!meta) return null;
  const price = num(meta.regularMarketPrice);
  if (price == null) return null;
  const prev = num(meta.previousClose) ?? num(meta.chartPreviousClose);
  return {
    symbol: String(meta.symbol ?? symbol),
    shortName: meta.shortName ? String(meta.shortName) : undefined,
    longName: meta.longName ? String(meta.longName) : undefined,
    fullExchangeName: meta.fullExchangeName ? String(meta.fullExchangeName) : undefined,
    regularMarketPrice: price,
    regularMarketPreviousClose: prev ?? undefined,
    regularMarketChange: prev != null ? price - prev : undefined,
    regularMarketChangePercent: prev ? ((price - prev) / prev) * 100 : num(meta.regularMarketChangePercent) ?? undefined,
    regularMarketDayHigh: num(meta.regularMarketDayHigh) ?? undefined,
    regularMarketDayLow: num(meta.regularMarketDayLow) ?? undefined,
    regularMarketVolume: num(meta.regularMarketVolume) ?? undefined,
    regularMarketTime: num(meta.regularMarketTime) ?? undefined,
    fiftyTwoWeekHigh: num(meta.fiftyTwoWeekHigh) ?? undefined,
    fiftyTwoWeekLow: num(meta.fiftyTwoWeekLow) ?? undefined,
  };
}

const SELECT_COLUMNS = `
  symbol, name, sector, industry, exchange, kind, seeded,
  price, change_amt, change_pct, open_px, day_high, day_low, prev_close,
  volume, avg_volume, market_cap, trailing_pe, forward_pe, eps, dividend_yield,
  price_to_book, week52_high, week52_low, week52_change_pct, sma50, sma200,
  market_state, quote_at, watched, stance, thesis
`;

function mapQuote(row: Record<string, unknown>): Quote {
  return {
    symbol: String(row.symbol),
    name: String(row.name),
    sector: String(row.sector),
    industry: String(row.industry),
    exchange: String(row.exchange ?? ""),
    kind: asKind(row.kind),
    seeded: asBool(row.seeded),
    price: num(row.price),
    change: num(row.change_amt),
    changePct: num(row.change_pct),
    open: num(row.open_px),
    dayHigh: num(row.day_high),
    dayLow: num(row.day_low),
    prevClose: num(row.prev_close),
    volume: int(row.volume),
    avgVolume: int(row.avg_volume),
    marketCap: int(row.market_cap),
    trailingPe: positive(row.trailing_pe),
    forwardPe: positive(row.forward_pe),
    eps: num(row.eps),
    dividendYield: num(row.dividend_yield),
    priceToBook: positive(row.price_to_book),
    week52High: num(row.week52_high),
    week52Low: num(row.week52_low),
    week52ChangePct: num(row.week52_change_pct),
    sma50: num(row.sma50),
    sma200: num(row.sma200),
    marketState: row.market_state == null ? null : String(row.market_state),
    quoteAt: iso(row.quote_at),
    watched: asBool(row.watched),
    stance: asStance(row.stance),
    thesis: row.thesis == null ? "" : String(row.thesis),
  };
}

async function fetchAllSafe(sql: Sql): Promise<Quote[]> {
  const rows = await sql.query<Record<string, unknown>>(
    `select ${SELECT_COLUMNS} from securities order by symbol`,
  );
  return rows.map(mapQuote);
}

async function fetchOne(sql: Sql, symbol: string): Promise<Quote | null> {
  const rows = await sql.query<Record<string, unknown>>(
    `select ${SELECT_COLUMNS} from securities where symbol = $1`,
    [symbol],
  );
  return rows[0] ? mapQuote(rows[0]) : null;
}

async function seed(sql: Sql) {
  const params: unknown[] = [];
  const tuples = UNIVERSE.map((row, index) => {
    const offset = index * 7;
    params.push(row.symbol, row.name, row.sector, row.industry, row.exchange, row.kind, true);
    return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7})`;
  });
  await sql.query(
    `insert into securities (symbol, name, sector, industry, exchange, kind, seeded)
     values ${tuples.join(",")}
     on conflict (symbol) do update set
       name = excluded.name,
       sector = excluded.sector,
       industry = excluded.industry,
       kind = excluded.kind,
       seeded = true
     where securities.seeded`,
    params,
  );
}

async function applyQuotes(sql: Sql, quotes: YahooQuote[]) {
  for (const quote of quotes) {
    const symbol = (quote.symbol ?? "").toUpperCase();
    if (!symbol) continue;
    const price = num(quote.regularMarketPrice);
    const prev = num(quote.regularMarketPreviousClose);
    const change =
      num(quote.regularMarketChange) ?? (price != null && prev != null ? price - prev : null);
    const changePct =
      num(quote.regularMarketChangePercent) ??
      (price != null && prev ? ((price - prev) / prev) * 100 : null);
    const quoteAt = quote.regularMarketTime
      ? new Date(quote.regularMarketTime * 1000).toISOString()
      : new Date().toISOString();
    const name = (quote.longName || quote.shortName || "").slice(0, 160);
    const exchange = (quote.fullExchangeName || "").slice(0, 80);
    await sql.query(
      `update securities set
         name = case when seeded then name when $2 <> '' then $2 else name end,
         exchange = case when $3 <> '' then $3 else exchange end,
         price = coalesce($4, price),
         change_amt = coalesce($5, change_amt),
         change_pct = coalesce($6, change_pct),
         open_px = coalesce($7, open_px),
         day_high = coalesce($8, day_high),
         day_low = coalesce($9, day_low),
         prev_close = coalesce($10, prev_close),
         volume = coalesce($11, volume),
         avg_volume = coalesce($12, avg_volume),
         market_cap = coalesce($13, market_cap),
         trailing_pe = coalesce($14, trailing_pe),
         forward_pe = coalesce($15, forward_pe),
         eps = coalesce($16, eps),
         dividend_yield = coalesce($17, dividend_yield),
         price_to_book = coalesce($18, price_to_book),
         week52_high = coalesce($19, week52_high),
         week52_low = coalesce($20, week52_low),
         week52_change_pct = coalesce($21, week52_change_pct),
         sma50 = coalesce($22, sma50),
         sma200 = coalesce($23, sma200),
         market_state = coalesce($24, market_state),
         quote_at = $25::timestamptz,
         updated_at = now()
       where symbol = $1`,
      [
        symbol,
        name,
        exchange,
        price,
        change,
        changePct,
        num(quote.regularMarketOpen),
        num(quote.regularMarketDayHigh),
        num(quote.regularMarketDayLow),
        prev,
        int(quote.regularMarketVolume),
        int(quote.averageDailyVolume3Month),
        int(quote.marketCap),
        positive(quote.trailingPE),
        positive(quote.forwardPE),
        num(quote.epsTrailingTwelveMonths),
        num(quote.dividendYield),
        positive(quote.priceToBook),
        num(quote.fiftyTwoWeekHigh),
        num(quote.fiftyTwoWeekLow),
        num(quote.fiftyTwoWeekChangePercent),
        num(quote.fiftyDayAverage),
        num(quote.twoHundredDayAverage),
        quote.marketState ?? null,
        quoteAt,
      ],
    );
  }
}

async function ensureQuotes(sql: Sql, opts?: { force?: boolean; symbols?: string[] }) {
  let symbols: string[];
  if (opts?.symbols?.length) {
    symbols = opts.symbols.map((symbol) => symbol.toUpperCase());
    if (!opts.force) {
      const rows = await sql.query<{ symbol: string }>(
        `select symbol from securities
         where symbol = any($1::text[])
           and (quote_at is null or quote_at < now() - interval '10 minutes')`,
        [symbols],
      );
      const stale = new Set(rows.map((row) => row.symbol));
      symbols = symbols.filter((symbol) => stale.has(symbol));
    }
  } else if (opts?.force) {
    const rows = await sql<{ symbol: string }>`select symbol from securities order by symbol`;
    symbols = rows.map((row) => row.symbol);
  } else {
    const rows = await sql<{ symbol: string }>`
      select symbol from securities
      where quote_at is null or quote_at < now() - interval '10 minutes'
      order by symbol
    `;
    symbols = rows.map((row) => row.symbol);
  }
  if (!symbols.length) return;

  let quotes: YahooQuote[] = [];
  try {
    quotes = await yahooQuotes(symbols);
  } catch (error) {
    console.error("quote batch failed", error);
    quotes = [];
  }
  if (quotes.length) await applyQuotes(sql, quotes);
  const got = new Set(quotes.map((quote) => (quote.symbol ?? "").toUpperCase()));
  const missing = symbols.filter((symbol) => !got.has(symbol));
  if (!missing.length) return;
  const fallbacks = (await mapPool(missing, 5, chartQuote)).filter((quote): quote is YahooQuote => quote != null);
  if (fallbacks.length) await applyQuotes(sql, fallbacks);
}

async function insertFromYahoo(sql: Sql, symbol: string): Promise<boolean> {
  let quotes: YahooQuote[] = [];
  try {
    quotes = await yahooQuotes([symbol]);
  } catch (error) {
    console.error("single quote failed", error);
    quotes = [];
  }
  let quote = quotes.find((row) => (row.symbol ?? "").toUpperCase() === symbol) ?? quotes[0];
  if (!quote?.regularMarketPrice) {
    quote = (await chartQuote(symbol)) ?? quote;
  }
  if (!quote?.regularMarketPrice && !quote?.longName && !quote?.shortName) return false;
  const name = (quote.longName || quote.shortName || symbol).slice(0, 160);
  const kind: Kind = quote.quoteType === "ETF" ? "etf" : "equity";
  const exchange = (quote.fullExchangeName || quote.exchange || "").slice(0, 80);
  await sql.query(
    `insert into securities (symbol, name, sector, industry, exchange, kind, seeded)
     values ($1, $2, 'Unclassified', $3, $4, $5, false)
     on conflict (symbol) do nothing`,
    [symbol, name, kind === "etf" ? "Fund" : "Unclassified", exchange, kind],
  );
  if (quote.symbol || quote.regularMarketPrice) {
    await applyQuotes(sql, [{ ...quote, symbol }]);
  }
  return true;
}

async function readBars(sql: Sql, symbol: string): Promise<Bar[]> {
  const rows = await sql.query<{ date: string; close: unknown; volume: unknown }>(
    `select bar_date::text as date, close, volume
     from price_bars where symbol = $1 order by bar_date asc`,
    [symbol],
  );
  return rows
    .map((row) => ({
      date: String(row.date).slice(0, 10),
      close: num(row.close) ?? 0,
      volume: int(row.volume) ?? 0,
    }))
    .filter((row) => row.close > 0);
}

async function writeBars(sql: Sql, symbol: string, bars: Bar[]) {
  const chunkSize = 40;
  for (let i = 0; i < bars.length; i += chunkSize) {
    const slice = bars.slice(i, i + chunkSize);
    const params: unknown[] = [];
    const tuples = slice.map((bar, index) => {
      const offset = index * 4;
      params.push(symbol, bar.date, bar.close, bar.volume);
      return `($${offset + 1}, $${offset + 2}::date, $${offset + 3}, $${offset + 4})`;
    });
    await sql.query(
      `insert into price_bars (symbol, bar_date, close, volume)
       values ${tuples.join(",")}
       on conflict (symbol, bar_date) do update
         set close = excluded.close, volume = excluded.volume`,
      params,
    );
  }
}

async function fetchBars(symbol: string): Promise<Bar[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1y`;
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(12000) });
  if (!res.ok) return [];
  const body = (await res.json()) as {
    chart?: {
      result?: {
        timestamp?: number[];
        indicators?: { quote?: { close?: (number | null)[]; volume?: (number | null)[] }[] };
      }[];
    };
  };
  const result = body.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const closes = result?.indicators?.quote?.[0]?.close ?? [];
  const volumes = result?.indicators?.quote?.[0]?.volume ?? [];
  const bars: Bar[] = [];
  for (let i = 0; i < timestamps.length; i += 1) {
    const close = closes[i];
    if (close == null || !Number.isFinite(close) || close <= 0) continue;
    bars.push({
      date: nyDate(timestamps[i] * 1000),
      close,
      volume: Math.round(volumes[i] ?? 0),
    });
  }
  const byDate = new Map<string, Bar>();
  for (const bar of bars) byDate.set(bar.date, bar);
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

async function ensureBars(sql: Sql, symbol: string): Promise<Bar[]> {
  const existing = await readBars(sql, symbol);
  const stamp = barsFetchedAt.get(symbol) ?? 0;
  if (existing.length >= 100 && Date.now() - stamp < 6 * 60 * 60 * 1000) return existing;
  const fetched = await fetchBars(symbol);
  if (fetched.length) {
    await writeBars(sql, symbol, fetched);
    barsFetchedAt.set(symbol, Date.now());
    return readBars(sql, symbol);
  }
  if (existing.length) barsFetchedAt.set(symbol, Date.now());
  return existing;
}

function quoteError(rows: Quote[]): string | null {
  if (rows.length > 0 && rows.every((row) => row.price == null)) {
    return "The quote feed did not answer. Names are still in the database.";
  }
  return null;
}

function buildLede(
  marketState: string | null,
  sectors: SectorStat[],
  breadth: DeskData["breadth"],
): string {
  const session =
    marketState === "REGULAR"
      ? "The session is open."
      : marketState === "PRE"
        ? "Pre-market."
        : marketState === "POST" || marketState === "POSTPOST"
          ? "After hours."
          : "The session is closed.";
  if (!breadth.total) return `${session} Quotes are still filling in.`;
  const leader = sectors[0];
  const laggard = sectors[sectors.length - 1];
  const tape = `${breadth.up} of ${breadth.total} names are higher.`;
  if (!leader || leader.avgChange == null || !laggard || leader.sector === laggard.sector) {
    return `${session} ${tape}`;
  }
  return `${session} ${leader.sector} leads, ${laggard.sector} lags. ${tape}`;
}

function shapeDesk(rows: Quote[]): DeskData {
  const equities = rows.filter((row) => row.kind === "equity");
  const priced = equities.filter((row) => row.changePct != null);
  const up = priced.filter((row) => (row.changePct ?? 0) > 0.0001).length;
  const down = priced.filter((row) => (row.changePct ?? 0) < -0.0001).length;
  const flat = priced.length - up - down;
  const bySector = new Map<string, Quote[]>();
  for (const row of equities) {
    const list = bySector.get(row.sector) ?? [];
    list.push(row);
    bySector.set(row.sector, list);
  }
  const sectors: SectorStat[] = [...bySector.entries()]
    .map(([sector, list]) => {
      const changes = list.map((row) => row.changePct).filter((n): n is number => n != null);
      const pes = list.map((row) => row.trailingPe).filter((n): n is number => n != null && n > 0);
      return {
        sector,
        count: list.length,
        avgChange: average(changes),
        medianPe: median(pes),
      };
    })
    .sort((a, b) => (b.avgChange ?? -999) - (a.avgChange ?? -999));
  const indexOrder = ["SPY", "QQQ", "DIA", "IWM"];
  const indices = indexOrder
    .map((symbol) => rows.find((row) => row.symbol === symbol))
    .filter((row): row is Quote => Boolean(row));
  const gainers = [...priced].sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0)).slice(0, 5);
  const losers = [...priced].sort((a, b) => (a.changePct ?? 0) - (b.changePct ?? 0)).slice(0, 5);
  const watchlist = rows.filter((row) => row.watched).sort((a, b) => a.symbol.localeCompare(b.symbol));
  const marketState = indices.find((row) => row.marketState)?.marketState ?? rows.find((row) => row.marketState)?.marketState ?? null;
  const asOf = rows
    .map((row) => row.quoteAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null;
  const breadth = { up, down, flat, total: priced.length };
  return {
    asOf,
    marketState,
    indices,
    breadth,
    sectors,
    gainers,
    losers,
    watchlist,
    quoteError: quoteError(rows),
    lede: buildLede(marketState, sectors, breadth),
    count: rows.length,
  };
}

async function coverage(sql: Sql) {
  const rows = await sql<{ names: number; bars: number }>`
    select count(distinct symbol)::int as names, count(*)::int as bars from price_bars
  `;
  return {
    names: Number(rows[0]?.names ?? 0),
    bars: Number(rows[0]?.bars ?? 0),
  };
}

export function loadDirectory() {
  return serial(async () => {
    const sql = await getSql();
    await seed(sql);
    const rows = await sql<{ symbol: string; name: string; sector: string; kind: string }>`
      select symbol, name, sector, kind from securities order by symbol
    `;
    const directory: DirectoryEntry[] = rows.map((row) => ({
      symbol: row.symbol,
      name: row.name,
      sector: row.sector,
      kind: asKind(row.kind),
    }));
    return { directory };
  });
}

export function loadDesk() {
  return serial(async () => {
    const sql = await getSql();
    await seed(sql);
    await ensureQuotes(sql);
    return shapeDesk(await fetchAllSafe(sql));
  });
}

export function loadSecurities() {
  return serial(async () => {
    const sql = await getSql();
    await seed(sql);
    await ensureQuotes(sql);
    const rows = await fetchAllSafe(sql);
    return { rows, coverage: await coverage(sql), quoteError: quoteError(rows) };
  });
}

export function loadSymbol(symbol: string) {
  return serial(async () => {
    const sql = await getSql();
    await seed(sql);
    let quote = await fetchOne(sql, symbol);
    if (!quote) {
      const added = await insertFromYahoo(sql, symbol);
      if (!added) {
        return { ok: false as const, symbol, message: `No listing found for ${symbol}.` };
      }
    }
    await ensureQuotes(sql, { symbols: [symbol] });
    quote = await fetchOne(sql, symbol);
    if (!quote) {
      return { ok: false as const, symbol, message: `No listing found for ${symbol}.` };
    }
    const bars = await ensureBars(sql, symbol);
    const book = await fetchAllSafe(sql);
    const read: TapeRead = buildTapeRead(quote, bars, book);
    return { ok: true as const, quote, bars, read };
  });
}

export function loadCompare(symbols: string[]) {
  return serial(async () => {
    const sql = await getSql();
    await seed(sql);
    await ensureQuotes(sql);
    const book = await fetchAllSafe(sql);
    const wanted = [...new Set(symbols.map((symbol) => symbol.toUpperCase()))].slice(0, 4);
    const have = new Set(book.map((row) => row.symbol));
    const present = wanted.filter((symbol) => have.has(symbol));
    const missing = wanted.filter((symbol) => !have.has(symbol));
    const series: { symbol: string; bars: Bar[] }[] = [];
    for (const symbol of present) {
      const bars = await ensureBars(sql, symbol);
      series.push({ symbol, bars });
    }
    return {
      quotes: present.map((symbol) => book.find((row) => row.symbol === symbol)!),
      series,
      missing,
      choices: book.map((row) => ({
        symbol: row.symbol,
        name: row.name,
        sector: row.sector,
        kind: row.kind,
        price: row.price,
        changePct: row.changePct,
      })),
    };
  });
}

export type TapeHit = {
  symbol: string;
  name: string;
  quoteType: Kind;
  exchange: string;
  inDatabase: boolean;
};

export function searchSymbols(query: string) {
  return serial(async () => {
    const sql = await getSql();
    await seed(sql);
    const q = query.trim();
    if (!q) return [] as TapeHit[];
    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [] as TapeHit[];
    const body = (await res.json()) as {
      quotes?: { symbol?: string; shortname?: string; longname?: string; quoteType?: string; exchange?: string }[];
    };
    const known = await sql<{ symbol: string }>`select symbol from securities`;
    const set = new Set(known.map((row) => row.symbol));
    return (body.quotes ?? [])
      .filter((row) => row.symbol && (row.quoteType === "EQUITY" || row.quoteType === "ETF"))
      .slice(0, 8)
      .map((row) => {
        const symbol = row.symbol!.toUpperCase();
        return {
          symbol,
          name: row.longname || row.shortname || symbol,
          quoteType: row.quoteType === "ETF" ? ("etf" as const) : ("equity" as const),
          exchange: row.exchange || "",
          inDatabase: set.has(symbol),
        };
      });
  });
}

export function addSymbol(symbol: string) {
  return serial(async () => {
    const sql = await getSql();
    await seed(sql);
    const existing = await fetchOne(sql, symbol);
    if (!existing) {
      const added = await insertFromYahoo(sql, symbol);
      if (!added) throw new Error(`No listing found for ${symbol}.`);
    }
    await ensureQuotes(sql, { symbols: [symbol], force: true });
    return { symbol };
  });
}

export function saveWatch(symbol: string, watched: boolean) {
  return serial(async () => {
    const sql = await getSql();
    const rows = await sql.query<{ symbol: string }>(
      `update securities set watched = $2, updated_at = now() where symbol = $1 returning symbol`,
      [symbol, watched],
    );
    if (!rows.length) throw new Error("That symbol is not in the database.");
    return { symbol, watched };
  });
}

export function saveResearch(input: { symbol: string; stance: Stance; thesis: string }) {
  return serial(async () => {
    const sql = await getSql();
    const thesis = input.thesis.replace(/\u0000/g, "").slice(0, 2000);
    const rows = await sql.query<{ symbol: string }>(
      `update securities set stance = $2, thesis = $3, updated_at = now() where symbol = $1 returning symbol`,
      [input.symbol, input.stance, thesis],
    );
    if (!rows.length) throw new Error("That symbol is not in the database.");
    return { ok: true as const };
  });
}

export function removeSymbol(symbol: string) {
  return serial(async () => {
    const sql = await getSql();
    const rows = await sql.query<{ seeded: boolean }>(`select seeded from securities where symbol = $1`, [symbol]);
    if (!rows.length) return { ok: true as const };
    if (asBool(rows[0].seeded)) {
      throw new Error("Seeded names stay in the database. Unwatch them instead.");
    }
    await sql.query(`delete from securities where symbol = $1 and seeded = false`, [symbol]);
    barsFetchedAt.delete(symbol);
    return { ok: true as const };
  });
}

export function refreshTape() {
  return serial(async () => {
    const now = Date.now();
    if (now - lastForce < 8000) return { ok: true as const, skipped: true as const };
    lastForce = now;
    const sql = await getSql();
    await seed(sql);
    await ensureQuotes(sql, { force: true });
    barsFetchedAt.clear();
    return { ok: true as const, skipped: false as const };
  });
}
