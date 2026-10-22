import type { DepartmentId } from '@/config/departments';

/** Adaptive rendering tier. `static` = no WebGL; render CoreWorldFallback. */
export type Quality = 'high' | 'medium' | 'low' | 'reduced' | 'static';

/**
 * Scroll story stage driving the scene (docs/CORE_WORLD.md):
 * 0 hero · 1 THE CORE · 2 different workspaces · 3 connected process · 4 toward product UI
 */
export type StoryStage = 0 | 1 | 2 | 3 | 4;

export type OrbitDepartmentId = Exclude<DepartmentId, 'executive'>;

/** Shared scene state. DOM controls and the canvas read/write the same values. */
export interface WorldSelection {
  /** Department under the pointer or keyboard focus (preview highlight). */
  hovered: OrbitDepartmentId | null;
  /** Department opened by click / Enter (focused scene + detail panel). */
  selected: OrbitDepartmentId | null;
}
