# H . U . G . O
### Helpful Universal Guidance Operator

Hugo is a personal AI assistant built on Claude Sonnet. He is designed to give accurate, well-reasoned answers by actively using tools — searching the web, analysing attachments, and thinking through problems — rather than relying solely on what the model already knows.

---

## What Hugo Does

Hugo handles complex, open-ended questions that require up-to-date information or multi-step reasoning. When a question is time-sensitive, he searches. When you attach an image or PDF, he reads it. When a problem is hard, he thinks through it before responding.

Long conversations are handled via a rolling summary: once the context window approaches its limit, Claude Haiku compresses the older history into a persistent summary so the thread is never lost.

---

## Toolkit

### Agent Tools

| Tool | Description |
|---|---|
| **Web Search** | Brave Search API for real-time information — news, prices, events, anything beyond the model's training cutoff. Returns ranked results with titles, URLs, and descriptions. |
| **Current Time** | UTC timestamp used when time-awareness is needed for a response. |

Agent tools run concurrently (up to 5 in parallel) with a 30-second timeout each.

### Input Capabilities

| Input | Description |
|---|---|
| **Image attachment** | Attach a JPEG, PNG, GIF, or WebP image from your device. Hugo reads and reasons about the image content using Claude's vision API. |
| **Camera capture** | Take a photo directly from your device camera and send it inline. Useful for scanning documents, receipts, whiteboards, or anything in front of you. |
| **PDF upload** | Attach a PDF document for Hugo to read and reference. Claude receives the full document content and can answer questions, summarise sections, or extract specific information from it. |

---

## In Action

**Real-time web search**

> *"What's the current federal funds rate and how does it compare to where it was a year ago?"*
> *"Who won the most recent Champions League final and what was the scoreline?"*
> *"What's the latest on [ongoing news story]?"*

<!-- Screenshot: Hugo using the web_search tool badge, then answering with sourced, up-to-date information -->
`[ Screenshot ]`

&nbsp;

**Extended thinking — working through a hard problem**

> *"Walk me through how a transformer's attention mechanism actually works, from the raw input to the weighted output."*
> *"I have £50k to invest and I'm 28. What allocation would you suggest and why?"*
> *"What are the main reasons a distributed system might return stale reads, and how does each fix introduce a new tradeoff?"*

<!-- Screenshot: Hugo's thinking steps visible in the UI, followed by a structured and precise final answer -->
`[ Screenshot ]`

&nbsp;

**Nuanced reasoning on an ambiguous question**

> *"Is it ever ethical to lie? Give me a genuinely balanced answer, not a hedge."*
> *"My co-founder and I disagree on whether to raise a seed round now or grow slower. What questions should we be asking?"*
> *"Explain the trolley problem and why it still matters in real AI design decisions."*

<!-- Screenshot: Hugo unpacking a layered question, stating assumptions clearly before giving a considered answer -->
`[ Screenshot ]`

&nbsp;

**Image and document analysis**

> *[Attaches a photo of a wine label]* *"What can you tell me about this wine?"*
> *[Attaches a screenshot of an error message]* *"What's causing this and how do I fix it?"*
> *[Attaches a PDF contract]* *"Summarise the key obligations in this contract and flag anything unusual."*
> *[Takes a photo of a receipt]* *"What did I spend and is anything worth querying?"*

<!-- Screenshot: Hugo reading an attached image or PDF and giving a detailed, grounded response -->
`[ Screenshot ]`

---

## Architecture

Hugo is a Next.js frontend backed by a FastAPI service communicating over a persistent WebSocket. All AI responses stream token-by-token from Anthropic's API through to the browser.

```
┌───────────────────────────────────────────────────────┐
│                   Browser · Next.js                   │
│                                                       │
│    Sidebar · ChatInterface · MessageList              │
│          Zustand Store · WebSocket Client             │
└───────────────────────────┬───────────────────────────┘
                            │
                     WebSocket + REST API
                   (HTTP-only session cookies)
                            │
┌───────────────────────────┴───────────────────────────┐
│                    FastAPI Backend                    │
│                                                       │
│    /api/auth · /api/conversations · /ws               │
│                                                       │
│          ┌─────────────────────────────────┐          │
│          │       Agent Orchestrator        │          │
│          │  Loop · History · Titler        │          │
│          │  Summariser · Persistence       │          │
│          │  Tool Registry                  │          │
│          └─────────────────────────────────┘          │
│                                                       │
└────────┬──────────────────┬──────────────────┬────────┘
         │                  │                  │
┌────────┴──────┐  ┌────────┴──────┐  ┌────────┴──────┐
│  PostgreSQL   │  │  Anthropic    │  │  Redis        │
│               │  │  Claude API   │  │               │
│  users        │  │               │  │  sessions     │
│  conversations│  │  Claude Sonnet│  │  rate limits  │
│  messages     │  │  Claude Haiku │  │  cancel bus   │
│               │  │  streaming    │  │  idempotency  │
│               │  │  prompt cache │  └───────────────┘
│               │  │  ext. thinking│
│               │  └───────────────┘
└───────────────┘
```

### Request Lifecycle

1. **Message in** — received over WebSocket, idempotency-checked via Redis, persisted to DB
2. **History built** — prior messages loaded, rolling summary prepended if present, thinking blocks stripped (model regenerates them fresh each turn)
3. **LLM call** — system prompt and tool schemas sent to Claude with prompt cache headers; streaming begins
4. **Tokens out** — text deltas are batched in 50ms windows before forwarding to the client; thinking deltas bypass batching and arrive immediately
5. **Tool use** — if the model calls tools, they run in parallel (up to 5); results are injected back into context and the loop continues (max 5 rounds)
6. **Persist** — completed message written to DB with token accounting; title generated on first turn via Haiku; rolling summary triggered if context is growing large
7. **Done frame** — sent to client with final token counts

### Cancellation

A Redis PubSub channel (`cancel:{conversation_id}`) carries cancellation signals. The backend maps these to per-conversation `asyncio.Event` objects checked at every iteration of the agent loop and within tool execution. Partial responses are persisted with `status=cancelled`.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS, Zustand |
| Backend | Python 3.11, FastAPI, SQLAlchemy (async), Alembic |
| AI | Anthropic Claude Sonnet — streaming, prompt caching, extended thinking |
| Web Search | Brave Search API |
| Database | PostgreSQL |
| Cache / Pub-Sub | Redis — sessions, rate limiting, cancellation bus, idempotency |
| Auth | Google OAuth (One Tap) · Email/password (bcrypt) |

---

## Configuration

Backend (`backend/.env`):

```env
# AI
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-5
ANTHROPIC_THINKING_BUDGET=0        # set > 0 to enable extended thinking

# Tools
BRAVE_SEARCH_API_KEY=

# Infrastructure
DATABASE_URL=postgresql+asyncpg://hugo:hugo@localhost:5432/hugo
REDIS_URL=redis://localhost:6379/0

# Auth
GOOGLE_CLIENT_ID=
SESSION_SECRET=                    # openssl rand -hex 32

# Agent behaviour
MAX_TOOL_ITERATIONS=5
TOOL_TIMEOUT_SECONDS=30
ROLLING_SUMMARY_TOKEN_THRESHOLD=60000
```

Frontend (`frontend/.env.local`):

```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=
```
