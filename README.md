# wiretrace

[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-22d3ee?style=flat-square)](https://omakasekim.github.io/wiretrace/)
[![License: MIT](https://img.shields.io/badge/License-MIT-10b981?style=flat-square)](LICENSE)

> **Interactive 3-mode protocol workbench:** SSE & LLM token stream debugger, Webhook payload mutator & replay lab, and JWT / OAuth / `Set-Cookie` security X-Ray.

## Modes
1. **SSE & Token Stream Lab** — Frame-by-frame playback scrubber, inter-event latency waterfall, assembled token preview, and malformed JSON chunk highlighting.
2. **Webhook Capture & Replay** — Inspect captured webhook headers, query parameters, HMAC status, mutate JSON payloads inline, and simulate replay deliveries.
3. **Auth, JWT & Cookie X-Ray** — Client-side JWT header/claim decoding, token TTL lifecycle visualization, and automated checks for `alg:none`, missing/expired `exp`, `HttpOnly`, `Secure`, and `SameSite`.

## Quickstart

```bash
npm install
npm run dev
```

## Architecture
- Pure TypeScript wire parsers & security auditors in `src/core/wireEngine.ts` (zero backend, zero external API keys).
- Dark engineering workbench UI built with React 18, TypeScript, Tailwind CSS, and Vite (`base: './'` for static GitHub Pages deployment).
