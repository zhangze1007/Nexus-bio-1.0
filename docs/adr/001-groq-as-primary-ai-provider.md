# ADR-001: Groq as Primary AI Provider

## Status

Accepted

## Context

Nexus-Bio needs a fast, cost-effective LLM for the `/api/analyze` endpoint that handles scientific literature analysis, pathway design, and Socratic questioning. The platform processes user queries in real-time and needs sub-second response times for a good UX.

**Options considered:**
1. OpenAI GPT-4 — high quality, expensive ($30/1M tokens), ~2s latency
2. Groq llama-3.3-70b-versatile — fast inference, free tier (1000 req/day), ~0.5s latency
3. Google Gemini 2.0-flash-lite — free tier (250 req/day), ~1s latency
4. Anthropic Claude — high quality, no free tier, ~2s latency

## Decision

**Groq as primary, Gemini as fallback.**

Request chain:
1. Groq `llama-3.3-70b-versatile` — primary (1000 req/day, fastest)
2. Groq `llama3-70b-8192` — Groq backup
3. Gemini `gemini-2.0-flash-lite` — Google fallback (250 req/day)
4. Gemini `gemini-1.5-flash` — final fallback
5. 503 error — all providers down

## Consequences

**Positive:**
- Sub-second response times for 95% of requests
- Zero cost within free tier limits
- Automatic failover across 4 models

**Negative:**
- Groq free tier limited to 1000 req/day
- Model quality lower than GPT-4/Claude for complex scientific reasoning
- Two separate API key management overhead

**Mitigations:**
- Rate limiting at 10 req/min per IP
- Domain classification rejects off-domain queries before calling LLM
- Caching layer (future) for repeated queries
