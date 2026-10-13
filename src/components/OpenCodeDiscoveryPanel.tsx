"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { discoveryStatusText, openCodeDiscoverySchema, openCodeHistorySchema, type DiscoverySession, type HistoryPage, type OpenCodeDiscovery } from "@/lib/opencode-discovery";
import OpenCodeHistoryPane from "./OpenCodeHistoryPane";

type PanelState =
  | { kind: "idle"; message: string }
  | { kind: "working"; operation: "unlock" | "read" }
  | { kind: "result"; result: OpenCodeDiscovery }
  | { kind: "error"; message: string };

type InspectionState =
  | { kind: "empty" }
  | { kind: "loading"; id: DiscoverySession["id"] }
  | { kind: "ready"; page: HistoryPage }
  | { kind: "failure"; message: string };

const controlClass = "min-h-11 rounded-[4px] border border-[var(--border)] bg-[var(--raised)] px-3 py-2 text-sm text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--selection)] disabled:cursor-not-allowed disabled:opacity-50";

function historyInspection(raw: unknown, id: DiscoverySession["id"]): InspectionState {
  const parsed = openCodeHistorySchema.safeParse(raw);
  if (!parsed.success) return { kind: "failure", message: "History returned an invalid response. No message content is shown." };
  if (parsed.data.kind !== "history-page") return { kind: "failure", message: parsed.data.kind === "failure" ? parsed.data.problem.message : parsed.data.message };
  return parsed.data.session.id !== id || parsed.data.expires <= Date.now()
    ? { kind: "failure", message: "History selection changed or inspection expired. No message content is shown." }
    : { kind: "ready", page: parsed.data };
}

function timeLabel(time: number | null): string {
  return time === null ? "Not reported" : new Date(time).toISOString();
}

function SessionMetadata({ record, selected, disabled, onInspect }: { record: DiscoverySession; selected: boolean; disabled: boolean; onInspect: () => void }) {
  return (
    <li className="min-w-0 rounded-[4px] border border-[var(--border)] bg-[var(--canvas)] p-3">
      <h3 className="break-words text-sm font-medium text-[var(--text)] [overflow-wrap:anywhere]">
        {record.title || "Untitled session"}{record.titleTruncated && <span className="text-[var(--muted)]"> (title truncated)</span>}
      </h3>
      <dl className="mt-2 grid min-w-0 grid-cols-1 gap-x-3 gap-y-1 text-xs sm:grid-cols-[8rem_minmax(0,1fr)] [&>dd]:break-all">
        <dt>Session ID</dt><dd className="font-mono text-[var(--text)]">{record.id}</dd>
        <dt>Project ID</dt><dd className="font-mono text-[var(--text)]">{record.projectID}</dd>
        <dt>Parent ID</dt><dd className="font-mono text-[var(--text)]">{record.parentID ?? "Not reported. Root status unknown."}</dd>
        {record.parentResolution !== "not-reported" && <><dt>Parent lookup</dt><dd>{record.parentResolution === "in-page" ? "Present in this page. Child record." : "Unresolved. Parent outside this page. Child record."}</dd></>}
        <dt>Workspace ID</dt><dd className="font-mono text-[var(--text)]">{record.workspaceID ?? "Not reported"}</dd>
        <dt>Created</dt><dd>{timeLabel(record.time.created)}</dd>
        <dt>Updated</dt><dd>{timeLabel(record.time.updated)}</dd>
        <dt>Archived</dt><dd>{timeLabel(record.time.archived)}</dd>
      </dl>
      <button type="button" className={`${controlClass} mt-3`} aria-pressed={selected} disabled={disabled} onClick={onInspect}>Inspect recorded messages</button>
    </li>
  );
}

export default function OpenCodeDiscoveryPanel() {
  const [secret, setSecret] = useState("");
  const [state, setState] = useState<PanelState>({ kind: "idle", message: "No discovery read yet. Unlock, then choose Check OpenCode. Existing access can be checked without unlocking again." });
  const inFlight = useRef<AbortController | null>(null);
  const [inspection, setInspection] = useState<InspectionState>({ kind: "empty" });
  const historyFlight = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const latestRef = useRef<HTMLButtonElement | null>(null);
  const olderRef = useRef<HTMLButtonElement | null>(null);
  const pendingFocus = useRef<"heading" | "latest" | "older" | null>(null);

  const clearInspection = useCallback(() => {
    generation.current++;
    historyFlight.current?.abort();
    historyFlight.current = null;
    setInspection({ kind: "empty" });
  }, []);

  useEffect(() => {
    const clear = () => clearInspection();
    window.addEventListener("pagehide", clear);
    window.addEventListener("pageshow", clear);
    return () => { inFlight.current?.abort(); historyFlight.current?.abort(); window.removeEventListener("pagehide", clear); window.removeEventListener("pageshow", clear); };
  }, [clearInspection]);

  useEffect(() => {
    if (inspection.kind !== "ready") return;
    if (pendingFocus.current === "heading") headingRef.current?.focus();
    else if (pendingFocus.current === "older" && !olderRef.current?.disabled) olderRef.current?.focus();
    else if (pendingFocus.current) latestRef.current?.focus();
    pendingFocus.current = null;
    const expire = () => { if (Date.now() >= inspection.page.expires) clearInspection(); };
    const timer = setTimeout(clearInspection, Math.max(0, inspection.page.expires - Date.now()));
    window.addEventListener("focus", expire);
    document.addEventListener("visibilitychange", expire);
    return () => { clearTimeout(timer); window.removeEventListener("focus", expire); document.removeEventListener("visibilitychange", expire); };
  }, [inspection, clearInspection]);

  async function inspect(id: DiscoverySession["id"], cursor?: string) {
    if (inFlight.current) return;
    historyFlight.current?.abort();
    const controller = new AbortController();
    historyFlight.current = controller;
    const current = ++generation.current;
    pendingFocus.current = inspection.kind === "ready" && inspection.page.session.id === id ? cursor ? "older" : "latest" : "heading";
    setInspection({ kind: "loading", id });
    try {
      const response = await fetch("/api/opencode-discovery/history", {
        headers: { "X-Pixel-Discovery": "1", "X-Pixel-History-Session": id, ...(cursor ? { "X-Pixel-History-Cursor": cursor } : {}) },
        credentials: "same-origin", cache: "no-store", redirect: "error", signal: controller.signal,
      });
      const raw: unknown = await response.json();
      if (controller.signal.aborted || current !== generation.current) return;
      setInspection(historyInspection(raw, id));
    } catch {
      if (!controller.signal.aborted && current === generation.current) setInspection({ kind: "failure", message: "History read failed. No message content is shown." });
    } finally { if (historyFlight.current === controller) historyFlight.current = null; }
  }

  async function request(operation: "unlock" | "read") {
    if (inFlight.current) return;
    clearInspection();
    const controller = new AbortController();
    inFlight.current = controller;
    setState({ kind: "working", operation });
    const body = operation === "unlock" ? JSON.stringify({ secret }) : undefined;
    if (operation === "unlock") setSecret("");
    try {
      const response = await fetch("/api/opencode-discovery", {
        method: operation === "unlock" ? "POST" : "GET",
        headers: { "X-Pixel-Discovery": "1", ...(operation === "unlock" ? { "Content-Type": "application/json" } : {}) },
        credentials: "same-origin",
        cache: "no-store",
        redirect: "error",
        signal: controller.signal,
        body,
      });
      if (controller.signal.aborted) return;
      if (operation === "unlock" && response.status === 204) {
        setState({ kind: "idle", message: "Discovery unlocked for 15 minutes. Choose Check OpenCode to read health and persisted metadata. Unlock did not contact OpenCode." });
      } else {
        const raw: unknown = await response.json();
        if (controller.signal.aborted) return;
        const parsed = openCodeDiscoverySchema.safeParse(raw);
        setState(parsed.success ? { kind: "result", result: parsed.data } : { kind: "error", message: "Discovery returned an invalid response. No metadata is shown." });
      }
    } catch {
      if (!controller.signal.aborted) setState({ kind: "error", message: "Discovery request failed. No metadata is shown. Check the configured app origin and local server." });
    } finally {
      if (inFlight.current === controller) inFlight.current = null;
    }
  }

  function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void request("unlock");
  }

  const working = state.kind === "working";
  const result = state.kind === "result" ? state.result : null;
  const page = result?.kind === "snapshot" && result.sessions.kind === "ready" ? result.sessions : null;
  const status = state.kind === "working" ? state.operation === "unlock" ? "Unlocking discovery access…" : "Reading OpenCode health and metadata…"
    : state.kind === "result" ? discoveryStatusText(state.result) : state.message;

  return (
    <section aria-labelledby="opencode-discovery-heading" aria-busy={working} className="flex min-w-0 flex-col gap-3 rounded-[4px] border border-[var(--border)] bg-[var(--surface)] p-4 text-[var(--muted)]" style={{ fontFamily: "var(--font-inter), Inter, sans-serif" }}>
      <h2 id="opencode-discovery-heading" className="text-[18px] text-[var(--text)]" style={{ fontFamily: "var(--font-vt), VT323, monospace" }}>OpenCode discovery · Read-only</h2>
      <p className="text-xs leading-relaxed">Manual discovery and read-only recorded-message inspection. Selection never resumes, prompts, interrupts, or attaches to a session. Saved records do not establish activity or create monitor floors.</p>
      <form onSubmit={unlock} className="flex min-w-0 flex-col gap-2">
        <label htmlFor="discovery-secret" className="text-sm text-[var(--text)]">Discovery access secret</label>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
          <input id="discovery-secret" type="password" value={secret} onChange={(event) => setSecret(event.target.value)} autoComplete="off" maxLength={512} spellCheck={false} disabled={working} className={`${controlClass} min-w-0 flex-1`} aria-describedby="discovery-secret-help" />
          <button type="submit" disabled={working || !secret} className={controlClass}>Unlock discovery</button>
        </div>
        <p id="discovery-secret-help" className="text-xs">Use the independent owner secret, not the monitor token or OpenCode password. Input clears on submit and is never saved to localStorage. Access cookie is scoped to this read-only API.</p>
      </form>
      <button type="button" onClick={() => void request("read")} disabled={working} className={`${controlClass} self-start`}>{working ? "Working…" : result?.kind === "snapshot" ? "Refresh metadata" : "Check OpenCode"}</button>
      <p role="status" aria-live="polite" aria-atomic="true" className="break-words text-sm text-[var(--text)]">{status}</p>
      {result?.kind === "snapshot" && <p className="text-xs">Connection {result.connection.connectionID}. {result.connection.directoryDisplay}. Provider OpenCode {result.health.version}.</p>}
      {page && <>
        <p className="text-xs leading-relaxed">{page.count} records returned. First page only, limit {page.limit}, newest creation first. Includes child and archived records. Missing parents stay unresolved. This page does not prove completeness; provider cursors are not used.</p>
        {page.count === 0 ? <p className="text-sm text-[var(--text)]">No persisted sessions returned for the configured workspace.</p> : <ul className="grid min-w-0 gap-2" aria-label="Persisted OpenCode session metadata">{page.records.map((record) => <SessionMetadata key={record.id} record={record} selected={inspection.kind === "ready" ? inspection.page.session.id === record.id : inspection.kind === "loading" && inspection.id === record.id} disabled={working} onInspect={() => void inspect(record.id)} />)}</ul>}
      </>}
      {inspection.kind === "loading" && <div><p role="status" aria-live="polite">Reading one bounded recorded-message page. No provider execution starts.</p><button type="button" className={controlClass} onClick={clearInspection}>Clear inspection</button></div>}
      {inspection.kind === "failure" && <p role="status" aria-live="polite">{inspection.message}</p>}
      {inspection.kind === "ready" && page && <OpenCodeHistoryPane page={inspection.page} records={page.records} headingRef={headingRef} latestRef={latestRef} olderRef={olderRef} onRead={(id, cursor) => void inspect(id, cursor)} onClear={clearInspection} />}
      <details className="min-w-0 text-xs leading-relaxed">
        <summary className="cursor-pointer py-2 text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--selection)]">Server configuration keys</summary>
        <p>Required server-only keys. Configure one canonical numeric loopback app origin with port, an independent random secret of at least 43 base64url characters or 32 strong bytes, a numeric loopback OpenCode origin, and an absolute approved workspace.</p>
        <ul className="mt-2 list-disc break-all pl-5"><li><code>PIXEL_DISCOVERY_ORIGIN</code></li><li><code>PIXEL_DISCOVERY_ACCESS_SECRET</code></li><li><code>PIXEL_OPENCODE_URL</code></li><li><code>PIXEL_OPENCODE_DIRECTORY</code></li></ul>
        <p className="mt-2 break-words">Optional Basic credentials use <code className="break-all">PIXEL_OPENCODE_PASSWORD</code> and <code className="break-all">PIXEL_OPENCODE_USERNAME</code>, default username <code>opencode</code>. No global credential lookup or automatic server launch. Supported listing version is 1.18.35.</p>
      </details>
    </section>
  );
}
