import { useEffect, useMemo, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Download,
  KeyRound,
  Pause,
  Play,
  Radio,
  RotateCw,
  Send,
  ShieldCheck,
  Sparkles,
  Wand2,
  Webhook,
} from 'lucide-react';
import {
  autoRepairSseJson,
  buildJwtPresets,
  computeHmacSha256Hex,
  DEMO_WEBHOOKS,
  encodeBase64UrlJson,
  generateCurlSnippet,
  generatePkcePair,
  hardenSetCookieHeader,
  inspectJwtAndCookie,
  parseSseStream,
  SSE_PRESETS,
  type WebhookEvent,
} from './core/wireEngine.ts';

type WireMode = 'sse' | 'webhook' | 'jwt';

export function App() {
  const [mode, setMode] = useState<WireMode>('sse');

  // Mode A: SSE Stream state
  const [ssePresetId, setSsePresetId] = useState<string>(SSE_PRESETS[0].id);
  const [sseRaw, setSseRaw] = useState<string>(SSE_PRESETS[0].raw);
  const [sseFrameIdx, setSseFrameIdx] = useState(0);
  const [ssePlaying, setSsePlaying] = useState(false);

  // Mode B: Webhook state
  const [webhooks, setWebhooks] = useState<WebhookEvent[]>(DEMO_WEBHOOKS);
  const [selectedWhId, setSelectedWhId] = useState<string>(DEMO_WEBHOOKS[0].id);
  const [editablePayload, setEditablePayload] = useState<string>(DEMO_WEBHOOKS[0].payload);
  const [hmacSecret, setHmacSecret] = useState<string>('whsec_aether_local_demo_key');
  const [liveHmacHex, setLiveHmacHex] = useState<string>('');
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [replayBanner, setReplayBanner] = useState<string | null>(null);

  // Mode C: JWT & Cookie X-Ray state
  const jwtPresets = useMemo(() => buildJwtPresets(), []);
  const [jwtPresetId, setJwtPresetId] = useState<string>(jwtPresets[0].id);
  const [jwtRaw, setJwtRaw] = useState<string>(jwtPresets[0].jwt);
  const [cookieRaw, setCookieRaw] = useState<string>(jwtPresets[0].cookie);
  const [pkce, setPkce] = useState<{ verifier: string; challenge: string } | null>(null);

  useEffect(() => {
    let active = true;
    computeHmacSha256Hex(hmacSecret, editablePayload).then((hex) => {
      if (active) setLiveHmacHex(hex);
    });
    return () => {
      active = false;
    };
  }, [hmacSecret, editablePayload]);

  const sseParsed = useMemo(() => parseSseStream(sseRaw), [sseRaw]);
  const activeFrame = sseParsed.frames[Math.min(sseFrameIdx, Math.max(0, sseParsed.frames.length - 1))];
  const assembledUpToFrame = useMemo(
    () => sseParsed.frames.slice(0, sseFrameIdx + 1).map((f) => f.tokenChunk).join(''),
    [sseParsed.frames, sseFrameIdx],
  );
  const maxFrameMs = Math.max(1, ...sseParsed.frames.map((f) => f.deltaMs));

  useEffect(() => {
    if (!ssePlaying || sseParsed.frames.length === 0) return;
    const t = setInterval(() => {
      setSseFrameIdx((prev) => (prev + 1 < sseParsed.frames.length ? prev + 1 : 0));
    }, 650);
    return () => clearInterval(t);
  }, [ssePlaying, sseParsed.frames.length]);

  const selectedWh = webhooks.find((w) => w.id === selectedWhId) ?? webhooks[0];
  const jwtAudit = useMemo(() => inspectJwtAndCookie(jwtRaw, cookieRaw), [jwtRaw, cookieRaw]);

  const selectWebhook = (wh: WebhookEvent) => {
    setSelectedWhId(wh.id);
    setEditablePayload(wh.payload);
  };

  const replayMutatedWebhook = () => {
    if (!selectedWh) return;
    let validJson = true;
    try {
      JSON.parse(editablePayload);
    } catch {
      validJson = false;
    }
    const replayed: WebhookEvent = {
      ...selectedWh,
      id: `wh_replay_${Date.now().toString().slice(-4)}`,
      receivedAt: new Date().toTimeString().slice(0, 8),
      statusCode: validJson ? 200 : 400,
      latencyMs: Math.round(22 + Math.random() * 65),
      signatureValid: true,
      payload: editablePayload,
    };
    setWebhooks((prev) => [replayed, ...prev]);
    setSelectedWhId(replayed.id);
    setReplayBanner(
      validJson
        ? `Replayed ${replayed.eventType} → HTTP 200 (${replayed.latencyMs}ms)`
        : 'Replay failed with HTTP 400 (malformed JSON payload)',
    );
    setTimeout(() => setReplayBanner(null), 2600);
  };

  const exportReport = () => {
    const payload =
      mode === 'sse'
        ? sseParsed
        : mode === 'webhook'
          ? { webhooks }
          : jwtAudit;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `wiretrace-${mode}-report.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#090D16] text-slate-100">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-800 bg-[#111827] px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-500/40 bg-cyan-500/15 text-cyan-300">
              <Radio className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-slate-50">wiretrace</h1>
                <span className="rounded bg-cyan-500/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-cyan-300">
                  3-MODE WIRE LAB
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                SSE Token Streams · Webhook Replay · JWT &amp; Cookie Security X-Ray
              </p>
            </div>
          </div>

          <div className="flex rounded-lg border border-slate-700 bg-[#090D16] p-0.5 text-xs">
            {(
              [
                { id: 'sse', label: 'SSE Stream Lab', icon: Radio },
                { id: 'webhook', label: 'Webhook Replay', icon: Webhook },
                { id: 'jwt', label: 'Auth / JWT X-Ray', icon: KeyRound },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition ${
                  mode === m.id ? 'bg-cyan-500/20 text-cyan-200' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <m.icon className="h-3.5 w-3.5" />
                <span>{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={exportReport}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#090D16] px-2.5 py-1 text-xs text-slate-200 hover:border-cyan-500"
        >
          <Download className="h-3.5 w-3.5 text-cyan-400" /> Export JSON
        </button>
      </header>

      {/* MODE A: SSE & TOKEN STREAM LAB */}
      {mode === 'sse' && (
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-[#0F172A] px-4 py-2 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              {SSE_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setSsePresetId(p.id);
                    setSseRaw(p.raw);
                    setSseFrameIdx(0);
                    setSsePlaying(false);
                  }}
                  className={`rounded-md border px-2.5 py-1 ${
                    ssePresetId === p.id
                      ? 'border-cyan-500/60 bg-cyan-500/15 font-semibold text-cyan-200'
                      : 'border-slate-700 bg-[#111827] text-slate-300'
                  }`}
                >
                  {p.name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSsePlaying((v) => !v)}
                className="ml-2 inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 font-semibold text-emerald-200"
              >
                {ssePlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                <span>{ssePlaying ? 'Pause Stream' : 'Play Frames'}</span>
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-3 font-mono text-[11px]">
              <span className="text-slate-300">{sseParsed.frames.length} frames</span>
              <span className="text-sky-300">TTFT {sseParsed.ttftMs}ms</span>
              <span className="text-amber-300">p95 {sseParsed.p95LatencyMs}ms</span>
              <span className="text-cyan-300">{sseParsed.tokensPerSec} tok/s</span>
              <span className={sseParsed.malformedCount ? 'text-rose-400' : 'text-emerald-400'}>
                {sseParsed.malformedCount} malformed
              </span>
              {sseParsed.malformedCount > 0 && (
                <button
                  type="button"
                  onClick={() => setSseRaw((prev) => autoRepairSseJson(prev))}
                  className="inline-flex items-center gap-1 rounded border border-amber-500/50 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-200 hover:bg-amber-500/25"
                >
                  <Wand2 className="h-3 w-3" /> Auto-Repair JSON
                </button>
              )}
            </div>
          </div>

          <div className="grid flex-1 overflow-hidden lg:grid-cols-[0.95fr_1.3fr]">
            {/* Raw SSE Editor */}
            <section className="flex flex-col overflow-hidden border-r border-slate-800">
              <div className="border-b border-slate-800 bg-[#111827] px-3.5 py-2 text-xs font-semibold text-slate-300">
                Raw EventStream (`text/event-stream`) — paste any SSE log
              </div>
              <textarea
                value={sseRaw}
                onChange={(e) => {
                  setSsePresetId('custom');
                  setSseRaw(e.target.value);
                }}
                spellCheck={false}
                className="flex-1 resize-none bg-[#090D16] p-3.5 font-mono text-xs leading-5 text-cyan-100 focus:outline-none"
              />
            </section>

            {/* Latency Waterfall + Assembled Preview + Frame Inspector */}
            <section className="flex flex-col space-y-4 overflow-y-auto bg-[#111827] p-5">
              {/* Assembled Output Preview */}
              <div className="rounded-xl border border-slate-800 bg-[#090D16] p-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold uppercase tracking-wider text-slate-300">
                    Assembled Stream Preview (Frame #{sseFrameIdx + 1}/{sseParsed.frames.length})
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={Math.max(0, sseParsed.frames.length - 1)}
                    value={sseFrameIdx}
                    onChange={(e) => {
                      setSsePlaying(false);
                      setSseFrameIdx(Number(e.target.value));
                    }}
                    className="w-40 accent-cyan-400"
                  />
                </div>
                <div className="mt-2.5 min-h-[54px] rounded-lg border border-slate-800 bg-[#111827] p-3 font-mono text-xs text-slate-100">
                  {assembledUpToFrame || '(waiting for token delta...)'}
                  <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-cyan-400 align-middle" />
                </div>
              </div>

              {/* Inter-Event Latency Bar Timeline */}
              <div className="space-y-2 rounded-xl border border-slate-800 bg-[#090D16] p-4">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Frame-by-Frame Inter-Event Latency Waterfall
                </div>
                <div className="space-y-1.5">
                  {sseParsed.frames.map((f) => {
                    const active = f.index === sseFrameIdx;
                    const barW = Math.max(6, Math.round((f.deltaMs / maxFrameMs) * 100));
                    return (
                      <button
                        key={f.index}
                        type="button"
                        onClick={() => {
                          setSsePlaying(false);
                          setSseFrameIdx(f.index);
                        }}
                        className={`block w-full rounded-lg border p-2.5 text-left transition ${
                          f.malformed
                            ? 'border-rose-500/60 bg-rose-950/20'
                            : active
                              ? 'border-cyan-400 bg-cyan-500/10'
                              : 'border-slate-800 bg-[#111827] hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between font-mono text-[11px]">
                          <span className="font-semibold text-slate-100">
                            #{f.index + 1} · {f.event} {f.id ? `(${f.id})` : ''}
                          </span>
                          <span className={f.malformed ? 'text-rose-300' : 'text-cyan-300'}>
                            +{f.deltaMs}ms (t={f.cumulativeMs}ms)
                          </span>
                        </div>
                        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                          <div
                            className={`h-full rounded-full ${f.malformed ? 'bg-rose-500' : f.deltaMs > 100 ? 'bg-amber-400' : 'bg-cyan-400'}`}
                            style={{ width: `${barW}%` }}
                          />
                        </div>
                        {f.malformed ? (
                          <div className="mt-1 text-[11px] font-semibold text-rose-300">
                            Malformed JSON chunk: {f.errorReason}
                          </div>
                        ) : (
                          <div className="mt-1 truncate font-mono text-[10px] text-slate-400">{f.rawData}</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {activeFrame && (
                <div className="rounded-xl border border-slate-800 bg-[#090D16] p-4">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-300">Selected Frame Raw Data</div>
                  <pre className="mt-2 overflow-x-auto font-mono text-xs text-slate-200">{activeFrame.rawData}</pre>
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {/* MODE B: WEBHOOK CAPTURE & REPLAY */}
      {mode === 'webhook' && (
        <div className="grid flex-1 overflow-hidden lg:grid-cols-[0.9fr_1.35fr]">
          {/* Captured Deliveries List */}
          <section className="flex flex-col overflow-hidden border-r border-slate-800 bg-[#090D16]">
            <div className="border-b border-slate-800 bg-[#111827] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-300">
              Captured Webhook Deliveries ({webhooks.length})
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-3.5">
              {webhooks.map((wh) => {
                const active = wh.id === selectedWh?.id;
                const statusColor =
                  wh.statusCode >= 500
                    ? 'bg-rose-500/20 text-rose-300'
                    : wh.statusCode >= 400
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-emerald-500/20 text-emerald-300';
                return (
                  <button
                    key={wh.id}
                    type="button"
                    onClick={() => selectWebhook(wh)}
                    className={`block w-full rounded-xl border p-3.5 text-left transition ${
                      active ? 'border-cyan-400 bg-[#111827]' : 'border-slate-800 bg-[#111827]/70 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between font-mono text-[11px]">
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-cyan-300">{wh.provider}</span>
                      <span className={`rounded px-1.5 py-0.5 font-bold ${statusColor}`}>{wh.statusCode}</span>
                    </div>
                    <div className="mt-1.5 font-mono text-xs font-bold text-slate-100">{wh.eventType}</div>
                    <div className="mt-1 flex items-center justify-between font-mono text-[10px] text-slate-400">
                      <span>{wh.path}</span>
                      <span>{wh.latencyMs}ms · {wh.receivedAt}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Payload Mutator & Replay Panel */}
          <section className="flex flex-col space-y-4 overflow-y-auto bg-[#111827] p-5">
            {replayBanner && (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-xs text-emerald-200">
                <CheckCircle2 className="h-4 w-4" />
                <span>{replayBanner}</span>
              </div>
            )}

            {selectedWh && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-[#090D16] p-4">
                  <div>
                    <div className="flex items-center gap-2 font-mono text-xs">
                      <span className="rounded bg-cyan-500/15 px-2 py-0.5 font-bold text-cyan-300">{selectedWh.method}</span>
                      <span className="text-slate-200">{selectedWh.path}</span>
                      <span className={`rounded px-2 py-0.5 text-[10px] ${selectedWh.signatureValid ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                        {selectedWh.signatureValid ? 'HMAC VALID' : 'SIGNATURE MISMATCH'}
                      </span>
                    </div>
                    <div className="mt-1 font-mono text-sm font-bold text-slate-50">{selectedWh.eventType}</div>
                  </div>
                  <button
                    type="button"
                    onClick={replayMutatedWebhook}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-cyan-400"
                  >
                    <Send className="h-3.5 w-3.5" /> Mutate &amp; Replay
                  </button>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-slate-800 bg-[#090D16] p-3.5">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Request Headers</div>
                    <div className="mt-2 space-y-1 font-mono text-[11px]">
                      {Object.entries(selectedWh.headers).map(([k, v]) => (
                        <div key={k} className="break-all">
                          <span className="text-cyan-300">{k}:</span> <span className="text-slate-300">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-[#090D16] p-3.5">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Query Parameters</div>
                    <div className="mt-2 space-y-1 font-mono text-[11px]">
                      {Object.entries(selectedWh.query).map(([k, v]) => (
                        <div key={k}>
                          <span className="text-violet-300">{k}</span> = <span className="text-slate-200">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-[#090D16] p-3.5 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-bold uppercase tracking-wider text-emerald-300">
                      Real WebCrypto HMAC-SHA256 Signer
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(generateCurlSnippet(selectedWh, editablePayload, liveHmacHex));
                          setCopiedCurl(true);
                          setTimeout(() => setCopiedCurl(false), 1600);
                        } catch {}
                      }}
                      className="inline-flex items-center gap-1 rounded border border-slate-700 bg-[#111827] px-2 py-0.5 font-mono text-[10px] text-sky-300 hover:border-sky-500"
                    >
                      {copiedCurl ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      Copy curl Replay
                    </button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[0.8fr_1.4fr]">
                    <input
                      value={hmacSecret}
                      onChange={(e) => setHmacSecret(e.target.value)}
                      placeholder="Signing secret..."
                      className="rounded border border-slate-700 bg-[#111827] px-2.5 py-1.5 font-mono text-[11px] text-amber-200 focus:border-cyan-500 focus:outline-none"
                    />
                    <div className="truncate rounded border border-slate-800 bg-[#111827] px-2.5 py-1.5 font-mono text-[11px] text-emerald-300">
                      sha256={liveHmacHex || 'computing...'}
                    </div>
                  </div>
                </div>

                <div className="flex flex-1 flex-col rounded-xl border border-slate-800 bg-[#090D16] overflow-hidden">
                  <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/60 px-3.5 py-2 text-xs font-semibold text-slate-300">
                    <span>Editable JSON Payload (mutate fields then click Replay)</span>
                    <button
                      type="button"
                      onClick={() => setEditablePayload(selectedWh.payload)}
                      className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200"
                    >
                      <RotateCw className="h-3 w-3" /> Reset
                    </button>
                  </div>
                  <textarea
                    value={editablePayload}
                    onChange={(e) => setEditablePayload(e.target.value)}
                    spellCheck={false}
                    className="min-h-[200px] flex-1 resize-none bg-[#090D16] p-3.5 font-mono text-xs leading-5 text-emerald-100 focus:outline-none"
                  />
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {/* MODE C: AUTH, JWT & COOKIE X-RAY */}
      {mode === 'jwt' && (
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-[#0F172A] px-4 py-2 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              {jwtPresets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setJwtPresetId(p.id);
                    setJwtRaw(p.jwt);
                    setCookieRaw(p.cookie);
                  }}
                  className={`rounded-md border px-2.5 py-1 ${
                    jwtPresetId === p.id
                      ? 'border-cyan-500/60 bg-cyan-500/15 font-semibold text-cyan-200'
                      : 'border-slate-700 bg-[#111827] text-slate-300'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
              <button
                type="button"
                onClick={() => setCookieRaw((c) => hardenSetCookieHeader(c))}
                className="inline-flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-200 hover:bg-emerald-500/25"
              >
                <Wand2 className="h-3 w-3" /> Harden Cookie
              </button>
              <button
                type="button"
                onClick={() => {
                  const now = Math.floor(Date.now() / 1000);
                  const h = { ...(jwtAudit.header ?? { typ: 'JWT' }), alg: 'RS256' };
                  const p = { ...(jwtAudit.payload ?? { sub: 'usr_demo' }), iss: 'https://auth.aether.dev', aud: 'api.aether.dev', iat: now, exp: now + 3600 };
                  setJwtRaw(`${encodeBase64UrlJson(h)}.${encodeBase64UrlJson(p)}.ReSignedDemoRS256`);
                }}
                className="inline-flex items-center gap-1 rounded border border-sky-500/40 bg-sky-500/15 px-2 py-0.5 text-[11px] text-sky-200 hover:bg-sky-500/25"
              >
                <Sparkles className="h-3 w-3" /> Re-Sign RS256 (+1h)
              </button>
              <button
                type="button"
                onClick={async () => setPkce(await generatePkcePair())}
                className="inline-flex items-center gap-1 rounded border border-violet-500/40 bg-violet-500/15 px-2 py-0.5 text-[11px] text-violet-200 hover:bg-violet-500/25"
              >
                Generate PKCE S256
              </button>
              <span>
                Score:{' '}
                <strong className={jwtAudit.score >= 80 ? 'text-emerald-400' : jwtAudit.score >= 50 ? 'text-amber-300' : 'text-rose-400'}>
                  {jwtAudit.score}/100
                </strong>
              </span>
            </div>
          </div>

          <div className="grid flex-1 overflow-hidden lg:grid-cols-[0.95fr_1.25fr]">
            {/* Left Inputs */}
            <section className="flex flex-col space-y-4 overflow-y-auto border-r border-slate-800 p-5">
              <div className="rounded-xl border border-slate-800 bg-[#111827] p-4">
                <label className="text-xs font-bold uppercase tracking-wider text-cyan-300">Encoded JWT Token</label>
                <textarea
                  value={jwtRaw}
                  onChange={(e) => {
                    setJwtPresetId('custom');
                    setJwtRaw(e.target.value);
                  }}
                  spellCheck={false}
                  className="mt-2 h-28 w-full resize-none rounded-lg border border-slate-700 bg-[#090D16] p-3 font-mono text-xs text-amber-200 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="rounded-xl border border-slate-800 bg-[#111827] p-4">
                <label className="text-xs font-bold uppercase tracking-wider text-violet-300">`Set-Cookie` Header Rule</label>
                <textarea
                  value={cookieRaw}
                  onChange={(e) => {
                    setJwtPresetId('custom');
                    setCookieRaw(e.target.value);
                  }}
                  spellCheck={false}
                  className="mt-2 h-20 w-full resize-none rounded-lg border border-slate-700 bg-[#090D16] p-3 font-mono text-xs text-sky-200 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-slate-800 bg-[#111827] p-3.5">
                  <div className="text-xs font-bold uppercase tracking-wider text-rose-300">Decoded Header</div>
                  <pre className="mt-2 overflow-x-auto font-mono text-[11px] text-slate-200">
                    {jwtAudit.header ? JSON.stringify(jwtAudit.header, null, 2) : 'Invalid header'}
                  </pre>
                </div>
                <div className="rounded-xl border border-slate-800 bg-[#111827] p-3.5">
                  <div className="text-xs font-bold uppercase tracking-wider text-emerald-300">Decoded Claims</div>
                  <pre className="mt-2 overflow-x-auto font-mono text-[11px] text-slate-200">
                    {jwtAudit.payload ? JSON.stringify(jwtAudit.payload, null, 2) : 'Invalid payload'}
                  </pre>
                </div>
              </div>
            </section>

            {/* Right Lifecycle Bar + Security Audit Matrix */}
            <section className="flex flex-col space-y-4 overflow-y-auto bg-[#111827] p-5">
              <div className="rounded-xl border border-slate-800 bg-[#090D16] p-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold uppercase tracking-wider text-slate-300">Token Lifecycle Window</span>
                  <span className={`font-mono font-bold ${jwtAudit.isExpired ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {jwtAudit.isExpired ? 'EXPIRED' : `${100 - jwtAudit.lifecyclePct}% TTL REMAINING`}
                  </span>
                </div>
                <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className={`h-full transition-all ${jwtAudit.isExpired ? 'bg-rose-500' : 'bg-gradient-to-r from-cyan-400 to-emerald-400'}`}
                    style={{ width: `${jwtAudit.lifecyclePct}%` }}
                  />
                </div>
                <div className="mt-2 flex justify-between font-mono text-[10px] text-slate-400">
                  <span>iat: {jwtAudit.issuedAt ?? 'n/a'}</span>
                  <span>exp: {jwtAudit.expiresAt ?? 'missing'}</span>
                </div>
              </div>

              {pkce && (
                <div className="rounded-xl border border-violet-500/40 bg-violet-500/10 p-3.5 font-mono text-[11px] space-y-1">
                  <div className="font-bold text-violet-200">OAuth2 PKCE Pair (WebCrypto SHA-256)</div>
                  <div className="break-all text-slate-300">code_verifier: <span className="text-sky-300">{pkce.verifier}</span></div>
                  <div className="break-all text-slate-300">code_challenge (S256): <span className="text-emerald-300">{pkce.challenge}</span></div>
                </div>
              )}

              <div className="space-y-2 rounded-xl border border-slate-800 bg-[#090D16] p-4">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Automated Security Checks ({jwtAudit.findings.length})
                </div>
                {jwtAudit.findings.map((f) => (
                  <div
                    key={f.id}
                    className={`flex items-start gap-2.5 rounded-lg border p-3 text-xs ${
                      f.severity === 'critical'
                        ? 'border-rose-500/50 bg-rose-500/10 text-rose-200'
                        : f.severity === 'warning'
                          ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
                          : 'border-emerald-500/30 bg-emerald-500/5 text-emerald-200'
                    }`}
                  >
                    {f.severity === 'critical' ? (
                      <AlertOctagon className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                    ) : f.severity === 'warning' ? (
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                    ) : (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    )}
                    <div>
                      <div className="font-semibold">{f.rule}</div>
                      <div className="mt-0.5 opacity-90">{f.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
