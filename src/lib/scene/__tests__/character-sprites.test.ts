import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";

import { agents } from "../../agents";
import { getCharacterMeta } from "../assets";

interface SpriteContractFile {
  frame: { width: number; height: number; columns: number; rows: number };
  atlas: { width: number; height: number; frames: number };
  directions: string[];
  poses: Record<string, { start: number; end: number }>;
  anchor: { x: number; y: number };
  opaqueBodyBounds: { maxWidth: number; maxHeight: number };
  alpha: string;
  layerOrder: string[];
}

interface CharacterManifestFile {
  characters: Record<string, {
    path: string;
    width: number;
    height: number;
    frames: number;
    frameWidth: number;
    frameHeight: number;
    anchor: { x: number; y: number };
    sha256: string;
  }>;
  fallbackKey: string;
  directions: string[];
}

interface AppearanceCatalogFile {
  appearances: Record<string, {
    layers: Record<string, string>;
    palette: Record<string, string>;
  }>;
}

const spriteRoot = path.resolve(process.env.SPRITE_TEST_ROOT ?? process.cwd());

function fromRoot(...segments: string[]): string {
  return path.join(spriteRoot, ...segments);
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(fromRoot(relativePath), "utf8")) as T;
}

function sha256(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

function snapshotFiles(relativePaths: string[]): Record<string, string> {
  return Object.fromEntries(relativePaths.map((relativePath) => [
    relativePath,
    sha256(readFileSync(fromRoot(relativePath))),
  ]));
}

function pngFiles(relativeDirectory: string): string[] {
  const absoluteDirectory = fromRoot(relativeDirectory);
  return readdirSync(absoluteDirectory)
    .filter((name) => name.endsWith(".png"))
    .map((name) => path.join(relativeDirectory, name).replaceAll("\\", "/"))
    .sort();
}

function readRgbaPixels(filePath: string): { width: number; height: number; pixels: Buffer } {
  const png = readFileSync(filePath);
  expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  expect(png[24]).toBe(8);
  expect(png[25]).toBe(6);

  const idat: Buffer[] = [];
  let offset = 8;
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.subarray(offset + 4, offset + 8).toString("ascii");
    if (type === "IDAT") idat.push(png.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }

  const scanlines = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    const filter = scanlines[y * (stride + 1)];
    expect(filter).toBeLessThanOrEqual(4);
    for (let x = 0; x < stride; x += 1) {
      const raw = scanlines[y * (stride + 1) + x + 1];
      const left = x >= 4 ? pixels[y * stride + x - 4] : 0;
      const above = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const upperLeft = y > 0 && x >= 4 ? pixels[(y - 1) * stride + x - 4] : 0;
      let value = raw;
      if (filter === 1) value += left;
      if (filter === 2) value += above;
      if (filter === 3) value += Math.floor((left + above) / 2);
      if (filter === 4) {
        const estimate = left + above - upperLeft;
        const leftDistance = Math.abs(estimate - left);
        const aboveDistance = Math.abs(estimate - above);
        const upperLeftDistance = Math.abs(estimate - upperLeft);
        value += leftDistance <= aboveDistance && leftDistance <= upperLeftDistance
          ? left
          : aboveDistance <= upperLeftDistance
            ? above
            : upperLeft;
      }
      pixels[y * stride + x] = value & 0xff;
    }
  }
  return { width, height, pixels };
}

describe("layered character sprite contract", () => {
  it("keeps canonical 48px frame, direction, pose, anchor, and bounds contract", () => {
    const contract = readJson<SpriteContractFile>("assets/characters/sprite-contract.json");
    expect(contract.frame).toEqual({ width: 48, height: 48, columns: 24, rows: 4 });
    expect(contract.directions).toEqual(["down", "left", "right", "up"]);
    expect(contract.poses).toEqual({
      idle: { start: 0, end: 3 },
      walk: { start: 4, end: 11 },
      seat: { start: 12, end: 13 },
      work: { start: 14, end: 15 },
      give: { start: 16, end: 17 },
      receive: { start: 18, end: 19 },
      success: { start: 20, end: 21 },
      error: { start: 22, end: 23 },
    });
    expect(contract.anchor).toEqual({ x: 24, y: 46 });
    expect(contract.opaqueBodyBounds).toEqual({ maxWidth: 32, maxHeight: 38 });
    expect(contract.atlas).toEqual({ width: 1152, height: 192, frames: 96 });
    expect(contract.alpha).toBe("binary");
    expect(contract.layerOrder).toEqual(["body", "bottom", "top", "hair", "face", "accessory"]);
  });

  it("resolves every registered role to a unique committed atlas and unknown keys to fallback", () => {
    const manifest = readJson<CharacterManifestFile>("public/sprites/characters/manifest.json");
    const knownKeys = Object.keys(agents).sort();
    expect(Object.keys(manifest.characters).sort()).toEqual([...knownKeys, "fallback"].sort());

    const knownDigests = new Set<string>();
    for (const key of knownKeys) {
      const meta = getCharacterMeta(key);
      const manifestMeta = manifest.characters[key];
      expect(meta.path).toBe(`/sprites/characters/${key}.png`);
      expect(manifestMeta.path).toBe(meta.path);
      expect(manifestMeta.path).not.toBe(manifest.characters.fallback.path);
      const bytes = readFileSync(fromRoot("public", manifestMeta.path.replace(/^\//, "")));
      const digest = sha256(bytes);
      expect(digest).toBe(manifestMeta.sha256);
      knownDigests.add(digest);
    }
    expect(knownDigests.size).toBe(knownKeys.length);
    expect(getCharacterMeta("future-agent").path).toBe("/sprites/characters/fallback.png");
    expect(getCharacterMeta(" Architect ").path).toBe("/sprites/characters/architect.png");
  });

  it("ships RGBA atlas pixels for every appearance", () => {
    const manifest = readJson<CharacterManifestFile>("public/sprites/characters/manifest.json");
    expect(manifest.fallbackKey).toBe("fallback");
    expect(manifest.directions).toEqual(["down", "left", "right", "up"]);
    for (const [key, meta] of Object.entries(manifest.characters)) {
      expect(meta).toMatchObject({
        width: 1152,
        height: 192,
        frames: 96,
        frameWidth: 48,
        frameHeight: 48,
        anchor: { x: 24, y: 46 },
      });
      const atlas = readRgbaPixels(fromRoot("public", meta.path.replace(/^\//, "")));
      expect(atlas.width).toBe(1152);
      expect(atlas.height).toBe(192);
      const alphaValues = new Set<number>();
      for (let index = 3; index < atlas.pixels.length; index += 4) alphaValues.add(atlas.pixels[index]);
      expect(alphaValues).toEqual(new Set([0, 255]));
      expect(key.length).toBeGreaterThan(0);
    }
  }, 30_000);

  it("keeps every permanent source layer on the full 96-frame RGBA atlas contract", () => {
    const contract = readJson<SpriteContractFile>("assets/characters/sprite-contract.json");
    const catalog = readJson<AppearanceCatalogFile>("assets/characters/appearances.json");
    const layerFiles = contract.layerOrder.flatMap((layerName) =>
      pngFiles(`assets/characters/layers/${layerName}`)
    );
    const referencedFiles = new Set(Object.values(catalog.appearances).flatMap((appearance) =>
      Object.entries(appearance.layers).map(([layerName, styleName]) =>
        `assets/characters/layers/${layerName}/${styleName}.png`
      )
    ));

    expect(layerFiles.length).toBe(48);
    expect(new Set(layerFiles)).toEqual(referencedFiles);
    for (const relativePath of layerFiles) {
      const layer = readRgbaPixels(fromRoot(relativePath));
      expect(layer.width, relativePath).toBe(1152);
      expect(layer.height, relativePath).toBe(192);
    }
  }, 30_000);

  it("keeps the appearance catalog limited to 2D layers and palettes", () => {
    const catalog = readJson<AppearanceCatalogFile>("assets/characters/appearances.json");
    for (const appearance of Object.values(catalog.appearances)) {
      expect(Object.keys(appearance).sort()).toEqual(["layers", "palette"]);
    }
  });

  it("passes generator check mode without rewriting committed output", () => {
    const manifest = readJson<CharacterManifestFile>("public/sprites/characters/manifest.json");
    const committedPaths = [
      ...Object.values(manifest.characters).map((meta) => `public${meta.path}`),
      "public/sprites/characters/manifest.json",
      "docs/character-sprites-contact-sheet.png",
      "docs/character-sprites-contact-sheet.json",
    ];
    const before = snapshotFiles(committedPaths);
    const result = spawnSync("python", ["scripts/generate-sprites.py", "--check"], {
      cwd: spriteRoot,
      encoding: "utf8",
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Sprite outputs verified");
    expect(snapshotFiles(committedPaths)).toEqual(before);
  }, 30_000);

  it("keeps procedural character drawing out of the final generator", () => {
    const generatorPath = fromRoot("scripts/generate-sprites.py");
    expect(statSync(generatorPath).isFile()).toBe(true);
    const generator = readFileSync(generatorPath, "utf8");
    expect(generator).not.toMatch(/\b(?:ImageDraw|circle|rect|draw_head|draw_body)\b/);
  });
});
