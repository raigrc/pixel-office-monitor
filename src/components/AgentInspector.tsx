"use client";

import { motion, AnimatePresence } from "motion/react";
import Image from "next/image";
import { useEffect, useRef } from "react";
import { getCharacterMeta } from "@/lib/scene/assets";
import type { CubicleDTO } from "@/lib/monitor-store";

interface AgentInspectorProps {
  cubicle: CubicleDTO | null;
  onClose: () => void;
  showPromptPreview: boolean;
  redactPaths: boolean;
}

function redactPathsInPrompt(prompt: string): string {
  let out = prompt.replace(/(?:\/[\w.\-]+)+(?:\/)?/g, "[…]");
  out = out.replace(/[A-Za-z]:\\[^\s]*/g, "[…]");
  return out;
}

export default function AgentInspector({ cubicle, onClose, showPromptPreview, redactPaths }: AgentInspectorProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!cubicle) return;
    closeRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cubicle, onClose]);

  if (!cubicle) return null;

  const agentKey = cubicle.agent;
  const status = cubicle.state;
  const prompt = cubicle.prompt;
  const lastTool = cubicle.lastTool;
  const todos = cubicle.todos ?? [];
  const character = getCharacterMeta(agentKey);
  const portraitSize = 48;
  const portraitScale = portraitSize / (character.frameWidth ?? character.width);

  const displayPrompt = !prompt || !showPromptPreview
    ? null
    : redactPaths
      ? redactPathsInPrompt(prompt)
      : prompt;

  const statusColor = (() => {
    switch (status) {
      case "working":
        return "var(--working)";
      case "thinking":
        return "var(--waiting)";
      case "delegating":
        return "var(--delegation-active)";
      case "celebrating":
        return "var(--success)";
      case "blocked":
        return "var(--error)";
      case "idle":
      default:
        return "var(--idle)";
    }
  })();

  const statusLabel = (() => {
    switch (status) {
      case "working":
        return "WORKING";
      case "thinking":
        return "THINKING";
      case "delegating":
        return "DELEGATING";
      case "celebrating":
        return "SUCCESS";
      case "blocked":
        return "ERROR";
      case "idle":
      default:
        return "IDLE";
    }
  })();

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--canvas)_78%,transparent)] p-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="inspector-title"
      >
        <motion.div
          className="relative w-full max-w-md rounded-[6px] border-2 border-[var(--strong-border)] bg-[var(--canvas)] p-5 shadow-[6px_6px_0_var(--surface)]"
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="relative block h-12 w-12 shrink-0 overflow-hidden rounded-[3px] border-2 border-[var(--border)] bg-[var(--surface)]" aria-hidden="true">
                <Image
                  src={character.path}
                  alt=""
                  width={character.width}
                  height={character.height}
                  unoptimized
                  className="pixel-img max-w-none"
                  style={{
                    width: character.width * portraitScale,
                    height: character.height * portraitScale,
                  }}
                />
              </span>
              <div>
                <h2 id="inspector-title" className="text-xl font-bold text-[var(--text)]" style={{ fontFamily: "var(--font-vt), VT323, monospace" }}>
                  {agentKey}
                </h2>
                <span
                  className="mt-1 inline-flex items-center rounded-[3px] px-2 py-0.5 text-xs font-bold text-[var(--canvas)]"
                  style={{ backgroundColor: statusColor }}
                >
                  <span className="mr-1.5 h-2 w-2 rounded-full bg-current" aria-hidden="true" />
                  {statusLabel}
                </span>
              </div>
            </div>
            <button
              ref={closeRef}
              onClick={onClose}
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-[4px] text-[var(--muted)] transition-colors hover:bg-[var(--raised)] hover:text-[var(--text)]"
              aria-label="Close inspector"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="space-y-4">
            {cubicle.taskCategory && (
              <div className="border-l-2 border-[var(--border)] bg-[var(--surface)] p-3">
                <div className="mb-1 text-xs text-[var(--muted)]">TASK TYPE</div>
                <div className="font-mono text-sm uppercase text-[var(--text)]">{cubicle.taskCategory}</div>
              </div>
            )}
            {lastTool && (
              <div className="border-l-2 border-[var(--border)] bg-[var(--surface)] p-3">
                <div className="mb-1 text-xs text-[var(--muted)]">LAST TOOL</div>
                <div className="font-mono text-sm text-[var(--text)]">{lastTool}</div>
              </div>
            )}

            {displayPrompt && (
              <div className="border-l-2 border-[var(--working)] bg-[var(--surface)] p-3">
                <div className="mb-1 text-xs text-[var(--muted)]">CURRENT TASK</div>
                <div className="whitespace-pre-wrap break-all text-sm text-[var(--text)]">{displayPrompt}</div>
              </div>
            )}

            {todos.length > 0 && (
              <div className="border-l-2 border-[var(--border)] bg-[var(--surface)] p-3">
                <div className="mb-2 text-xs text-[var(--muted)]">TODO LIST</div>
                <ul className="space-y-1">
                  {todos.map((todo, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span
                        className="mt-0.5 h-4 w-4 flex-shrink-0 rounded-[2px] border border-[var(--border)] bg-[var(--canvas)]"
                        style={{
                          backgroundColor: todo.status === "completed" || todo.state === "completed" ? "var(--success)" : "transparent",
                        }}
                      />
                      <span className="break-all text-[var(--text)]">
                        {String(todo.content ?? todo.text ?? JSON.stringify(todo))}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!displayPrompt && todos.length === 0 && !lastTool && (
              <div className="py-4 text-center text-sm text-[var(--muted)]">
                No active task details available
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end border-t border-[var(--border)] pt-4">
            <button
              onClick={onClose}
              className="min-h-11 cursor-pointer rounded-[4px] border-2 border-[var(--selection)] bg-[var(--raised)] px-4 text-sm font-medium text-[var(--text)] transition-colors hover:bg-[var(--elevated)]"
            >
              Close
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
