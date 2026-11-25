import { describe, expect, it } from 'vitest';
import {
  autoRepairSseJson,
  buildJwtPresets,
  computeHmacSha256Hex,
  DEMO_WEBHOOKS,
  generateCurlSnippet,
  hardenSetCookieHeader,
  inspectJwtAndCookie,
  parseSseStream,
  SSE_PRESETS,
} from '../src/core/wireEngine.ts';

describe('wiretrace SSE, Webhook & JWT Security Engine', () => {
  it('parses SSE streams, computes TTFT/p95, flags malformed JSON, and auto-repairs chunks', () => {
    const parsed = parseSseStream(SSE_PRESETS[0].raw);
    expect(parsed.frames.length).toBe(8);
    expect(parsed.malformedCount).toBe(1);
    expect(parsed.ttftMs).toBeGreaterThan(0);
    expect(parsed.p95LatencyMs).toBeGreaterThan(0);
    expect(parsed.assembledText).toContain('To prevent z-index stacking traps');

    const repaired = parseSseStream(autoRepairSseJson(SSE_PRESETS[0].raw));
    expect(repaired.malformedCount).toBe(0);
  });

  it('computes real WebCrypto HMAC-SHA256 digests and generates curl replay commands', async () => {
    const hex = await computeHmacSha256Hex('test-secret', '{"ok":true}');
    expect(hex.length).toBe(64);
    const curl = generateCurlSnippet(DEMO_WEBHOOKS[0], '{"ok":true}', hex);
    expect(curl).toContain(`X-Wiretrace-Signature: sha256=${hex}`);
  });

  it('audits hardened vs. vulnerable JWT and auto-hardens weak Set-Cookie directives', () => {
    const presets = buildJwtPresets(1_764_000_000);
    const hardened = inspectJwtAndCookie(presets[0].jwt, presets[0].cookie, 1_764_000_000);
    expect(hardened.validFormat).toBe(true);
    expect(hardened.score).toBe(100);

    const vuln = inspectJwtAndCookie(presets[1].jwt, presets[1].cookie, 1_764_000_000);
    expect(vuln.score).toBeLessThan(40);

    const fixedCookie = hardenSetCookieHeader(presets[1].cookie);
    expect(fixedCookie).toContain('HttpOnly; Secure; SameSite=Strict');
  });
});
