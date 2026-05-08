# Hugo

**Helpful Universal Guidance Operator**

Hugo is an AI assistant with a deliberate personality: a witty, erudite British gentleman who never pretends to be anything other than an AI. He's knowledgeable and warm, dryly funny when it fits, and committed to clarity — including one well-chosen analogy per conceptual explanation, drawn from an ever-rotating cast of source domains (cooking, weather, music, games, carpentry, and so on). A sidebar logs every analogy he's used, so you can see exactly where his mind has been ranging.

This is a portfolio project: a full-stack, production-shaped chatbot scaffold with a custom agent loop, streaming WebSocket responses, hybrid RAG retrieval, and a UI designed to look unmistakably like *Hugo's* space rather than a generic chat product.

---

## The persona

Hugo presents as a witty, knowledgeable older British gentleman in his 40s–50s — warm, dryly humorous, intellectually curious, patient. Erudite without being pompous, clever without being smug. Think QI panelist meets kindly Oxford don. He doesn't pretend to be human; he openly acknowledges he's an AI dressed in a British voice as a deliberate stylistic choice.

**His signature quirk:** Every response that explains a concept includes exactly one well-chosen analogy, tagged by domain. The frontend reads those tags and populates an analogy log sidebar — a running index of the territories Hugo's mind has visited. Pure factual questions get direct answers; no analogy is forced where one doesn't earn its place.

---

## Visual design direction

The UI leans editorial/literary rather than the flat-minimal aesthetic common to AI products. The goal is that a recruiter or visitor stops and notices intentional choices within seconds.

**Aesthetic:** A hybrid of *New Yorker* editorial restraint and modern product clarity. Generous whitespace, purposeful typography, subtle texture. Nothing kitschy or Union Jack–adjacent.

**Color palette:** Off-white and warm stone backgrounds (`#FAF8F4`, `#F0ECE4`), deep ink for primary text (`#1A1A2E`), a single muted accent — slate teal (`#4A7C8E`) — for interactive elements. Warm amber (`#C9893A`) reserved for analogy tags only, so they always feel like a considered annotation rather than a notification.

**Typography:** A transitional serif — *Lora* or *Playfair Display* — for Hugo's responses and headings; a clean humanist sans (*Inter* or *Source Sans*) for UI chrome and the user's own messages. The distinction makes it visually clear who is speaking before you read a word.

**Avatar / visual identity:** An abstract monogram — a stylized **H** constructed from two overlapping arcs — works as a favicon, avatar, and loading indicator. No mustachioed cartoon; nothing that invites the uncanny valley.

**Analogy log sidebar:** A narrow right panel, closed by default on mobile. Each entry is a pill tag: domain label in amber, analogy text truncated to one line, expandable on click. The running list reads like marginalia in a well-thumbed book.

**Microcopy:** Empty states are dry observations (*"Nothing here yet. Hugo is, as the British say, ready."*). Loading messages rotate through understated wit (*"Thinking…"*, *"Consulting the index…"*, *"One moment — the relevant passage is somewhere in here."*). Error states are gracious rather than alarming.

---

## Technical architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser                                                        │
│  Next.js 14 App Router · TypeScript · Tailwind · Zustand        │
│  WebSocket client (exponential backoff reconnect)               │
└────────────────────┬────────────────────────────────────────────┘
                     │ ws://  (streaming frames)
                     │ http:// (REST: auth, conversations, messages)
┌────────────────────▼────────────────────────────────────────────┐
│  FastAPI (Python 3.11, async)                                   │
│                                                                 │
│  ┌─────────────┐   ┌──────────────────────────────────────────┐ │
│  │  REST API   │   │  WebSocket endpoint                      │ │
│  │  /auth      │   │  handshake → auth → agent loop           │ │
│  │  /convs     │   └──────────────┬───────────────────────────┘ │
│  │  /messages  │                  │                             │
│  └─────────────┘    ┌─────────────▼────────────────────────┐   │
│                     │  Orchestrator (custom agent loop)     │   │
│                     │  • 50ms text-batching                 │   │
│                     │  • max 5 tool iterations              │   │
│                     │  • parallel tool execution (cap 5)    │   │
│                     │  • cancel semantics (Redis pub/sub)   │   │
│                     │  • rolling summary (Haiku, >60K tok)  │   │
│                     └──────┬────────────┬────────────────────┘  │
│                            │            │                       │
│              ┌─────────────▼──┐   ┌─────▼──────────────────┐   │
│              │  LLM provider  │   │  Tool registry         │   │
│              │  Anthropic     │   │  get_current_time      │   │
│              │  claude-s-4-5  │   │  search_documents      │   │
│              │  ext. thinking │   │  (add your own)        │   │
│              │  prompt cache  │   └────────────────────────┘   │
│              └────────────────┘                                 │
└──────────────────────────────────┬──────────────────────────────┘
                                   │
          ┌────────────────────────┼──────────────────────────┐
          │                        │                          │
    ┌─────▼──────┐          ┌──────▼──────┐         ┌────────▼──────┐
    │ PostgreSQL │          │   Redis 7   │         │  Voyage AI    │
    │  pgvector  │          │  7 jobs:    │         │  voyage-3     │
    │  chunks    │          │  sessions   │         │  1024-dim     │
    │  HNSW idx  │          │  cancel bus │         │  embeddings   │
    │  GIN idx   │          │  rate limit │         └───────────────┘
    └────────────┘          │  idempotency│
                            │  hot cache  │
                            │  tool locks │
                            │  conn reg.  │
                            └─────────────┘
```

### Agent loop

Hugo has no framework orchestrating him — the loop is hand-written (`backend/app/orchestrator/loop.py`, ~250 lines). Each user turn:

1. Loads conversation history from Postgres, prepends any rolling summary
2. Streams a response from Claude, time-batching text deltas at 50ms into the WebSocket queue
3. On `tool_use` stop: executes tools in parallel (up to 5 concurrent, 30s per-tool timeout), injects results, loops
4. On `end_turn`: persists the assistant message, optionally compresses history via Claude Haiku, emits a `done` frame
5. At any point: a `{"type":"cancel"}` frame from the client publishes to `cancel:{conversation_id}` on Redis; the single global `PSUBSCRIBE cancel:*` listener signals an `asyncio.Event` that the loop checks between tool iterations

Partial (cancelled) messages are persisted with `status="cancelled"` and can be retried with the same `client_message_id`.

### RAG retrieval

Hybrid vector + BM25: both queries run in parallel, scores are min-max normalised per channel, then merged with a configurable `alpha` weight (default 0.7 vector, 0.3 BM25). The HNSW index on `chunks.embedding` and the GIN trigram index on `chunks.content` are created by the hand-written Alembic migration. Document ingestion (`ingest()`) is a TODO stub — the retrieval path is complete.

### Redis jobs (7)

| # | Key pattern | Purpose | Failure mode |
|---|---|---|---|
| 1 | `session:{token}` | HTTP-only session cookie store | Fail closed (503) |
| 2 | `cancel:{conv_id}` | Cancel pub/sub channel | Fail open |
| 3 | `rl:{user_id}` | Sliding-window rate limit (60 msg/min) | Fail open |
| 4 | `idem:{client_msg_id}` | Idempotency keys (24hr TTL) | Fail open |
| 5 | `conv:{conv_id}` | Hot conversation cache (1hr TTL) | Fail open |
| 6 | `tool_lock:{key}` | Distributed tool locks (SET NX EX 60) | Fail open |
| 7 | *(connection registry)* | Per-instance WS connection tracking | Fail open |

Sessions are the only job that fails closed — if the session store is down, a 503 is safer than letting unverified requests through. Everything else degrades gracefully.

### LLM provider

`AnthropicProvider` streams via `client.messages.stream()` with extended thinking (`budget_tokens=2048`). Extended thinking requires `temperature=1.0` — the Anthropic API rejects other values when thinking is enabled; this is documented prominently in `anthropic_provider.py`. Prompt caching is applied to the system prompt and tool definitions via `cache_control: {"type": "ephemeral"}` on the last tool schema and the system block, so stable content doesn't re-enter the context budget on every turn.

The `LLMProvider` and `EmbeddingProvider` interfaces are `Protocol` classes — swap the implementation in `_get_providers()` in `websocket.py` without touching the orchestrator.

### Mock providers

`MOCK_PROVIDERS=true` bypasses all external API calls. The mock LLM returns deterministic `[MOCK] echo:{md5}` responses; mock embeddings derive unit vectors from SHA-256 hashes. All 11 tests run offline in 0.16s against an in-memory SQLite database.

---

## Project structure

```
HUGO/
├── .env.example
├── docker-compose.yml
├── README.md
├── backend/
│   ├── pyproject.toml
│   ├── Dockerfile
│   ├── alembic.ini
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/0001_initial.py   ← hand-written (not autogenerated)
│   └── app/
│       ├── main.py                    ← FastAPI app + lifespan
│       ├── seed.py                    ← idempotent dev-user seed
│       ├── core/
│       │   ├── config.py              ← Pydantic Settings
│       │   ├── logging.py             ← structlog JSON/console
│       │   ├── redis.py               ← shared client
│       │   ├── cancel_bus.py          ← global PSUBSCRIBE + asyncio.Event
│       │   ├── locks.py               ← SET NX EX distributed locks
│       │   ├── cache.py               ← hot conversation cache
│       │   ├── rate_limit.py          ← sliding-window limiter
│       │   ├── idempotency.py         ← dedup by client_message_id
│       │   └── dependencies.py        ← FastAPI deps (db, redis, user)
│       ├── db/
│       │   ├── models.py              ← ORM: users, conversations, messages,
│       │   │                             documents, chunks, audit_logs
│       │   └── session.py             ← NullPool engine + session factory
│       ├── schemas/                   ← Pydantic v2 request/response models
│       ├── llm/
│       │   ├── provider.py            ← LLMProvider protocol + event types
│       │   ├── anthropic_provider.py  ← streaming, thinking, prompt cache
│       │   └── mock_provider.py       ← deterministic offline provider
│       ├── embeddings/                ← EmbeddingProvider protocol + Voyage + mock
│       ├── rag/
│       │   └── retriever.py           ← hybrid vector+BM25, parallel queries
│       ├── tools/
│       │   ├── base.py                ← Tool ABC, 10KB cap, lock support
│       │   ├── registry.py            ← ToolRegistry + build_default_registry()
│       │   ├── time_tool.py
│       │   └── search_tool.py
│       ├── orchestrator/
│       │   ├── loop.py                ← custom agent loop (~250 lines)
│       │   ├── history.py             ← message list builder + token estimator
│       │   ├── summarizer.py          ← rolling summary via Claude Haiku
│       │   └── persistence.py         ← save user/assistant messages
│       └── api/
│           ├── auth.py                ← dev-login, /me, logout
│           ├── conversations.py       ← CRUD + message listing
│           ├── websocket.py           ← WS endpoint, provider wiring
│           └── cors.py
└── frontend/
    ├── package.json
    ├── next.config.js
    ├── tailwind.config.js
    ├── app/
    │   ├── layout.tsx
    │   ├── page.tsx                   ← auth gate + root layout
    │   └── globals.css
    ├── components/
    │   ├── ChatInterface.tsx           ← WS lifecycle, send/cancel
    │   ├── MessageList.tsx             ← streaming bubble + tool indicators
    │   ├── ConversationSidebar.tsx
    │   └── ErrorBoundary.tsx
    └── lib/
        ├── types.ts                   ← shared TS types
        ├── store.ts                   ← Zustand sliced store
        ├── ws.ts                      ← WebSocket client + backoff reconnect
        └── api.ts                     ← typed REST client
```

---

## Running locally

### Prerequisites

- Python 3.11
- Node 20
- Docker (for Postgres + Redis), or local installs

### 1. Dependencies and infrastructure

```bash
cp .env.example .env
# Fill in ANTHROPIC_API_KEY and VOYAGE_API_KEY

docker compose up postgres redis -d

cd backend
pip install -e ".[dev]"
```

### 2. Migrate and seed

```bash
DATABASE_URL=postgresql+asyncpg://hugo:hugo@localhost:5432/hugo alembic upgrade head
DATABASE_URL=postgresql+asyncpg://hugo:hugo@localhost:5432/hugo python -m app.seed
```

### 3. Start the API

```bash
uvicorn app.main:app --reload --port 8000
```

### 4. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Visit **http://localhost:3000**, enter any email, click *Dev login*.

### Offline mode (no API keys required)

```bash
MOCK_PROVIDERS=true uvicorn app.main:app --reload --port 8000
```

The mock LLM returns deterministic echo responses. The mock embedding provider derives vectors from SHA-256 hashes. Everything works end-to-end without spending a single API token.

### Full Docker Compose

```bash
docker compose up --build
```

Migrations and seed run automatically before the API starts.

### Tests

```bash
cd backend
MOCK_PROVIDERS=true pytest -v
# 11 passed in 0.16s
```

---

## Test the WebSocket end-to-end

```bash
# Install: brew install websocat

# Dev-login, capture cookie
curl -c /tmp/hugo.txt -X POST http://localhost:8000/api/auth/dev-login \
  -H 'Content-Type: application/json' \
  -d '{"email":"dev@hugo.local","display_name":"Dev"}'

# Create a conversation
CONV_ID=$(curl -s -b /tmp/hugo.txt -X POST http://localhost:8000/api/conversations \
  -H 'Content-Type: application/json' \
  -d '{"title":"test"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

# Connect
SESSION=$(grep session_token /tmp/hugo.txt | awk '{print $NF}')
websocat "ws://localhost:8000/ws" --header "Cookie: session_token=${SESSION}"
```

Then send frames interactively:

```json
{"type":"handshake","conversation_id":"PASTE_CONV_ID"}
{"type":"message","content":"What time is it?","client_message_id":"test-001"}
```

You'll see streaming `delta` frames, then a `done` frame with token counts. To cancel mid-stream:

```json
{"type":"cancel"}
```

---

## Extending Hugo

### Add a tool

1. Subclass `Tool` in `backend/app/tools/my_tool.py` — set `name`, `description`, `input_schema`, implement `async def run`
2. Register it in `build_default_registry()` in `tools/registry.py`

No other changes. The orchestrator discovers tools through the registry.

### Swap the LLM provider

Implement the `LLMProvider` protocol (`backend/app/llm/provider.py`) — one method: `stream_message(*, system, messages, tools, conversation_id) -> AsyncIterator[LLMEvent]`. Wire it in `_get_providers()` in `api/websocket.py`.

### Swap the embedding provider

Implement `EmbeddingProvider` (`backend/app/embeddings/provider.py`), wire in `_get_providers()`.

### Implement RAG ingestion

The `ingest()` stub is in `backend/app/rag/retriever.py`. Add chunking, call `embed.embed(chunks)`, insert `Chunk` rows with 1024-dim vectors. The retrieval path (HNSW + BM25 hybrid) is already live.

### Add planner-executor pattern

Extend `backend/app/orchestrator/loop.py`: before the main stream, call Claude once with a `plan` tool to produce a structured plan, then execute each step in sequence. The parallel tool executor, cancel semantics, and per-tool timeout are already in place.

### Swap NullPool for persistent connections

In `backend/app/db/session.py`:

```python
from sqlalchemy.pool import AsyncAdaptedQueuePool
engine = create_async_engine(
    settings.database_url,
    poolclass=AsyncAdaptedQueuePool,
    pool_size=10,
    max_overflow=20,
)
```

Make the same change in `backend/alembic/env.py`.

### Add real auth

Replace the `dev-login` route in `backend/app/api/auth.py` with an OAuth2/OIDC callback. The session cookie mechanism (`redis.setex("session:{token}", ttl, user_id)`) and all downstream wiring are already complete.

### Add OpenTelemetry

```bash
pip install opentelemetry-sdk opentelemetry-exporter-otlp opentelemetry-instrumentation-fastapi
```

In `backend/app/main.py`:

```python
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
FastAPIInstrumentor.instrument_app(app)
```

Add spans from `loop.py` with `tracer.start_as_current_span("agent_loop")`.

---

## WebSocket frame reference

| Frame (server → client) | Fields | Notes |
|---|---|---|
| `delta` | `text` | Streaming text chunk (50ms-batched) |
| `thinking` | `text` | Extended thinking delta (unbatched) |
| `tool_start` | `tool_name`, `tool_use_id` | Emitted before tool runs |
| `tool_result` | `tool_use_id`, `content` | Emitted after tool returns |
| `done` | `message_id`, `input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_write_tokens` | Turn complete |
| `error` | `code`, `message` | Recoverable error |
| `rate_limited` | `retry_after` | 60 msg/min exceeded |

| Frame (client → server) | Fields | Notes |
|---|---|---|
| `handshake` | `conversation_id` | Must be first frame after connect |
| `message` | `content`, `client_message_id` | UUID per message for idempotency |
| `cancel` | — | Publishes to Redis `cancel:{conv_id}` |

---

## Tech stack summary

| Concern | Choice | Why |
|---|---|---|
| Web framework | FastAPI async | Native async, Pydantic v2 integration, WebSocket support |
| ORM | SQLAlchemy 2.0 async | Type-safe, async-native, Alembic migration support |
| Connection pool | NullPool | Safe for serverless; swap to `AsyncAdaptedQueuePool` for long-running servers |
| Database | PostgreSQL 16 + pgvector | Relational + vector in one store; HNSW for ANN search |
| Cache / pub-sub | Redis 7 | Sessions, cancel bus, rate limiting, idempotency, hot cache, locks |
| LLM | Anthropic `claude-sonnet-4-5` | Extended thinking + prompt caching |
| Embeddings | Voyage AI `voyage-3` | 1024-dim, strong retrieval performance |
| Frontend | Next.js 14 App Router | RSC-ready, production-grade |
| State | Zustand (sliced store) | Lightweight, no boilerplate |
| Logging | structlog JSON | Structured, queryable in any log aggregator |
| Agent loop | Hand-written | No LangChain / LangGraph — full control over iteration, cancel, and persistence |
