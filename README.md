# avGPT

A self-hosted ChatGPT-style chat UI, backed by [NanoGPT](https://nano-gpt.com)
for model access and a self-hosted [SearXNG](https://docs.searxng.org)
instance for live web search. Every prompt is grounded in fresh search
results — the model never answers from training data alone.

## Features

- ChatGPT-shaped UI: collapsible sidebar with grouped history, centered thread,
  rounded composer, light/dark theme, streaming cursor, hover actions
- Model picker that lists every model on your NanoGPT account
- **Forced web grounding**: every turn pre-fetches SearXNG results and exposes
  a `web_search` tool the model can call mid-response. The system prompt
  forbids answers from prior knowledge
- Citation chips beneath every assistant message
- SQLite persistence (one file)
- Single-user password gate

## Quick start (Docker — bundles SearXNG)

```bash
cp .env.example .env       # fill NANOGPT_API_KEY, APP_PASSWORD, SESSION_SECRET
docker compose up -d --build
```

Open http://localhost:3000. The compose stack runs SearXNG alongside avGPT
on a private network; you don't need to expose it.

The SQLite database lives in the `avgpt-data` volume. SearXNG settings live
in `./searxng/settings.yml` — edit and `docker compose restart searxng` to
apply.

## Quick start (local dev)

You need a SearXNG instance reachable from your machine with JSON output
enabled. Easiest path: run just the SearXNG container from this repo.

```bash
docker compose up -d searxng              # exposes nothing externally; start avgpt with --profile dev or run separately
# or one-off:
docker run -d --name searxng -p 8080:8080 -v $PWD/searxng:/etc/searxng searxng/searxng:latest
```

Then:

```bash
cp .env.example .env       # set SEARXNG_URL=http://localhost:8080
npm install
npm run dev                # http://localhost:3000
```

`SESSION_SECRET` must be 32+ chars. Generate one with `openssl rand -hex 32`.

If your SearXNG instance is behind basic auth, set `SEARXNG_AUTH=user:pass`.

## How the search-only constraint works

Three layers, applied to every turn:

1. **Pre-search injection** — before calling the model, the latest user
   message is sent to SearXNG. Results are formatted as a system message and
   prepended to the conversation, with instructions to answer only from those
   results.
2. **`web_search` tool** — exposed via OpenAI-style function calling. The
   model can issue further searches mid-response; results stream back into
   context.
3. **System prompt** — forbids unsourced claims, requires inline citations,
   and tells the model to say "I don't know" rather than guess.

This means every model NanoGPT proxies — including ones without native web
search — becomes a search-grounded model from your perspective.

## Why SearXNG over a hosted API

- **Speed**: same network, no rate-limit round-trips, no third-party latency
- **Cost**: $0 — it's just metasearch on top of public engines
- **Privacy**: queries don't leave your infra
- **No quota**: hammer it as much as you want

Trade-off: snippets are shorter than what a paid API like Tavily returns, so
the model leans harder on the `web_search` tool to refine. In practice
that's still faster end-to-end on most queries.

## Customizing

- Suggestion chips on the empty state: `components/EmptyState.tsx`
- System prompt: `lib/prompts.ts`
- Search depth / result count: `lib/search.ts` (`searxngSearch` opts)
- Model fallback list: `DEFAULT_MODEL_FALLBACKS` in `components/ChatApp.tsx`
- SearXNG config (engines, locales, etc.): `searxng/settings.yml`

## Stack

Next.js 15 (App Router) · React 19 · Tailwind v4 · Vercel AI SDK ·
Drizzle + better-sqlite3 · Radix UI · iron-session · SearXNG
