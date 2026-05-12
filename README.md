<img src="frontend/public/images/hugo-logo.png" width="72" alt="Hugo" align="left">

# H . U . G . O
### Helpful Universal Guidance Operator

<br clear="left">

Have you ever wanted an astronaut robot AI assistant to be your friend and counselor for almost anything you can think to ask of him? Look no further. I present HUGO - a personal AI assistant. 

---

## What Hugo Does

Hugo has a watch that allows him to tell the time. He also has the latest iPhone 17 Pro with EE Super 5G connectivity, so he's connected to the internet wherever you and him go, even in space! This allows him to answer time-sensitive questions, in which the underlying model (Claude Sonnet), hasn't been trained on. 

He can also load up your images or PDF files to read through and digest. When a problem is hard, he enters MUSE (Moment of Unhurried, Sustained Examination) to really get to grips with the issue.

Long conversations can tire his ADHD attention mechanism, so he enables RECAP (Reduce Extended Conversation Around Points) via Claude Haiku.

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

**Login Page** <font color="gray"><em>Google is everywhere</em></font>

<img width="320" alt="5916C9FC-3900-407C-B7E8-07BE9CCFA8B6_1_102_o" src="https://github.com/user-attachments/assets/8283b8f9-8440-41ba-b0aa-707e646bbb68" />

&nbsp;

**Main Chat Page** <font color="gray"><em>Yes I watched Interstellar recently</em></font>

<img width="320" alt="9BB9E234-6B08-4D95-ADD7-CB90F1B5EE47_1_102_o" src="https://github.com/user-attachments/assets/b3558c34-8594-4c93-9d46-fa505a39dae2" />

&nbsp;

**Sidebar with conversation history** <font color="gray"><em>Hugo can remember from past conversations - DORY (Data-Omitting Response Yield) mode can be toggled on though if you'd prefer</em></font>

<img width="320" alt="227F0CC3-2644-4E7C-BCD1-9D1E3572F69F_1_102_o" src="https://github.com/user-attachments/assets/25bde055-559d-48ea-8844-8a410a6b72cf" />

&nbsp;

**Real-time web search** <font color="gray"><em>useful</em></font>

<img width="320" alt="CB1869BC-EB98-4D52-A4A5-920943308173_1_102_o" src="https://github.com/user-attachments/assets/e815cea4-d9b5-41fa-9def-489f5653753c" />

&nbsp;

**PDF scanning** <font color="gray"><em>also pretty useful</em></font>

<img width="320" alt="FA865ED0-014F-4F47-8D48-2A9E62942409_1_102_o" src="https://github.com/user-attachments/assets/6e39bf19-551d-4dd4-afd9-9e3e25a46c23" />

&nbsp;

**Image scanning** <font color="gray"><em>no API keys to see here</em></font>

<img width="320" alt="1FEE38EA-C8C6-4ADA-A75C-E03885332A5F_1_102_o" src="https://github.com/user-attachments/assets/0a3af270-4944-478d-b809-9de9a00c7bf8" />

&nbsp;

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
