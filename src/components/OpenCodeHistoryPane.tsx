"use client";

import type { RefObject } from "react";
import type { DiscoverySession, HistoryPage, HistoryPart } from "@/lib/opencode-discovery";

const buttonClass = "min-h-11 rounded-[4px] border border-[var(--border)] bg-[var(--raised)] px-3 py-2 text-sm text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--selection)] disabled:opacity-50";
const textClass = "whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--text)] [overflow-wrap:anywhere]";

function RecordedPart({ part }: { part: HistoryPart }) {
  switch (part.kind) {
    case "text":
      return <div><pre className={textClass}>{part.content.text}</pre>{(part.content.redacted || part.content.truncated) && <p className="text-xs">{part.content.redacted && "Credentials redacted. "}{part.content.truncated && "Text truncated."}</p>}{(part.synthetic || part.ignored) && <p className="text-xs">Provider marked this text {part.synthetic ? "synthetic" : "ignored"}.</p>}</div>;
    case "recorded-tool":
      return <details className="rounded border border-[var(--border)] p-2"><summary className="cursor-pointer text-sm text-[var(--text)]">Recorded tool {part.name.text || "Unknown"}. Recorded status {part.status}.</summary><p className="mt-2 text-xs">Saved status only. This does not establish current execution.</p><h4 className="mt-2 text-xs">Recorded arguments</h4><pre className={textClass}>{part.input.text}</pre>{part.output && <><h4 className="mt-2 text-xs">Recorded output</h4><pre className={textClass}>{part.output.text}</pre></>}{(part.omitted || part.input.truncated || part.output?.truncated) && <p className="text-xs">Some recorded content is omitted or truncated.</p>}{(part.name.redacted || part.input.redacted || part.output?.redacted) && <p className="text-xs">Credentials redacted.</p>}</details>;
    case "omitted":
      return <p className="text-xs">{part.count} recorded part{part.count === 1 ? "" : "s"} omitted. {part.reason}.</p>;
    default: {
      const exhaustive: never = part;
      return exhaustive;
    }
  }
}

export default function OpenCodeHistoryPane({ page, records, headingRef, latestRef, olderRef, onRead, onClear }: {
  page: HistoryPage;
  records: DiscoverySession[];
  headingRef: RefObject<HTMLHeadingElement | null>;
  latestRef: RefObject<HTMLButtonElement | null>;
  olderRef: RefObject<HTMLButtonElement | null>;
  onRead: (id: DiscoverySession["id"], cursor?: string) => void;
  onClear: () => void;
}) {
  const parent = records.find(record => record.id === page.session.parentID);
  const children = records.filter(record => record.parentID === page.session.id);
  return <section aria-labelledby="session-inspector-heading" className="flex min-w-0 flex-col gap-3 rounded border border-[var(--selection)] bg-[var(--canvas)] p-3">
    <h3 id="session-inspector-heading" ref={headingRef} tabIndex={-1} className="break-words text-lg text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--selection)]">Session Inspector · Read-only</h3>
    <p className="break-words text-sm text-[var(--text)]">{page.session.title || "Untitled session"}</p>
    <p className="break-all text-xs">Native session {page.session.id}. Recorded messages only; inspection does not resume this session or create office activity.</p>
    <div className="flex flex-wrap gap-2"><button ref={latestRef} type="button" className={buttonClass} onClick={() => onRead(page.session.id)}>Latest messages</button><button ref={olderRef} type="button" className={buttonClass} disabled={page.olderCursor === null} onClick={() => { if (page.olderCursor) onRead(page.session.id, page.olderCursor); }}>Older messages</button><button type="button" className={buttonClass} onClick={onClear}>Clear inspection</button></div>
    <p className="text-xs">{page.messages.length} recorded messages in this page. Limit {page.limit}. Chronological within page; older pages replace this page. {page.olderCursor === null ? "Provider reports no older continuation for this read." : "An older page is available."} Content can still be private; configured credentials and known patterns are redacted before truncation.</p>
    {page.truncated && <p className="text-xs">Projection is bounded. Some text or parts are truncated or omitted.</p>}
    <div className="flex flex-col gap-2"><h4 className="text-sm text-[var(--text)]">Relationships in loaded metadata page. Incomplete.</h4>{parent ? <button type="button" className={`${buttonClass} self-start`} onClick={() => onRead(parent.id)}>Inspect loaded parent</button> : <p className="text-xs">{page.session.parentID ? "Parent is outside the loaded metadata page." : "Parent not reported. Root status unknown."}</p>}{children.length === 0 ? <p className="text-xs">No children in this metadata page.</p> : children.map(child => <button type="button" key={child.id} className={`${buttonClass} self-start max-w-full break-all`} onClick={() => onRead(child.id)}>Inspect loaded child {child.id}</button>)}</div>
    {page.messages.length === 0 ? <p className="text-sm">No recorded messages returned in this bounded legacy page.</p> : <ol aria-label="Recorded session messages" className="grid min-w-0 gap-3">{page.messages.map(message => <li key={message.id} className="min-w-0 rounded border border-[var(--border)] p-3"><h4 className="text-sm text-[var(--text)]">Recorded {message.role} message</h4><p className="mt-1 break-all text-xs">{new Date(message.time.created).toISOString()}. Agent {message.agent?.text || "Not reported"}. Message {message.id}.</p><div className="mt-3 grid min-w-0 gap-3">{message.parts.map(part => <RecordedPart key={part.id} part={part} />)}</div></li>)}</ol>}
  </section>;
}
