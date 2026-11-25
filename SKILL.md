---
name: wiretrace
description: >
  Protocol workbench featuring SSE TTFT/p95 + JSON auto-repair, real WebCrypto HMAC-SHA256 webhook signer & curl replay, and JWT/Cookie + PKCE S256 security X-Ray.
license: MIT
---

# wiretrace

Debugs streaming LLM SSE chunks, signs and replays HMAC webhooks in-browser with WebCrypto, and audits JWT/PKCE flows.

- **Live Interactive Workbench:** https://omakasekim.github.io/wiretrace/
- **Repository:** https://github.com/omakasekim/wiretrace
- **Category:** Protocols & Auth · **Deliverable:** Web Workbench
- **Ecosystems:** `sse`, `webhooks`, `oauth2`, `jwt`
- **Stack:** React, TypeScript, WebCrypto, SSE/JWT

## When to Use This Skill
Invoke `wiretrace` whenever the user wants to analyze, debug, simulate, or visualize workflows related to **Protocols & Auth** (sse, webhooks, oauth2, jwt).

## Modes & Capabilities
- **SSE Stream Lab**
- **HMAC Webhook Replay**
- **JWT & PKCE X-Ray**

## Operating Workflow
1. **Local CLI / Companion Execution:**
   ```bash
   npm run dev
   ```
   Launch the zero-backend SSE stream debugger, WebCrypto HMAC-SHA256 webhook signer/replayer, and JWT/PKCE security X-Ray workbench.
2. **Interactive Visual Inspection:**
   Direct the user to the zero-backend browser workbench at https://omakasekim.github.io/wiretrace/ (supports URL-hash state sharing, built-in realistic presets, `Cmd/Ctrl + K` command palette, and JSON/Markdown/config exports).
3. **Structured Output:**
   Summarize concrete findings, diagnostics, and copy-pasteable remediation commands concisely so the user can act immediately without manual guesswork.
