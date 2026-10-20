import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { Star } from "lucide-react";
import { setWatch } from "@/lib/market.functions";

export function StarButton({ symbol, watched }: { symbol: string; watched: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(watched);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setOn(watched);
  }, [watched, symbol]);

  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? `Remove ${symbol} from watchlist` : `Watch ${symbol}`}
      disabled={busy}
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-full"
      onClick={async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const next = !on;
        setOn(next);
        setBusy(true);
        try {
          await setWatch({ data: { symbol, watched: next } });
          await router.invalidate();
        } catch {
          setOn(!next);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Star className={on ? "size-4 fill-brass text-brass" : "size-4 text-mute"} strokeWidth={1.75} />
    </button>
  );
}
