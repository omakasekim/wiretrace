export interface SseFrame {
  index: number;
  event: string;
  id?: string;
  rawData: string;
  parsedJson?: Record<string, unknown>;
  tokenChunk: string;
  deltaMs: number;
  cumulativeMs: number;
  malformed: boolean;
  errorReason?: string;
}

export interface SseParseResult {
  frames: SseFrame[];
  assembledText: string;
  malformedCount: number;
  totalDurationMs: number;
  avgLatencyMs: number;
  tokensPerSec: number;
}

export function parseSseStream(raw: string): SseParseResult {
  const blocks = raw
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  const frames: SseFrame[] = [];
  let cumulativeMs = 0;
  let assembledText = '';

  blocks.forEach((block, idx) => {
    let event = 'message';
    let id: string | undefined;
    const dataLines: string[] = [];
    let explicitMs: number | null = null;

    for (const line of block.split('\n')) {
      if (line.startsWith(':')) {
        const msMatch = /(\d+)\s*ms/.exec(line);
        if (msMatch) explicitMs = Number(msMatch[1]);
        continue;
      }
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('id:')) id = line.slice(3).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
    }

    const rawData = dataLines.join('\n');
    const deltaMs = explicitMs ?? (idx === 0 ? 140 : 28 + ((idx * 37) % 95));
    cumulativeMs += deltaMs;

    let malformed = false;
    let errorReason: string | undefined;
    let parsedJson: Record<string, unknown> | undefined;
    let tokenChunk = '';

    if (rawData === '[DONE]') {
      tokenChunk = '';
    } else if (rawData.startsWith('{') || rawData.startsWith('[')) {
      try {
        const parsed = JSON.parse(rawData) as Record<string, unknown>;
        parsedJson = parsed;
        if (typeof parsed.delta === 'string') tokenChunk = parsed.delta;
        else if (typeof parsed.token === 'string') tokenChunk = parsed.token;
        else if (typeof parsed.text === 'string') tokenChunk = parsed.text;
        else if (
          Array.isArray(parsed.choices) &&
          parsed.choices[0] &&
          typeof parsed.choices[0] === 'object'
        ) {
          const c0 = parsed.choices[0] as { delta?: { content?: string } };
          tokenChunk = c0.delta?.content ?? '';
        }
      } catch (err) {
        malformed = true;
        errorReason = err instanceof Error ? err.message : 'Invalid JSON chunk';
      }
    } else if (rawData.length === 0) {
      malformed = true;
      errorReason = 'Empty SSE data payload';
    } else {
      tokenChunk = rawData;
    }

    assembledText += tokenChunk;
    frames.push({
      index: idx,
      event,
      id,
      rawData,
      parsedJson,
      tokenChunk,
      deltaMs,
      cumulativeMs,
      malformed,
      errorReason,
    });
  });

  const malformedCount = frames.filter((f) => f.malformed).length;
  const avgLatencyMs = frames.length ? Math.round(cumulativeMs / frames.length) : 0;
  const tokensPerSec = cumulativeMs > 0 ? Number(((frames.filter((f) => f.tokenChunk).length / cumulativeMs) * 1000).toFixed(1)) : 0;

  return {
    frames,
    assembledText,
    malformedCount,
    totalDurationMs: cumulativeMs,
    avgLatencyMs,
    tokensPerSec,
  };
}

export const SSE_PRESETS = [
  {
    id: 'llm-chat',
    name: 'LLM Token Stream (+ Malformed Chunk)',
    raw: `: 165ms
id: evt_01
event: message_start
data: {"type":"start","model":"gemini-3-pro"}

: 42ms
id: evt_02
event: content_delta
data: {"delta":"To prevent "}

: 36ms
id: evt_03
event: content_delta
data: {"delta":"z-index stacking traps, "}

: 51ms
id: evt_04
event: content_delta
data: {"delta":"inspect ancestor "}

: 128ms
id: evt_05
event: content_delta
data: {"delta":"transform & opacity"

: 33ms
id: evt_06
event: content_delta
data: {"delta":"rules before raising z-index."}

: 68ms
id: evt_07
event: tool_call
data: {"tool":"inspect_stacking_context","args":{"selector":".modal"}}

: 24ms
id: evt_08
event: message_stop
data: [DONE]`,
  },
  {
    id: 'orderbook',
    name: 'Real-Time Market Feed SSE',
    raw: `: 90ms
id: seq_1001
event: tick
data: {"symbol":"ETH-USD","delta":"[tick 3241.50] ","bid":3241.5}

: 28ms
id: seq_1002
event: tick
data: {"symbol":"ETH-USD","delta":"[tick 3242.10] ","bid":3242.1}

: 31ms
id: seq_1003
event: fill
data: {"symbol":"ETH-USD","delta":"[fill 1.4 ETH] ","size":1.4}

: 22ms
id: seq_1004
event: heartbeat
data: {"delta":"[ok]"}`,
  },
] as const;

export interface WebhookEvent {
  id: string;
  provider: 'Stripe' | 'GitHub' | 'Clerk';
  eventType: string;
  method: 'POST';
  path: string;
  receivedAt: string;
  statusCode: number;
  latencyMs: number;
  signatureValid: boolean;
  headers: Record<string, string>;
  query: Record<string, string>;
  payload: string;
}

export const DEMO_WEBHOOKS: WebhookEvent[] = [
  {
    id: 'wh_01',
    provider: 'Stripe',
    eventType: 'invoice.payment_failed',
    method: 'POST',
    path: '/api/webhooks/stripe',
    receivedAt: '19:42:11.204',
    statusCode: 200,
    latencyMs: 48,
    signatureValid: true,
    headers: {
      'content-type': 'application/json',
      'stripe-signature': 't=1764067331,v1=9f4a8e21bc77d001e3a812...',
      'user-agent': 'Stripe/1.0 (+https://stripe.com/docs/webhooks)',
    },
    query: { env: 'prod', version: '2026-01' },
    payload: JSON.stringify(
      {
        id: 'evt_3Qx912Abc',
        type: 'invoice.payment_failed',
        data: { object: { invoiceId: 'in_9812', customer: 'cus_Aether01', amountDue: 4900, attemptCount: 2 } },
      },
      null,
      2,
    ),
  },
  {
    id: 'wh_02',
    provider: 'GitHub',
    eventType: 'workflow_run.completed',
    method: 'POST',
    path: '/api/webhooks/github',
    receivedAt: '19:44:05.812',
    statusCode: 500,
    latencyMs: 312,
    signatureValid: true,
    headers: {
      'content-type': 'application/json',
      'x-github-event': 'workflow_run',
      'x-hub-signature-256': 'sha256=4b88210af92c11ee7a...',
    },
    query: { repo: 'diffcanvas' },
    payload: JSON.stringify(
      {
        action: 'completed',
        workflow_run: { id: 45596729, name: 'Deploy Pages', conclusion: 'failure', head_branch: 'main' },
      },
      null,
      2,
    ),
  },
  {
    id: 'wh_03',
    provider: 'Clerk',
    eventType: 'session.revoked',
    method: 'POST',
    path: '/api/webhooks/auth',
    receivedAt: '19:46:19.044',
    statusCode: 401,
    latencyMs: 19,
    signatureValid: false,
    headers: {
      'content-type': 'application/json',
      'svix-id': 'msg_2p91aZ',
      'svix-signature': 'v1,invalid_sig_test',
    },
    query: { tenant: 'core' },
    payload: JSON.stringify(
      {
        type: 'session.revoked',
        data: { session_id: 'sess_99182', user_id: 'usr_0192', reason: 'key_rotation' },
      },
      null,
      2,
    ),
  },
];

export interface SecurityFinding {
  id: string;
  severity: 'critical' | 'warning' | 'pass';
  rule: string;
  detail: string;
}

export interface JwtAuditResult {
  validFormat: boolean;
  header: Record<string, unknown> | null;
  payload: Record<string, unknown> | null;
  signaturePreview: string;
  issuedAt?: number;
  expiresAt?: number;
  isExpired: boolean;
  lifecyclePct: number;
  cookieAttrs: Record<string, string | boolean>;
  findings: SecurityFinding[];
  score: number;
}

function decodeBase64UrlJson(segment: string): Record<string, unknown> | null {
  try {
    const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
    const pad = normalized.length % 4 ? '='.repeat(4 - (normalized.length % 4)) : '';
    const decoded = atob(normalized + pad);
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function encodeBase64UrlJson(obj: Record<string, unknown>): string {
  return btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function inspectJwtAndCookie(jwtRaw: string, setCookieRaw: string, nowSec = Math.floor(Date.now() / 1000)): JwtAuditResult {
  const parts = jwtRaw.trim().split('.');
  const validFormat = parts.length === 3;
  const header = validFormat ? decodeBase64UrlJson(parts[0]) : null;
  const payload = validFormat ? decodeBase64UrlJson(parts[1]) : null;
  const findings: SecurityFinding[] = [];

  if (!validFormat || !header || !payload) {
    findings.push({ id: 'fmt', severity: 'critical', rule: 'JWT Structure', detail: 'Token does not contain valid 3-part base64url JWT segments.' });
  } else {
    const alg = String(header.alg ?? '').toLowerCase();
    if (!alg || alg === 'none') {
      findings.push({ id: 'alg', severity: 'critical', rule: 'Algorithm Verification', detail: 'Unsigned JWT ("alg": "none") allows trivial token forgery.' });
    } else if (alg === 'hs256') {
      findings.push({ id: 'alg', severity: 'warning', rule: 'Symmetric Algorithm', detail: 'HS256 shares a symmetric secret; prefer RS256/ES256/EdDSA for multi-service verification.' });
    } else {
      findings.push({ id: 'alg', severity: 'pass', rule: 'Asymmetric Signature', detail: `Strong asymmetric algorithm "${header.alg}" configured.` });
    }

    if (typeof payload.exp !== 'number') {
      findings.push({ id: 'exp', severity: 'critical', rule: 'Missing Expiration', detail: 'JWT has no "exp" claim — stolen tokens remain valid indefinitely.' });
    } else if (payload.exp < nowSec) {
      findings.push({ id: 'exp', severity: 'critical', rule: 'Expired Token', detail: `Token expired ${Math.round((nowSec - payload.exp) / 60)} minute(s) ago.` });
    } else {
      findings.push({ id: 'exp', severity: 'pass', rule: 'Active Expiration Window', detail: `Token expires in ${Math.max(1, Math.round((payload.exp - nowSec) / 60))} minute(s).` });
    }

    if (!payload.aud || !payload.iss) {
      findings.push({ id: 'claims', severity: 'warning', rule: 'Issuer / Audience Claims', detail: 'Recommend setting both "iss" and "aud" to block cross-service replay.' });
    } else {
      findings.push({ id: 'claims', severity: 'pass', rule: 'Scoped Claims', detail: `Scoped to iss="${payload.iss}" and aud="${payload.aud}".` });
    }
  }

  // Parse Set-Cookie directives
  const cookieAttrs: Record<string, string | boolean> = {};
  const cookieParts = setCookieRaw.split(';').map((s) => s.trim()).filter(Boolean);
  for (let i = 1; i < cookieParts.length; i++) {
    const [k, v] = cookieParts[i].split('=');
    cookieAttrs[k.trim().toLowerCase()] = v !== undefined ? v.trim() : true;
  }

  if (setCookieRaw.trim()) {
    if (!cookieAttrs.httponly) {
      findings.push({ id: 'httponly', severity: 'critical', rule: 'Cookie HttpOnly', detail: 'Missing HttpOnly flag exposes session cookie to XSS document.cookie theft.' });
    } else {
      findings.push({ id: 'httponly', severity: 'pass', rule: 'Cookie HttpOnly', detail: 'HttpOnly flag blocks client-side JS access.' });
    }

    if (!cookieAttrs.secure) {
      findings.push({ id: 'secure', severity: 'warning', rule: 'Cookie Secure Flag', detail: 'Missing Secure flag permits transmission over plain HTTP.' });
    } else {
      findings.push({ id: 'secure', severity: 'pass', rule: 'Cookie Secure Flag', detail: 'Restricted to HTTPS transport.' });
    }

    const sameSite = String(cookieAttrs.samesite ?? '').toLowerCase();
    if (!sameSite) {
      findings.push({ id: 'samesite', severity: 'warning', rule: 'Cookie SameSite', detail: 'Explicitly set SameSite=Lax or Strict to harden against CSRF.' });
    } else if (sameSite === 'none' && !cookieAttrs.secure) {
      findings.push({ id: 'samesite', severity: 'critical', rule: 'SameSite=None Without Secure', detail: 'Browsers reject SameSite=None cookies unless Secure is also present.' });
    } else {
      findings.push({ id: 'samesite', severity: 'pass', rule: 'Cookie SameSite', detail: `SameSite=${cookieAttrs.samesite} configured.` });
    }
  }

  const iat = typeof payload?.iat === 'number' ? payload.iat : undefined;
  const exp = typeof payload?.exp === 'number' ? payload.exp : undefined;
  const isExpired = typeof exp === 'number' ? exp < nowSec : false;
  const lifecyclePct =
    iat !== undefined && exp !== undefined && exp > iat
      ? Math.max(0, Math.min(100, Math.round(((nowSec - iat) / (exp - iat)) * 100)))
      : isExpired
        ? 100
        : 25;

  const penalties = findings.reduce((s, f) => s + (f.severity === 'critical' ? 30 : f.severity === 'warning' ? 12 : 0), 0);

  return {
    validFormat,
    header,
    payload,
    signaturePreview: parts[2] ?? '',
    issuedAt: iat,
    expiresAt: exp,
    isExpired,
    lifecyclePct,
    cookieAttrs,
    findings,
    score: Math.max(0, 100 - penalties),
  };
}

export function buildJwtPresets(nowSec = Math.floor(Date.now() / 1000)) {
  return [
    {
      id: 'hardened',
      name: 'Hardened RS256 Session',
      jwt: `${encodeBase64UrlJson({ alg: 'RS256', typ: 'JWT', kid: 'key_2026_02' })}.${encodeBase64UrlJson({
        sub: 'usr_aether_01',
        iss: 'https://auth.aether.dev',
        aud: 'api.aether.dev',
        roles: ['admin', 'deploy:prod'],
        iat: nowSec - 900,
        exp: nowSec + 2700,
      })}.SigRS256ValidDemoPayloadSignature99182`,
      cookie: 'aether_sid=eyJhbGciOi...; Path=/; Max-Age=3600; HttpOnly; Secure; SameSite=Strict',
    },
    {
      id: 'vulnerable',
      name: 'Vulnerable alg:none + Weak Cookie',
      jwt: `${encodeBase64UrlJson({ alg: 'none', typ: 'JWT' })}.${encodeBase64UrlJson({
        sub: 'usr_guest_99',
        role: 'admin',
        iat: nowSec - 7200,
        exp: nowSec - 1200,
      })}.`,
      cookie: 'session_id=plain123; Path=/; SameSite=None',
    },
  ];
}
