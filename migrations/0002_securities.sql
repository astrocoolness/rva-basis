-- Research database: one row per listing, plus daily closes once a name is opened.
create table if not exists securities (
  symbol text primary key,
  name text not null,
  sector text not null,
  industry text not null,
  exchange text not null default '',
  kind text not null default 'equity',
  seeded boolean not null default false,
  price double precision,
  change_amt double precision,
  change_pct double precision,
  open_px double precision,
  day_high double precision,
  day_low double precision,
  prev_close double precision,
  volume bigint,
  avg_volume bigint,
  market_cap bigint,
  trailing_pe double precision,
  forward_pe double precision,
  eps double precision,
  dividend_yield double precision,
  price_to_book double precision,
  week52_high double precision,
  week52_low double precision,
  week52_change_pct double precision,
  sma50 double precision,
  sma200 double precision,
  market_state text,
  quote_at timestamptz,
  watched boolean not null default false,
  stance text not null default 'unrated',
  thesis text not null default '',
  updated_at timestamptz not null default now(),
  constraint securities_kind_chk check (kind in ('equity', 'etf')),
  constraint securities_stance_chk check (stance in ('bullish', 'neutral', 'bearish', 'unrated')),
  constraint securities_thesis_len check (char_length(thesis) <= 2000)
);

create index if not exists securities_sector_idx on securities (sector);
create index if not exists securities_watched_idx on securities (watched);

create table if not exists price_bars (
  symbol text not null references securities (symbol) on delete cascade,
  bar_date date not null,
  close double precision not null,
  volume bigint not null default 0,
  primary key (symbol, bar_date)
);

create index if not exists price_bars_symbol_date_idx on price_bars (symbol, bar_date desc);
