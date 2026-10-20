import type { Bar, Quote } from "@/lib/types";

export type Trend = "uptrend" | "downtrend" | "mixed" | "unknown";

export type TapeRead = {
  trend: Trend;
  rsi14: number | null;
  vol20: number | null;
  ret5: number | null;
  ret21: number | null;
  ret63: number | null;
  ret126: number | null;
  ret252: number | null;
  vsHigh: number | null;
  vsLow: number | null;
  volumeRatio: number | null;
  sectorMedianPe: number | null;
  universeMedianPe: number | null;
  sma50: number | null;
  sma200: number | null;
  bullets: string[];
};

export function median(values: number[]): number | null {
  const xs = values.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!xs.length) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

export function average(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, n) => sum + n, 0) / values.length;
}

function sma(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  let sum = 0;
  for (let i = closes.length - period; i < closes.length; i += 1) sum += closes[i];
  return sum / period;
}

function periodReturn(closes: number[], sessions: number): number | null {
  if (closes.length <= sessions) return null;
  const last = closes[closes.length - 1];
  const prev = closes[closes.length - 1 - sessions];
  if (!prev) return null;
  return (last / prev - 1) * 100;
}

function rsi14(closes: number[]): number | null {
  const period = 14;
  if (closes.length < period + 1) return null;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i += 1) {
    const delta = closes[i] - closes[i - 1];
    if (delta >= 0) gain += delta;
    else loss -= delta;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  for (let i = period + 1; i < closes.length; i += 1) {
    const delta = closes[i] - closes[i - 1];
    const g = delta > 0 ? delta : 0;
    const l = delta < 0 ? -delta : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function realizedVol(closes: number[], window = 20): number | null {
  if (closes.length < window + 1) return null;
  const slice = closes.slice(-(window + 1));
  const rets: number[] = [];
  for (let i = 1; i < slice.length; i += 1) {
    if (slice[i - 1] <= 0 || slice[i] <= 0) return null;
    rets.push(Math.log(slice[i] / slice[i - 1]));
  }
  const mean = rets.reduce((sum, n) => sum + n, 0) / rets.length;
  const variance = rets.reduce((sum, n) => sum + (n - mean) ** 2, 0) / (rets.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

function pctFrom(price: number | null, level: number | null): number | null {
  if (price == null || level == null || level === 0) return null;
  return (price / level - 1) * 100;
}

function trendOf(price: number | null, ma50: number | null, ma200: number | null): Trend {
  if (price == null || ma50 == null || ma200 == null) return "unknown";
  if (price >= ma50 && ma50 >= ma200) return "uptrend";
  if (price < ma50 && ma50 < ma200) return "downtrend";
  return "mixed";
}

function numText(n: number, digits = 1): string {
  return n.toFixed(digits);
}

export function buildTapeRead(quote: Quote, bars: Bar[], book: Quote[]): TapeRead {
  const closes = bars.map((bar) => bar.close).filter((n) => Number.isFinite(n) && n > 0);
  const ma50 = quote.sma50 ?? sma(closes, 50);
  const ma200 = quote.sma200 ?? sma(closes, 200);
  const trend = trendOf(quote.price, ma50, ma200);
  const rsi = rsi14(closes);
  const vol20 = realizedVol(closes);
  const ret5 = periodReturn(closes, 5);
  const ret21 = periodReturn(closes, 21);
  const ret63 = periodReturn(closes, 63);
  const ret126 = periodReturn(closes, 126);
  const ret252 = periodReturn(closes, 252);
  const vsHigh = pctFrom(quote.price, quote.week52High);
  const vsLow = pctFrom(quote.price, quote.week52Low);
  const volumeRatio =
    quote.volume != null && quote.avgVolume != null && quote.avgVolume > 0
      ? quote.volume / quote.avgVolume
      : null;

  const sectorPes = book
    .filter((row) => row.kind === "equity" && row.sector === quote.sector && row.trailingPe != null && row.trailingPe > 0)
    .map((row) => row.trailingPe as number);
  const universePes = book
    .filter((row) => row.kind === "equity" && row.trailingPe != null && row.trailingPe > 0)
    .map((row) => row.trailingPe as number);
  const sectorMedianPe = median(sectorPes);
  const universeMedianPe = median(universePes);

  const bullets: string[] = [];
  if (trend === "uptrend") {
    bullets.push("Price is above the 50-day average, and the 50-day is above the 200-day. The longer trend is up.");
  } else if (trend === "downtrend") {
    bullets.push("Price is below both the 50-day and the 200-day. The longer trend is down.");
  } else if (trend === "mixed") {
    bullets.push("The 50-day and 200-day averages disagree. Treat the trend as mixed, not a clean regime.");
  } else {
    bullets.push("Not enough history yet to judge the trend against the 50-day and 200-day averages.");
  }

  if (rsi != null) {
    if (rsi >= 70) bullets.push(`RSI 14 is ${numText(rsi, 0)}, stretched on the high side.`);
    else if (rsi <= 30) bullets.push(`RSI 14 is ${numText(rsi, 0)}, stretched on the low side.`);
    else bullets.push(`RSI 14 is ${numText(rsi, 0)}, inside a normal band.`);
  }

  if (ret21 != null && ret63 != null) {
    const month = ret21 > 0 ? "higher" : ret21 < 0 ? "lower" : "flat";
    bullets.push(
      `About ${numText(Math.abs(ret21), 1)}% ${month} over the last month of sessions, and ${numText(ret63, 1)}% over three months.`,
    );
  }

  if (vsHigh != null) {
    if (vsHigh >= -0.4) bullets.push("Trading at the 52-week high.");
    else bullets.push(`${numText(Math.abs(vsHigh), 1)}% under the 52-week high.`);
  }

  if (quote.trailingPe != null && quote.trailingPe > 0 && sectorMedianPe != null && quote.kind === "equity") {
    const side = quote.trailingPe < sectorMedianPe ? "below" : quote.trailingPe > sectorMedianPe ? "above" : "in line with";
    bullets.push(
      `Trailing P/E ${numText(quote.trailingPe, 1)}× sits ${side} the ${quote.sector} median of ${numText(sectorMedianPe, 1)}× in this database.`,
    );
  }

  if (volumeRatio != null) {
    bullets.push(`Last volume was ${numText(volumeRatio, 2)}× the 3-month average.`);
  }

  if (vol20 != null) {
    bullets.push(`Realized volatility is about ${numText(vol20, 0)}% annualized, measured on the last 20 sessions.`);
  }

  return {
    trend,
    rsi14: rsi,
    vol20,
    ret5,
    ret21,
    ret63,
    ret126,
    ret252,
    vsHigh,
    vsLow,
    volumeRatio,
    sectorMedianPe,
    universeMedianPe,
    sma50: ma50,
    sma200: ma200,
    bullets: bullets.slice(0, 6),
  };
}
