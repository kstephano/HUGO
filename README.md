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

**Login Page** _sorry_

<img width="1179" height="2556" alt="5916C9FC-3900-407C-B7E8-07BE9CCFA8B6_1_102_o" src="https://github.com/user-attachments/assets/8283b8f9-8440-41ba-b0aa-707e646bbb68" />

**Main Chat Page** _yes I watched Interstellar recently_

<img width="1179" height="2556" alt="9BB9E234-6B08-4D95-ADD7-CB90F1B5EE47_1_102_o" src="https://github.com/user-attachments/assets/b3558c34-8594-4c93-9d46-fa505a39dae2" />

**Sidebar with conversation history** _Hugo can remember from past conversations - good thing I didn't call him Nemo wahay_

<img width="1179" height="2556" alt="227F0CC3-2644-4E7C-BCD1-9D1E3572F69F_1_102_o" src="https://github.com/user-attachments/assets/25bde055-559d-48ea-8844-8a410a6b72cf" />

**Real-time web search** _useful_

<img width="607" height="327" alt="image" src="https://github.com/user-attachments/assets/1b9e3ec7-1f28-447f-a638-a430714c16bb" />

&nbsp;

**PDF scanning** _also pretty useful_

<img width="1179" height="2556" alt="FA865ED0-014F-4F47-8D48-2A9E62942409_1_102_o" src="https://github.com/user-attachments/assets/6e39bf19-551d-4dd4-afd9-9e3e25a46c23" />

**Image scanning** _the first picture contained my API secrets lol_

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
