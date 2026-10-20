export type Stance = "bullish" | "neutral" | "bearish" | "unrated";
export type Kind = "equity" | "etf";

export type Quote = {
  symbol: string;
  name: string;
  sector: string;
  industry: string;
  exchange: string;
  kind: Kind;
  seeded: boolean;
  price: number | null;
  change: number | null;
  changePct: number | null;
  open: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  prevClose: number | null;
  volume: number | null;
  avgVolume: number | null;
  marketCap: number | null;
  trailingPe: number | null;
  forwardPe: number | null;
  eps: number | null;
  dividendYield: number | null;
  priceToBook: number | null;
  week52High: number | null;
  week52Low: number | null;
  week52ChangePct: number | null;
  sma50: number | null;
  sma200: number | null;
  marketState: string | null;
  quoteAt: string | null;
  watched: boolean;
  stance: Stance;
  thesis: string;
};

export type Bar = { date: string; close: number; volume: number };

export type DirectoryEntry = {
  symbol: string;
  name: string;
  sector: string;
  kind: Kind;
};

export type SectorStat = {
  sector: string;
  count: number;
  avgChange: number | null;
  medianPe: number | null;
};

export type DeskData = {
  asOf: string | null;
  marketState: string | null;
  indices: Quote[];
  breadth: { up: number; down: number; flat: number; total: number };
  sectors: SectorStat[];
  gainers: Quote[];
  losers: Quote[];
  watchlist: Quote[];
  quoteError: string | null;
  lede: string;
  count: number;
};
