import { createServerFn } from "@tanstack/react-start";
import type { Stance } from "@/lib/types";

const SYMBOL = /^[A-Z0-9.^=-]{1,12}$/;
const STANCES: Stance[] = ["bullish", "neutral", "bearish", "unrated"];

function assertSymbol(raw: string): string {
  const symbol = String(raw ?? "")
    .trim()
    .toUpperCase();
  if (!SYMBOL.test(symbol)) throw new Error("Unrecognized symbol.");
  return symbol;
}

export const listDirectory = createServerFn({ method: "GET" }).handler(async () => {
  const { loadDirectory } = await import("./market.server");
  return loadDirectory();
});

export const getDesk = createServerFn({ method: "GET" }).handler(async () => {
  const { loadDesk } = await import("./market.server");
  return loadDesk();
});

export const listSecurities = createServerFn({ method: "GET" }).handler(async () => {
  const { loadSecurities } = await import("./market.server");
  return loadSecurities();
});

export const getSymbol = createServerFn({ method: "POST" })
  .validator((raw: string) => assertSymbol(raw))
  .handler(async ({ data }) => {
    const { loadSymbol } = await import("./market.server");
    return loadSymbol(data);
  });

export const getCompare = createServerFn({ method: "POST" })
  .validator((symbols: string[]) => {
    if (!Array.isArray(symbols)) return [] as string[];
    return [...new Set(symbols.map((symbol) => assertSymbol(symbol)))].slice(0, 4);
  })
  .handler(async ({ data }) => {
    const { loadCompare } = await import("./market.server");
    return loadCompare(data);
  });

export const searchTape = createServerFn({ method: "POST" })
  .validator((raw: string) => String(raw ?? "").trim().slice(0, 40))
  .handler(async ({ data }) => {
    const { searchSymbols } = await import("./market.server");
    return searchSymbols(data);
  });

export const addListing = createServerFn({ method: "POST" })
  .validator((raw: string) => assertSymbol(raw))
  .handler(async ({ data }) => {
    const { addSymbol } = await import("./market.server");
    return addSymbol(data);
  });

export const setWatch = createServerFn({ method: "POST" })
  .validator((input: { symbol: string; watched: boolean }) => ({
    symbol: assertSymbol(input.symbol),
    watched: Boolean(input.watched),
  }))
  .handler(async ({ data }) => {
    const { saveWatch } = await import("./market.server");
    return saveWatch(data.symbol, data.watched);
  });

export const setResearch = createServerFn({ method: "POST" })
  .validator((input: { symbol: string; stance: string; thesis: string }) => {
    const stance = STANCES.includes(input.stance as Stance) ? (input.stance as Stance) : "unrated";
    const thesis = String(input.thesis ?? "")
      .replace(/\u0000/g, "")
      .slice(0, 2000);
    return { symbol: assertSymbol(input.symbol), stance, thesis };
  })
  .handler(async ({ data }) => {
    const { saveResearch } = await import("./market.server");
    return saveResearch(data);
  });

export const dropListing = createServerFn({ method: "POST" })
  .validator((raw: string) => assertSymbol(raw))
  .handler(async ({ data }) => {
    const { removeSymbol } = await import("./market.server");
    return removeSymbol(data);
  });

export const refreshTape = createServerFn({ method: "POST" }).handler(async () => {
  const { refreshTape: run } = await import("./market.server");
  return run();
});
