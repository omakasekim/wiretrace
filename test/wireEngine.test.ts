import { describe, expect, it } from 'vitest';
import { buildJwtPresets, inspectJwtAndCookie, parseSseStream, SSE_PRESETS } from '../src/core/wireEngine.ts';

describe('wiretrace SSE, Webhook & JWT Security Engine', () => {
  it('parses SSE streams, assembles token deltas, and flags malformed JSON chunks', () => {
    const parsed = parseSseStream(SSE_PRESETS[0].raw);
    expect(parsed.frames.length).toBe(8);
    expect(parsed.malformedCount).toBe(1);
    expect(parsed.assembledText).toContain('To prevent z-index stacking traps');
    expect(parsed.totalDurationMs).toBeGreaterThan(200);
  });

  it('audits hardened vs. vulnerable JWT and Set-Cookie directives accurately', () => {
    const presets = buildJwtPresets(1_764_000_000);
    const hardened = inspectJwtAndCookie(presets[0].jwt, presets[0].cookie, 1_764_000_000);
    expect(hardened.validFormat).toBe(true);
    expect(hardened.score).toBe(100);
    expect(hardened.isExpired).toBe(false);

    const vuln = inspectJwtAndCookie(presets[1].jwt, presets[1].cookie, 1_764_000_000);
    expect(vuln.isExpired).toBe(true);
    expect(vuln.score).toBeLessThan(40);
    expect(vuln.findings.some((f) => f.severity === 'critical' && f.rule === 'Algorithm Verification')).toBe(true);
    expect(vuln.findings.some((f) => f.severity === 'critical' && f.rule === 'SameSite=None Without Secure')).toBe(true);
  });
});
