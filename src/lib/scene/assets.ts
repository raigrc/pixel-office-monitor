export interface AssetMeta {
  path: string;
  width: number;
  height: number;
  frames?: number;
  frameWidth?: number;
  frameHeight?: number;
  anchor?: { x: number; y: number };
}

export interface AssetManifest {
  tiles: Record<string, AssetMeta>;
  furniture: Record<string, AssetMeta>;
  characters: Record<string, AssetMeta>;
  props: Record<string, AssetMeta>;
}

export const ASSET_MANIFEST: AssetManifest = {
  tiles: {
    "floor": { path: "/sprites/office/floor.png", width: 16, height: 16 },
    "wall-north": { path: "/sprites/office/wall-north.png", width: 16, height: 16 },
    "wall-south": { path: "/sprites/office/wall-south.png", width: 16, height: 16 },
    "wall-east": { path: "/sprites/office/wall-east.png", width: 16, height: 16 },
    "wall-west": { path: "/sprites/office/wall-west.png", width: 16, height: 16 },
    "door-closed": { path: "/sprites/office/door-closed.png", width: 16, height: 32 },
    "door-open": { path: "/sprites/office/door-open.png", width: 16, height: 32 },
    "window": { path: "/sprites/office/window.png", width: 32, height: 32 },
    "partition": { path: "/sprites/office/partition.png", width: 16, height: 32 },
  },
  furniture: {
    "desk-rear": { path: "/sprites/office/desk-rear.png", width: 64, height: 64 },
    "desk-front": { path: "/sprites/office/desk-front.png", width: 64, height: 32 },
    "chair": { path: "/sprites/office/chair.png", width: 16, height: 16 },
    "monitor-base": { path: "/sprites/office/monitor-base.png", width: 16, height: 16 },
    "monitor-screen": { path: "/sprites/office/monitor-screen-on.png", width: 16, height: 8 },
    "monitor-screen-working": { path: "/sprites/office/monitor-screen-working.png", width: 16, height: 8 },
    "monitor-screen-off": { path: "/sprites/office/monitor-screen-off.png", width: 16, height: 8 },
    "storage": { path: "/sprites/office/storage.png", width: 32, height: 64 },
    "plant": { path: "/sprites/office/plant.png", width: 16, height: 24 },
    "lamp": { path: "/sprites/office/lamp.png", width: 8, height: 16 },
    "whiteboard": { path: "/sprites/office/whiteboard.png", width: 48, height: 32 },
    "coffee-machine": { path: "/sprites/office/coffee-machine.png", width: 16, height: 24 },
    "meeting-table": { path: "/sprites/office/meeting-table.png", width: 64, height: 48 },
    "meeting-chair": { path: "/sprites/office/meeting-chair.png", width: 16, height: 16 },
  },
  characters: {
    "orchestrator": {
      path: "/sprites/characters/orchestrator.png",
      width: 768,
      height: 128,
      frames: 96,
      frameWidth: 32,
      frameHeight: 32,
      anchor: { x: 16, y: 30 },
    },
    "senior-engineer": {
      path: "/sprites/characters/senior-engineer.png",
      width: 768,
      height: 128,
      frames: 96,
      frameWidth: 32,
      frameHeight: 32,
      anchor: { x: 16, y: 30 },
    },
    "fallback": {
      path: "/sprites/characters/fallback.png",
      width: 768,
      height: 128,
      frames: 96,
      frameWidth: 32,
      frameHeight: 32,
      anchor: { x: 16, y: 30 },
    },
  },
  props: {
    "task-folder": { path: "/sprites/office/task-folder.png", width: 8, height: 8 },
    "task-folder-open": { path: "/sprites/office/task-folder-open.png", width: 12, height: 8 },
    "coffee-cup": { path: "/sprites/office/coffee-cup.png", width: 8, height: 8 },
    "clipboard": { path: "/sprites/props/clipboard.png", width: 8, height: 12 },
  },
};

export function getAssetUrl(category: keyof AssetManifest, key: string): string {
  const meta = ASSET_MANIFEST[category][key];
  if (!meta) {
    console.warn(`Asset not found: ${category}/${key}`);
    return ASSET_MANIFEST.characters.fallback.path;
  }
  return meta.path;
}

export function getCharacterMeta(agentKey: string): AssetMeta {
  const normalized = agentKey.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const meta = ASSET_MANIFEST.characters[normalized];
  if (meta) return meta;
  return ASSET_MANIFEST.characters.fallback;
}
