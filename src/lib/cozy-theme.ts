import { z } from "zod";

import cozyThemeJson from "./cozy-theme.json";

export const cozyHexColorSchema = z.string().regex(/^#[0-9A-F]{6}$/).brand<"CozyHexColor">();

const materialRecipeSchema = z
  .object({
    roughness: z.number().min(0).max(1),
    metalness: z.number().min(0).max(1),
    emissiveIntensity: z.number().nonnegative().optional(),
  })
  .strict();

export const cozyThemeSchema = z
  .object({
    version: z.literal(1),
    ui: z
      .object({
        canvas: cozyHexColorSchema,
        surface: cozyHexColorSchema,
        raised: cozyHexColorSchema,
        elevated: cozyHexColorSchema,
        border: cozyHexColorSchema,
        strongBorder: cozyHexColorSchema,
        text: cozyHexColorSchema,
        muted: cozyHexColorSchema,
        dim: cozyHexColorSchema,
      })
      .strict(),
    semantic: z
      .object({
        selection: cozyHexColorSchema,
        working: cozyHexColorSchema,
        error: cozyHexColorSchema,
        success: cozyHexColorSchema,
        waiting: cozyHexColorSchema,
        idle: cozyHexColorSchema,
        delegationActive: cozyHexColorSchema,
        delegationPending: cozyHexColorSchema,
        delegationToken: cozyHexColorSchema,
      })
      .strict(),
    environment: z
      .object({
        floor: cozyHexColorSchema,
        wood: cozyHexColorSchema,
        woodDark: cozyHexColorSchema,
        lamp: cozyHexColorSchema,
        monitorIdle: cozyHexColorSchema,
        plant: cozyHexColorSchema,
        metal: cozyHexColorSchema,
        night: cozyHexColorSchema,
      })
      .strict(),
    scene: z
      .object({
        terrainBands: z.tuple([
          cozyHexColorSchema,
          cozyHexColorSchema,
          cozyHexColorSchema,
          cozyHexColorSchema,
        ]),
        scatter: cozyHexColorSchema,
        terraSky: z
          .object({
            dayZenith: cozyHexColorSchema,
            dayHorizon: cozyHexColorSchema,
            dayGround: cozyHexColorSchema,
            dusk: cozyHexColorSchema,
            nightZenith: cozyHexColorSchema,
            nightHorizon: cozyHexColorSchema,
            nightGround: cozyHexColorSchema,
            nightAmbient: cozyHexColorSchema,
            nightFill: cozyHexColorSchema,
          })
          .strict(),
      })
      .strict(),
    sessionPalette: z.tuple([
      cozyHexColorSchema,
      cozyHexColorSchema,
      cozyHexColorSchema,
      cozyHexColorSchema,
      cozyHexColorSchema,
      cozyHexColorSchema,
    ]),
    materials: z
      .object({
        matte: materialRecipeSchema,
        wood: materialRecipeSchema,
        paintedMetal: materialRecipeSchema,
        brushedMetal: materialRecipeSchema,
        softGlow: materialRecipeSchema,
      })
      .strict(),
  })
  .strict();

export type CozyTheme = z.infer<typeof cozyThemeSchema>;
export type CozyHexColor = z.infer<typeof cozyHexColorSchema>;
export type CozyMaterialRecipeName = keyof CozyTheme["materials"];

export const COZY_THEME: CozyTheme = cozyThemeSchema.parse(cozyThemeJson);

export const COZY_CSS_VARIABLES = {
  "--canvas": COZY_THEME.ui.canvas,
  "--surface": COZY_THEME.ui.surface,
  "--raised": COZY_THEME.ui.raised,
  "--elevated": COZY_THEME.ui.elevated,
  "--border": COZY_THEME.ui.border,
  "--strong-border": COZY_THEME.ui.strongBorder,
  "--text": COZY_THEME.ui.text,
  "--muted": COZY_THEME.ui.muted,
  "--dim": COZY_THEME.ui.dim,
  "--selection": COZY_THEME.semantic.selection,
  "--working": COZY_THEME.semantic.working,
  "--error": COZY_THEME.semantic.error,
  "--success": COZY_THEME.semantic.success,
  "--waiting": COZY_THEME.semantic.waiting,
  "--idle": COZY_THEME.semantic.idle,
  "--delegation-active": COZY_THEME.semantic.delegationActive,
  "--delegation-pending": COZY_THEME.semantic.delegationPending,
  "--delegation-token": COZY_THEME.semantic.delegationToken,
  "--floor": COZY_THEME.environment.floor,
  "--wood": COZY_THEME.environment.wood,
  "--wood-dark": COZY_THEME.environment.woodDark,
  "--lamp": COZY_THEME.environment.lamp,
  "--monitor-idle": COZY_THEME.environment.monitorIdle,
  "--plant": COZY_THEME.environment.plant,
  "--metal": COZY_THEME.environment.metal,
  "--night": COZY_THEME.environment.night,
} satisfies Record<`--${string}`, CozyHexColor>;
