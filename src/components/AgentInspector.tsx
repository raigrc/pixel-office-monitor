"use client";

import { motion, AnimatePresence } from "motion/react";
import Image from "next/image";
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
  if (!cubicle) return null;

  const agentKey = cubicle.agent;
  const status = cubicle.state;
  const prompt = cubicle.prompt;
  const lastTool = cubicle.lastTool;
  const todos = cubicle.todos ?? [];

  const displayPrompt = !prompt || !showPromptPreview
    ? null
    : redactPaths
      ? redactPathsInPrompt(prompt)
      : prompt;

  const statusColor = (() => {
    switch (status) {
      case "working":
        return "#3B82F6";
      case "thinking":
        return "#F97316";
      case "delegating":
        return "#F97316";
      case "celebrating":
        return "#22C55E";
      case "idle":
      default:
        return "#64748B";
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
      case "idle":
      default:
        return "IDLE";
    }
  })();

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="inspector-title"
      >
        <motion.div
          className="relative w-full max-w-md bg-[#0F172A] border border-[#334155] rounded-xl p-6 shadow-2xl"
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <Image
                src={getCharacterMeta(agentKey).path}
                alt=""
                width={48}
                height={48}
                className="rounded"
                style={{ imageRendering: "pixelated" }}
              />
              <div>
                <h2 id="inspector-title" className="text-xl font-bold text-[#F1F5F9]" style={{ fontFamily: "var(--font-vt), VT323, monospace" }}>
                  {agentKey}
                </h2>
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold text-white mt-1"
                  style={{ backgroundColor: statusColor }}
                >
                  <span className="w-2 h-2 rounded-full bg-current mr-1.5 animate-pulse" aria-hidden="true" />
                  {statusLabel}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-[#64748B] hover:text-[#F1F5F9] transition-colors"
              aria-label="Close inspector"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="space-y-4">
            {lastTool && (
              <div className="bg-[#1E293B] border border-[#334155] rounded p-3">
                <div className="text-xs text-[#64748B] mb-1">LAST TOOL</div>
                <div className="text-sm text-[#F1F5F9] font-mono">{lastTool}</div>
              </div>
            )}

            {displayPrompt && (
              <div className="bg-[#1E293B] border border-[#334155] rounded p-3">
                <div className="text-xs text-[#64748B] mb-1">CURRENT TASK</div>
                <div className="text-sm text-[#F1F5F9] whitespace-pre-wrap break-all">{displayPrompt}</div>
              </div>
            )}

            {todos.length > 0 && (
              <div className="bg-[#1E293B] border border-[#334155] rounded p-3">
                <div className="text-xs text-[#64748B] mb-2">TODO LIST</div>
                <ul className="space-y-1">
                  {todos.map((todo, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span
                        className="w-4 h-4 mt-0.5 flex-shrink-0 rounded border border-[#334155] bg-[#0F172A]"
                        style={{
                          backgroundColor: todo.status === "completed" || todo.state === "completed" ? "#22C55E" : "transparent",
                        }}
                      />
                      <span className="text-[#F1F5F9] break-all">
                        {String(todo.content ?? todo.text ?? JSON.stringify(todo))}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!displayPrompt && todos.length === 0 && !lastTool && (
              <div className="text-center text-[#64748B] py-4 text-sm">
                No active task details available
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-[#334155] flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-[#3B82F6] text-white rounded hover:bg-[#2563EB] transition-colors font-medium text-sm"
            >
              Close
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
