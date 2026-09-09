import * as THREE from 'three';
import { ThreeEngine, ThreeEngineConfig } from './three-engine';
import { ThreeSky, SkyPreset } from './three-sky';

export interface Settings3D {
  renderScale: number;
  enableBloom: boolean;
  bloomStrength: number;
  enableSMAA: boolean;
  autoQuality: boolean;
  shadowQuality: 'off' | 'low' | 'medium' | 'high';
  planetPreset: SkyPreset;
  timeOfDay: number;
  liveMode: boolean;
  showLabels: boolean;
  showFPS: boolean;
  maxAgents: number;
  tiltShiftEnabled: boolean;
  tiltShiftStrength: number;
  tiltShiftAngle: number;
}

export const DEFAULT_SETTINGS: Settings3D = {
  renderScale: 1.0,
  enableBloom: true,
  bloomStrength: 0.6,
  enableSMAA: true,
  autoQuality: true,
  shadowQuality: 'high',
  planetPreset: 'terra',
  timeOfDay: 12,
  liveMode: true,
  showLabels: true,
  showFPS: false,
  maxAgents: 64,
  tiltShiftEnabled: false,
  tiltShiftStrength: 1.0,
  tiltShiftAngle: 0,
};

const STORAGE_KEY = 'pixel-monitor-3d-settings';

export function loadSettings(): Settings3D {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch {
    // ignore
  }
  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: Settings3D): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

const QUALITY_PRESETS: Record<string, Partial<Settings3D>> = {
  potato: {
    renderScale: 0.35,
    enableBloom: false,
    enableSMAA: false,
    autoQuality: false,
    shadowQuality: 'off',
  },
  low: {
    renderScale: 0.5,
    enableBloom: false,
    enableSMAA: false,
    autoQuality: true,
    shadowQuality: 'low',
  },
  medium: {
    renderScale: 0.75,
    enableBloom: false,
    enableSMAA: true,
    autoQuality: true,
    shadowQuality: 'medium',
  },
  high: {
    renderScale: 1.0,
    enableBloom: true,
    enableSMAA: true,
    autoQuality: true,
    shadowQuality: 'high',
    tiltShiftEnabled: false,
  },
  ultra: {
    renderScale: 1.5,
    enableBloom: true,
    enableSMAA: true,
    autoQuality: true,
    shadowQuality: 'high',
    tiltShiftEnabled: true,
    tiltShiftStrength: 1.5,
  },
};

export function applyQualityPreset(preset: keyof typeof QUALITY_PRESETS): Settings3D {
  return { ...DEFAULT_SETTINGS, ...QUALITY_PRESETS[preset] };
}

export function applySettingsToEngine(engine: ThreeEngine, settings: Settings3D): void {
  engine.setConfig({
    enableBloom: settings.enableBloom,
    enableSMAA: settings.enableSMAA,
    renderScale: settings.renderScale,
    autoQuality: settings.autoQuality,
    sky: {
      preset: settings.planetPreset,
      timeOfDay: settings.timeOfDay,
      liveMode: settings.liveMode,
    },
  });
}

export function getShadowMapSize(quality: Settings3D['shadowQuality']): number {
  switch (quality) {
    case 'off': return 0;
    case 'low': return 512;
    case 'medium': return 1024;
    case 'high': return 2048;
  }
}

export function isWebGL2Supported(): boolean {
  if (typeof window === 'undefined') return false;
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2');
  return !!gl;
}

export function getDPR(): number {
  if (typeof window === 'undefined') return 1;
  return Math.min(window.devicePixelRatio, 2);
}

export function setupDPRListener(callback: (dpr: number) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const mediaQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
  const handler = () => callback(getDPR());
  mediaQuery.addEventListener('change', handler);
  return () => mediaQuery.removeEventListener('change', handler);
}

export function createSettingsPanel(): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'settings-panel';
  panel.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 320px;
    max-height: 80vh;
    overflow-y: auto;
    background: rgba(20, 20, 30, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 16px;
    color: #fff;
    font-family: system-ui, sans-serif;
    font-size: 13px;
    z-index: 1000;
    backdrop-filter: blur(8px);
  `;

  const settings = loadSettings();

  const createSlider = (label: string, min: number, max: number, step: number, value: number, onChange: (v: number) => void) => {
    const container = document.createElement('div');
    container.style.marginBottom = '12px';
    container.innerHTML = `
      <label style="display: flex; justify-content: space-between; margin-bottom: 4px;">
        <span>${label}</span>
        <span id="${label}-value">${value.toFixed(step < 1 ? 2 : 0)}</span>
      </label>
      <input type="range" min="${min}" max="${max}" step="${step}" value="${value}" style="width: 100%;">
    `;
    const input = container.querySelector('input')!;
    const valueEl = container.querySelector(`#${label}-value`)!;
    input.addEventListener('input', (e) => {
      const v = parseFloat((e.target as HTMLInputElement).value);
      valueEl.textContent = v.toFixed(step < 1 ? 2 : 0);
      onChange(v);
    });
    return container;
  };

  const createToggle = (label: string, checked: boolean, onChange: (v: boolean) => void) => {
    const container = document.createElement('div');
    container.style.marginBottom = '12px';
    container.innerHTML = `
      <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
        <input type="checkbox" ${checked ? 'checked' : ''} style="width: 16px; height: 16px;">
        <span>${label}</span>
      </label>
    `;
    const input = container.querySelector('input')!;
    input.addEventListener('change', (e) => onChange((e.target as HTMLInputElement).checked));
    return container;
  };

  const createSelect = (label: string, options: { value: string; label: string }[], value: string, onChange: (v: string) => void) => {
    const container = document.createElement('div');
    container.style.marginBottom = '12px';
    container.innerHTML = `
      <label style="display: block; margin-bottom: 4px;">${label}</label>
      <select style="width: 100%; padding: 6px; background: #2a2a3a; border: 1px solid #444; color: #fff; border-radius: 4px;">
        ${options.map(o => `<option value="${o.value}" ${o.value === value ? 'selected' : ''}>${o.label}</option>`).join('')}
      </select>
    `;
    const select = container.querySelector('select')!;
    select.addEventListener('change', (e) => onChange((e.target as HTMLSelectElement).value));
    return container;
  };

  const createButton = (label: string, onClick: () => void) => {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText = `
      width: 100%;
      padding: 8px;
      margin: 4px 0;
      background: #3a3a5a;
      border: 1px solid #555;
      color: #fff;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
    `;
    btn.addEventListener('click', onClick);
    return btn;
  };

  const title = document.createElement('h3');
  title.textContent = '3D View Settings';
  title.style.cssText = 'margin: 0 0 16px; font-size: 16px;';
  panel.appendChild(title);

  panel.appendChild(createSlider('Render Scale', 0.35, 2.0, 0.05, settings.renderScale, (v) => {
    settings.renderScale = v;
    saveSettings(settings);
  }));

  panel.appendChild(createToggle('Bloom', settings.enableBloom, (v) => {
    settings.enableBloom = v;
    saveSettings(settings);
  }));

  panel.appendChild(createSlider('Bloom Strength', 0, 2, 0.1, settings.bloomStrength, (v) => {
    settings.bloomStrength = v;
    saveSettings(settings);
  }));

  panel.appendChild(createToggle('SMAA', settings.enableSMAA, (v) => {
    settings.enableSMAA = v;
    saveSettings(settings);
  }));

  panel.appendChild(createToggle('Auto Quality', settings.autoQuality, (v) => {
    settings.autoQuality = v;
    saveSettings(settings);
  }));

  panel.appendChild(createSelect('Shadow Quality', [
    { value: 'off', label: 'Off' },
    { value: 'low', label: 'Low (512)' },
    { value: 'medium', label: 'Medium (1024)' },
    { value: 'high', label: 'High (2048)' },
  ], settings.shadowQuality, (v) => {
    settings.shadowQuality = v as Settings3D['shadowQuality'];
    saveSettings(settings);
  }));

  panel.appendChild(createSelect('Planet Preset', [
    { value: 'luna', label: 'Luna' },
    { value: 'mars', label: 'Mars' },
    { value: 'terra', label: 'Terra' },
  ], settings.planetPreset, (v) => {
    settings.planetPreset = v as SkyPreset;
    saveSettings(settings);
  }));

  panel.appendChild(createSlider('Time of Day', 0, 24, 0.5, settings.timeOfDay, (v) => {
    settings.timeOfDay = v;
    saveSettings(settings);
  }));

  panel.appendChild(createToggle('Live Mode', settings.liveMode, (v) => {
    settings.liveMode = v;
    saveSettings(settings);
  }));

  panel.appendChild(createToggle('Show Labels', settings.showLabels, (v) => {
    settings.showLabels = v;
    saveSettings(settings);
  }));

  panel.appendChild(createToggle('Show FPS', settings.showFPS, (v) => {
    settings.showFPS = v;
    saveSettings(settings);
  }));

  panel.appendChild(createSlider('Max Agents', 16, 320, 16, settings.maxAgents, (v) => {
    settings.maxAgents = v;
    saveSettings(settings);
  }));

  panel.appendChild(createToggle('Tilt-Shift', settings.tiltShiftEnabled, (v) => {
    settings.tiltShiftEnabled = v;
    saveSettings(settings);
  }));

  panel.appendChild(createSlider('Tilt-Shift Strength', 0, 3, 0.1, settings.tiltShiftStrength, (v) => {
    settings.tiltShiftStrength = v;
    saveSettings(settings);
  }));

  panel.appendChild(createSlider('Tilt-Shift Angle', -Math.PI / 2, Math.PI / 2, 0.1, settings.tiltShiftAngle, (v) => {
    settings.tiltShiftAngle = v;
    saveSettings(settings);
  }));

  const presetContainer = document.createElement('div');
  presetContainer.style.marginTop = '16px';
  presetContainer.innerHTML = '<label style="display: block; margin-bottom: 8px; font-weight: bold;">Quality Presets</label>';
  const presetButtons = document.createElement('div');
  presetButtons.style.display = 'flex';
  presetButtons.style.flexWrap = 'wrap';
  presetButtons.style.gap = '8px';
  for (const preset of Object.keys(QUALITY_PRESETS)) {
    const btn = createButton(preset.charAt(0).toUpperCase() + preset.slice(1), () => {
      const newSettings = applyQualityPreset(preset as keyof typeof QUALITY_PRESETS);
      Object.assign(settings, newSettings);
      saveSettings(settings);
      location.reload();
    });
    btn.style.flex = '1';
    btn.style.minWidth = '80px';
    presetButtons.appendChild(btn);
  }
  presetContainer.appendChild(presetButtons);
  panel.appendChild(presetContainer);

  return panel;
}