import type { Kind } from "@/lib/types";

export type SeedName = {
  symbol: string;
  name: string;
  sector: string;
  industry: string;
  exchange: string;
  kind: Kind;
};

export const UNIVERSE: SeedName[] = [
  { symbol: "SPY", name: "SPDR S&P 500 ETF", sector: "Index", industry: "Large-cap blend", exchange: "NYSE Arca", kind: "etf" },
  { symbol: "QQQ", name: "Invesco QQQ", sector: "Index", industry: "Nasdaq 100", exchange: "Nasdaq", kind: "etf" },
  { symbol: "DIA", name: "SPDR Dow Jones ETF", sector: "Index", industry: "Dow industrials", exchange: "NYSE Arca", kind: "etf" },
  { symbol: "IWM", name: "iShares Russell 2000", sector: "Index", industry: "Small-cap blend", exchange: "NYSE Arca", kind: "etf" },

  { symbol: "AAPL", name: "Apple", sector: "Technology", industry: "Consumer electronics", exchange: "Nasdaq", kind: "equity" },
  { symbol: "MSFT", name: "Microsoft", sector: "Technology", industry: "Software", exchange: "Nasdaq", kind: "equity" },
  { symbol: "NVDA", name: "NVIDIA", sector: "Technology", industry: "Semiconductors", exchange: "Nasdaq", kind: "equity" },
  { symbol: "AVGO", name: "Broadcom", sector: "Technology", industry: "Semiconductors", exchange: "Nasdaq", kind: "equity" },
  { symbol: "ORCL", name: "Oracle", sector: "Technology", industry: "Software", exchange: "NYSE", kind: "equity" },
  { symbol: "CRM", name: "Salesforce", sector: "Technology", industry: "Software", exchange: "NYSE", kind: "equity" },
  { symbol: "AMD", name: "AMD", sector: "Technology", industry: "Semiconductors", exchange: "Nasdaq", kind: "equity" },
  { symbol: "ADBE", name: "Adobe", sector: "Technology", industry: "Software", exchange: "Nasdaq", kind: "equity" },
  { symbol: "CSCO", name: "Cisco", sector: "Technology", industry: "Communications equipment", exchange: "Nasdaq", kind: "equity" },

  { symbol: "GOOGL", name: "Alphabet", sector: "Communication", industry: "Internet", exchange: "Nasdaq", kind: "equity" },
  { symbol: "META", name: "Meta Platforms", sector: "Communication", industry: "Internet", exchange: "Nasdaq", kind: "equity" },
  { symbol: "NFLX", name: "Netflix", sector: "Communication", industry: "Entertainment", exchange: "Nasdaq", kind: "equity" },
  { symbol: "DIS", name: "Walt Disney", sector: "Communication", industry: "Entertainment", exchange: "NYSE", kind: "equity" },

  { symbol: "AMZN", name: "Amazon", sector: "Consumer Discretionary", industry: "Internet retail", exchange: "Nasdaq", kind: "equity" },
  { symbol: "TSLA", name: "Tesla", sector: "Consumer Discretionary", industry: "Automobiles", exchange: "Nasdaq", kind: "equity" },
  { symbol: "HD", name: "Home Depot", sector: "Consumer Discretionary", industry: "Home improvement", exchange: "NYSE", kind: "equity" },
  { symbol: "MCD", name: "McDonald's", sector: "Consumer Discretionary", industry: "Restaurants", exchange: "NYSE", kind: "equity" },
  { symbol: "NKE", name: "Nike", sector: "Consumer Discretionary", industry: "Apparel", exchange: "NYSE", kind: "equity" },
  { symbol: "SBUX", name: "Starbucks", sector: "Consumer Discretionary", industry: "Restaurants", exchange: "Nasdaq", kind: "equity" },

  { symbol: "WMT", name: "Walmart", sector: "Consumer Staples", industry: "Retail", exchange: "NYSE", kind: "equity" },
  { symbol: "COST", name: "Costco", sector: "Consumer Staples", industry: "Retail", exchange: "Nasdaq", kind: "equity" },
  { symbol: "PG", name: "Procter & Gamble", sector: "Consumer Staples", industry: "Household products", exchange: "NYSE", kind: "equity" },
  { symbol: "KO", name: "Coca-Cola", sector: "Consumer Staples", industry: "Beverages", exchange: "NYSE", kind: "equity" },
  { symbol: "PEP", name: "PepsiCo", sector: "Consumer Staples", industry: "Beverages", exchange: "Nasdaq", kind: "equity" },

  { symbol: "JPM", name: "JPMorgan Chase", sector: "Financials", industry: "Banks", exchange: "NYSE", kind: "equity" },
  { symbol: "BAC", name: "Bank of America", sector: "Financials", industry: "Banks", exchange: "NYSE", kind: "equity" },
  { symbol: "GS", name: "Goldman Sachs", sector: "Financials", industry: "Capital markets", exchange: "NYSE", kind: "equity" },
  { symbol: "V", name: "Visa", sector: "Financials", industry: "Payments", exchange: "NYSE", kind: "equity" },
  { symbol: "MA", name: "Mastercard", sector: "Financials", industry: "Payments", exchange: "NYSE", kind: "equity" },
  { symbol: "BRK-B", name: "Berkshire Hathaway", sector: "Financials", industry: "Conglomerate", exchange: "NYSE", kind: "equity" },

  { symbol: "LLY", name: "Eli Lilly", sector: "Healthcare", industry: "Pharmaceuticals", exchange: "NYSE", kind: "equity" },
  { symbol: "UNH", name: "UnitedHealth", sector: "Healthcare", industry: "Managed care", exchange: "NYSE", kind: "equity" },
  { symbol: "JNJ", name: "Johnson & Johnson", sector: "Healthcare", industry: "Pharmaceuticals", exchange: "NYSE", kind: "equity" },
  { symbol: "ABBV", name: "AbbVie", sector: "Healthcare", industry: "Pharmaceuticals", exchange: "NYSE", kind: "equity" },
  { symbol: "MRK", name: "Merck", sector: "Healthcare", industry: "Pharmaceuticals", exchange: "NYSE", kind: "equity" },

  { symbol: "XOM", name: "Exxon Mobil", sector: "Energy", industry: "Oil and gas", exchange: "NYSE", kind: "equity" },
  { symbol: "CVX", name: "Chevron", sector: "Energy", industry: "Oil and gas", exchange: "NYSE", kind: "equity" },

  { symbol: "CAT", name: "Caterpillar", sector: "Industrials", industry: "Machinery", exchange: "NYSE", kind: "equity" },
  { symbol: "GE", name: "GE Aerospace", sector: "Industrials", industry: "Aerospace", exchange: "NYSE", kind: "equity" },
  { symbol: "HON", name: "Honeywell", sector: "Industrials", industry: "Conglomerate", exchange: "Nasdaq", kind: "equity" },
  { symbol: "BA", name: "Boeing", sector: "Industrials", industry: "Aerospace", exchange: "NYSE", kind: "equity" },

  { symbol: "NEE", name: "NextEra Energy", sector: "Utilities", industry: "Electric utilities", exchange: "NYSE", kind: "equity" },
  { symbol: "PLD", name: "Prologis", sector: "Real Estate", industry: "Industrial REIT", exchange: "NYSE", kind: "equity" },
  { symbol: "LIN", name: "Linde", sector: "Materials", industry: "Industrial gases", exchange: "Nasdaq", kind: "equity" },
];

export const INDEX_LABEL: Record<string, string> = {
  SPY: "S&P 500",
  QQQ: "Nasdaq 100",
  DIA: "Dow",
  IWM: "Russell 2000",
};
