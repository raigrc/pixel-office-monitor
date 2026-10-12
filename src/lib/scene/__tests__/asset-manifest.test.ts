import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";

import { ASSET_MANIFEST, type AssetMeta } from "../assets";
import { OFFICE_ENVIRONMENT_ITEMS } from "../office-layout";

function readPngDimensions(asset: AssetMeta): { width: number; height: number } {
  const file = readFileSync(path.join(process.cwd(), "public", asset.path.replace(/^\//, "")));
  expect(file.subarray(1, 4).toString("ascii")).toBe("PNG");
  return {
    width: file.readUInt32BE(16),
    height: file.readUInt32BE(20),
  };
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

function directoryHashes(directory: string): Record<string, string> {
  return Object.fromEntries(
    readdirSync(directory)
      .filter((fileName) => fileName.endsWith(".png"))
      .sort()
      .map((fileName) => [
        fileName,
        createHash("sha256").update(readFileSync(path.join(directory, fileName))).digest("hex"),
      ]),
  );
}

describe("office asset manifest", () => {
  it("matches generated PNG dimensions", () => {
    for (const category of ["tiles", "furniture", "props"] as const) {
      for (const asset of Object.values(ASSET_MANIFEST[category])) {
        expect(readPngDimensions(asset)).toEqual({
          width: asset.width,
          height: asset.height,
        });
      }
    }
  });

  it("registers exact environment asset paths and dimensions", () => {
    expect(ASSET_MANIFEST.furniture.corkboard).toMatchObject({ width: 48, height: 32 });
    expect(ASSET_MANIFEST.furniture["wall-shelf"]).toMatchObject({ width: 48, height: 16 });
    expect(ASSET_MANIFEST.furniture.sofa).toEqual({
      path: "/sprites/office/sofa.png",
      width: 48,
      height: 32,
    });
    expect(ASSET_MANIFEST.furniture["coffee-counter"]).toEqual({
      path: "/sprites/office/coffee-counter.png",
      width: 48,
      height: 24,
    });
    expect(ASSET_MANIFEST.furniture.storage).toMatchObject({ width: 48, height: 64 });
    expect(ASSET_MANIFEST.furniture.whiteboard).toMatchObject({ width: 48, height: 24 });
    expect(ASSET_MANIFEST.furniture["meeting-table"]).toMatchObject({ width: 40, height: 24 });
    expect(ASSET_MANIFEST.furniture["meeting-chair"]).toMatchObject({ width: 12, height: 12 });
    expect(ASSET_MANIFEST.tiles.window).toMatchObject({ width: 32, height: 24 });
    for (const item of OFFICE_ENVIRONMENT_ITEMS) {
      expect(ASSET_MANIFEST.furniture[item.assetKey], item.id).toMatchObject({
        width: item.bounds.width,
        height: item.bounds.height,
      });
    }
  });

  it("contains opaque pixels inside every declared office asset", () => {
    for (const category of ["tiles", "furniture", "props"] as const) {
      for (const asset of Object.values(ASSET_MANIFEST[category])) {
        const filePath = path.join(process.cwd(), "public", asset.path.replace(/^\//, ""));
        const { width, height, pixels } = readRgbaPixels(filePath);
        let opaqueCount = 0;
        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            if (pixels[(y * width + x) * 4 + 3] === 0) continue;
            opaqueCount += 1;
            expect(x).toBeLessThan(asset.width);
            expect(y).toBeLessThan(asset.height);
          }
        }
        expect(opaqueCount, asset.path).toBeGreaterThan(0);
      }
    }
  });

  it("generates byte-identical office assets twice", () => {
    const firstOutput = mkdtempSync(path.join(tmpdir(), "pixel-office-first-"));
    const secondOutput = mkdtempSync(path.join(tmpdir(), "pixel-office-second-"));
    try {
      for (const output of [firstOutput, secondOutput]) {
        const result = spawnSync("python", ["scripts/generate-office.py", "--output", output], {
          cwd: process.cwd(),
          encoding: "utf8",
        });
        expect(result.status, result.stderr).toBe(0);
      }
      expect(directoryHashes(firstOutput)).toEqual(directoryHashes(secondOutput));
      expect(directoryHashes(firstOutput)).toEqual(
        directoryHashes(path.join(process.cwd(), "public", "sprites", "office")),
      );
      expect(Object.keys(directoryHashes(firstOutput))).toContain("sofa.png");
      expect(Object.keys(directoryHashes(firstOutput))).toContain("coffee-counter.png");
    } finally {
      rmSync(firstOutput, { recursive: true, force: true });
      rmSync(secondOutput, { recursive: true, force: true });
    }
  }, 30_000);
});
