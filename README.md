# Hugo

Hugo is an AI assistant with a deliberate character. He presents as a dry, curious British gentleman — knowledgeable and warm, never pretending to be human, occasionally funny. Every time he explains something, he reaches for one analogy drawn from some unexpected corner (cooking, carpentry, weather, games) and the UI keeps a running log of every domain he's pulled from. It's a small thing but it gives conversations a kind of personality that generic chatbots don't have.

Under the hood it's a full-stack project built the way I'd build something real: hand-written agent loop, streaming WebSocket, hybrid RAG retrieval, Redis handling seven distinct jobs, the works. No LangChain.

---

## What's actually in here

**The character.** Hugo's persona lives in the system prompt and in the analogy-tagging convention. Each response that explains a concept includes a hidden domain tag the frontend reads to populate the analogy log sidebar. Pure factual questions get straight answers — no forced metaphors.

**The agent loop** (`backend/app/orchestrator/loop.py`) is about 250 lines and handles streaming, parallel tool execution, cancellation, and history compression without any orchestration framework. When the conversation history gets too long, it compresses old turns into a rolling summary using Claude Haiku before the context window becomes a problem.

**RAG retrieval** runs vector search and BM25 in parallel, normalises both score distributions, and merges them with a configurable alpha weight. The ingestion side is a stub — the retrieval path works.

**Redis is doing seven things:** session storage, a cancel pub/sub bus, rate limiting, idempotency keys, a hot conversation cache, distributed tool locks, and connection registry. Sessions fail closed; everything else fails open.

**The frontend** is Next.js 14 with a Zustand store sliced into four concerns (conversations, messages, connection, streaming). The WebSocket client reconnects with exponential backoff. The analogy sidebar sits to the right and fills up as you chat.

---

## Running it

You'll need Python 3.11, Node 20, and Docker for Postgres and Redis.

```bash
cp .env.example .env
# add your ANTHROPIC_API_KEY and VOYAGE_API_KEY

docker compose up postgres redis -d

cd backend
pip install -e ".[dev]"
alembic upgrade head
python -m app.seed

uvicorn app.main:app --reload --port 8000
```

```bash
# in another terminal
cd frontend
npm install
npm run dev
```

Visit `http://localhost:3000`, enter any email, click dev login.

**No API keys?** Run with `MOCK_PROVIDERS=true` and the whole thing works offline with deterministic fake responses. Tests use this too.

```bash
MOCK_PROVIDERS=true uvicorn app.main:app --reload --port 8000
```

```bash
cd backend && MOCK_PROVIDERS=true pytest -v
# 11 passed in 0.16s
```

---

## Testing the WebSocket directly

```bash
# brew install websocat

curl -c /tmp/hugo.txt -X POST http://localhost:8000/api/auth/dev-login \
  -H 'Content-Type: application/json' \
  -d '{"email":"dev@hugo.local","display_name":"Dev"}'

CONV_ID=$(curl -s -b /tmp/hugo.txt -X POST http://localhost:8000/api/conversations \
  -H 'Content-Type: application/json' \
  -d '{"title":"test"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

SESSION=$(grep session_token /tmp/hugo.txt | awk '{print $NF}')
websocat "ws://localhost:8000/ws" --header "Cookie: session_token=${SESSION}"
```

Then:
```json
{"type":"handshake","conversation_id":"PASTE_CONV_ID"}
{"type":"message","content":"What time is it?","client_message_id":"test-001"}
```

You'll get streaming `delta` frames and then a `done` frame with token counts. Send `{"type":"cancel"}` to stop mid-stream.

---

## Stack

| | |
|---|---|
| Backend | Python 3.11, FastAPI async, SQLAlchemy 2.0 |
| Database | PostgreSQL 16 + pgvector (HNSW + GIN indexes) |
| Cache | Redis 7 |
| LLM | Anthropic `claude-sonnet-4-5`, extended thinking, prompt caching |
| Embeddings | Voyage AI `voyage-3`, 1024-dim |
| Frontend | Next.js 14 App Router, TypeScript, Tailwind, Zustand |
| Agent loop | Hand-written — no LangChain / LangGraph |

---

## Extending things

**Add a tool** — subclass `Tool` in `backend/app/tools/`, implement `async def run`, register it in `build_default_registry()`. The loop picks it up automatically.

**Swap the LLM** — implement the `LLMProvider` protocol (one method: `stream_message`) and wire it in `_get_providers()` in `api/websocket.py`.

**Implement RAG ingestion** — the stub is in `backend/app/rag/retriever.py`. Chunk the text, call `embed.embed()`, insert `Chunk` rows. Retrieval already works.

**Real auth** — replace the `dev-login` route with an OAuth callback. The session cookie plumbing is already there end-to-end.

**Persistent DB connections** — swap `NullPool` for `AsyncAdaptedQueuePool` with `pool_size=10` in `db/session.py` and `alembic/env.py`.
