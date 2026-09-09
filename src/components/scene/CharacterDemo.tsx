"use client";

import { useState } from "react";
import { motion } from "motion/react";
import CharacterSprite from "./CharacterSprite";
import type { Pose } from "./CharacterSprite";

const PILOT_CHARACTERS = [
  { key: "orchestrator", label: "Orchestrator", color: "#F97316" },
  { key: "senior-engineer", label: "Senior Engineer", color: "#3B82F6" },
  { key: "fallback", label: "Fallback", color: "#94A3B8" },
];

const POSES: Array<{ key: Pose; label: string }> = [
  { key: "idle", label: "Idle" },
  { key: "walk", label: "Walk" },
  { key: "seat", label: "Seated" },
  { key: "work", label: "Working" },
  { key: "give", label: "Give" },
  { key: "receive", label: "Receive" },
  { key: "success", label: "Success" },
  { key: "error", label: "Error" },
];

const DIRECTIONS: Array<{ key: "up" | "down" | "left" | "right"; label: string }> = [
  { key: "down", label: "Down" },
  { key: "left", label: "Left" },
  { key: "right", label: "Right" },
  { key: "up", label: "Up" },
];

export default function CharacterDemo() {
  const [selectedCharacter, setSelectedCharacter] = useState("orchestrator");
  const [selectedPose, setSelectedPose] = useState<Pose>("idle");
  const [selectedDirection, setSelectedDirection] = useState<"up" | "down" | "left" | "right">("down");
  const [scale, setScale] = useState(2);

  return (
    <div className="min-h-screen bg-[#0F172A] p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-[#F1F5F9] mb-4 font-mono">
          Character Sprite Demo
        </h1>
        <p className="text-[#94A3B8] mb-8">
          Pilot character roster — 32×32 frames, 4-directional, multi-pose
        </p>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="bg-[#1E293B] border border-[#334155] rounded-lg p-4">
            <h2 className="text-lg font-bold text-[#F1F5F9] mb-4">Character</h2>
            <div className="flex flex-wrap gap-2">
              {PILOT_CHARACTERS.map((char) => (
                <button
                  key={char.key}
                  onClick={() => setSelectedCharacter(char.key)}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    selectedCharacter === char.key
                      ? `bg-[${char.color}] text-white`
                      : "bg-[#334155] text-[#94A3B8] hover:bg-[#475569]"
                  }`}
                >
                  {char.label}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-[#1E293B] border border-[#334155] rounded-lg p-4">
            <h2 className="text-lg font-bold text-[#F1F5F9] mb-4">Pose</h2>
            <div className="flex flex-wrap gap-2">
              {POSES.map((pose) => (
                <button
                  key={pose.key}
                  onClick={() => setSelectedPose(pose.key)}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    selectedPose === pose.key
                      ? "bg-[#3B82F6] text-white"
                      : "bg-[#334155] text-[#94A3B8] hover:bg-[#475569]"
                  }`}
                >
                  {pose.label}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-[#1E293B] border border-[#334155] rounded-lg p-4">
            <h2 className="text-lg font-bold text-[#F1F5F9] mb-4">Direction</h2>
            <div className="flex flex-wrap gap-2">
              {DIRECTIONS.map((dir) => (
                <button
                  key={dir.key}
                  onClick={() => setSelectedDirection(dir.key)}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    selectedDirection === dir.key
                      ? "bg-[#22C55E] text-white"
                      : "bg-[#334155] text-[#94A3B8] hover:bg-[#475569]"
                  }`}
                >
                  {dir.label}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-[#1E293B] border border-[#334155] rounded-lg p-4">
            <h2 className="text-lg font-bold text-[#F1F5F9] mb-4">Scale</h2>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setScale((s) => Math.max(1, s - 0.5))}
                className="px-3 py-1.5 bg-[#334155] text-[#F1F5F9] rounded hover:bg-[#475569] transition-colors"
              >
                −
              </button>
              <span className="text-lg font-mono text-[#F1F5F9] w-12 text-center">
                {scale}x
              </span>
              <button
                onClick={() => setScale((s) => Math.min(4, s + 0.5))}
                className="px-3 py-1.5 bg-[#334155] text-[#F1F5F9] rounded hover:bg-[#475569] transition-colors"
              >
                +
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8 bg-[#1E293B] border border-[#334155] rounded-lg p-8 relative">
          <div
            className="absolute inset-0 bg-gradient-to-b from-transparent via-[#1E293B] to-[#0F172A]"
          />
          <div className="relative h-[300px] flex items-center justify-center">
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              style={{
                position: "relative",
                left: "50%",
                transform: "translateX(-50%)",
              }}
            >
              <CharacterSprite
                actorId="demo"
                agentKey={selectedCharacter}
                position={{ x: 0, y: 0 }}
                facing={selectedDirection}
                pose={selectedPose}
                scale={scale}
              />
            </motion.div>
          </div>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-center text-xs text-[#64748B] font-mono">
            {selectedCharacter} • {selectedPose} • {selectedDirection} • {scale}x
          </div>
        </div>

        <div className="mt-8 bg-[#1E293B] border border-[#334155] rounded-lg p-6">
          <h2 className="text-lg font-bold text-[#F1F5F9] mb-4">All Poses Grid</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            {POSES.map((pose) => (
              <div key={pose.key} className="text-center">
                <div className="mb-2 text-sm text-[#94A3B8]">{pose.label}</div>
                <CharacterSprite
                  actorId={`grid-${pose.key}`}
                  agentKey={selectedCharacter}
                  position={{ x: 0, y: 0 }}
                  facing="down"
                  pose={pose.key}
                  scale={1.5}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
