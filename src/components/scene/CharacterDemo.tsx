"use client";

import { useState } from "react";
import { agents } from "@/lib/agents";
import { CHARACTER_SPRITE_KEYS } from "@/lib/scene/assets";
import CharacterSprite from "./CharacterSprite";
import type { Pose } from "./CharacterSprite";

const CHARACTERS = CHARACTER_SPRITE_KEYS.map((key) => ({
  key,
  label: agents[key]?.label ?? key.replace(/-/g, " "),
}));

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
  const [scale, setScale] = useState(1);

  return (
    <div className="min-h-screen bg-[var(--canvas)] p-4 text-[var(--text)] md:p-8">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-4 font-pixel text-2xl text-[var(--text)]">
          Character Sprite Demo
        </h1>
        <p className="mb-8 text-[var(--muted)]">
          Full layered roster. 48×48 frames, four directions, 24-frame pose contract.
        </p>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 md:col-span-2 lg:col-span-3">
            <h2 className="mb-4 text-lg font-bold text-[var(--text)]">Character</h2>
            <div className="flex flex-wrap gap-2">
              {CHARACTERS.map((char) => (
                <button
                  key={char.key}
                  type="button"
                  onClick={() => setSelectedCharacter(char.key)}
                  aria-pressed={selectedCharacter === char.key}
                  className={`min-h-11 rounded px-3 py-2 text-sm font-medium transition-colors ${
                    selectedCharacter === char.key
                      ? "bg-[var(--selection)] text-[var(--canvas)]"
                      : "bg-[var(--raised)] text-[var(--muted)] hover:bg-[var(--elevated)]"
                  }`}
                >
                  {char.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
            <h2 className="mb-4 text-lg font-bold text-[var(--text)]">Pose</h2>
            <div className="flex flex-wrap gap-2">
              {POSES.map((pose) => (
                <button
                  key={pose.key}
                  type="button"
                  onClick={() => setSelectedPose(pose.key)}
                  aria-pressed={selectedPose === pose.key}
                  className={`min-h-11 rounded px-3 py-2 text-sm font-medium transition-colors ${
                    selectedPose === pose.key
                      ? "bg-[var(--selection)] text-[var(--canvas)]"
                      : "bg-[var(--raised)] text-[var(--muted)] hover:bg-[var(--elevated)]"
                  }`}
                >
                  {pose.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
            <h2 className="mb-4 text-lg font-bold text-[var(--text)]">Direction</h2>
            <div className="flex flex-wrap gap-2">
              {DIRECTIONS.map((dir) => (
                <button
                  key={dir.key}
                  type="button"
                  onClick={() => setSelectedDirection(dir.key)}
                  aria-pressed={selectedDirection === dir.key}
                  className={`min-h-11 rounded px-3 py-2 text-sm font-medium transition-colors ${
                    selectedDirection === dir.key
                      ? "bg-[var(--selection)] text-[var(--canvas)]"
                      : "bg-[var(--raised)] text-[var(--muted)] hover:bg-[var(--elevated)]"
                  }`}
                >
                  {dir.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
            <h2 className="mb-4 text-lg font-bold text-[var(--text)]">Scale</h2>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setScale((s) => Math.max(1, s - 1))}
                disabled={scale === 1}
                aria-label="Decrease sprite scale"
                className="min-h-11 min-w-11 rounded bg-[var(--raised)] px-3 py-2 text-[var(--text)] transition-colors hover:bg-[var(--elevated)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                −
              </button>
              <span className="w-12 text-center font-mono text-lg text-[var(--text)]">
                {scale}x
              </span>
              <button
                type="button"
                onClick={() => setScale((s) => Math.min(4, s + 1))}
                disabled={scale === 4}
                aria-label="Increase sprite scale"
                className="min-h-11 min-w-11 rounded bg-[var(--raised)] px-3 py-2 text-[var(--text)] transition-colors hover:bg-[var(--elevated)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                +
              </button>
            </div>
          </div>
        </div>

        <div className="relative mt-8 rounded-lg border border-[var(--border)] bg-[var(--floor)] p-8">
          <div className="relative h-[300px] flex items-center justify-center">
            <div className="relative h-48 w-48">
              <CharacterSprite
                actorId="demo"
                agentKey={selectedCharacter}
                position={{ x: 96, y: 144 }}
                facing={selectedDirection}
                pose={selectedPose}
                scale={scale}
              />
            </div>
          </div>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-center font-mono text-xs text-[var(--canvas)]">
            {selectedCharacter} • {selectedPose} • {selectedDirection} • {scale}x
          </div>
        </div>

        <div className="mt-8 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
          <h2 className="mb-4 text-lg font-bold text-[var(--text)]">All Poses Grid</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            {POSES.map((pose) => (
              <div key={pose.key} className="text-center">
                <div className="mb-2 text-sm text-[var(--muted)]">{pose.label}</div>
                <div className="relative mx-auto h-14 w-12">
                  <CharacterSprite
                    actorId={`grid-${pose.key}`}
                    agentKey={selectedCharacter}
                    position={{ x: 24, y: 50 }}
                    facing="down"
                    pose={pose.key}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
