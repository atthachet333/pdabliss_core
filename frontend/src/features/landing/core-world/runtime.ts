import { Vector3 } from 'three';
import { NODE_LAYOUT } from './constants';
import type { OrbitDepartmentId, StoryStage } from './types';

export const ORBIT_IDS = Object.keys(NODE_LAYOUT) as OrbitDepartmentId[];

/**
 * Mutable per-frame scene state. React props (hover, selection, story stage)
 * are copied in on change; every useFrame reads from here, so interaction never
 * forces React re-renders of the scene graph.
 */
export interface WorldRuntime {
  hovered: OrbitDepartmentId | null;
  selected: OrbitDepartmentId | null;
  stage: StoryStage;
  /** Smoothed stage blends (0…1), eased every frame toward the current stage. */
  mix: { spread: number; separate: number; process: number; recede: number };
  /** Node positions in the ring's local (yaw) space, updated each frame. */
  nodes: Record<OrbitDepartmentId, Vector3>;
  /** 0…1 per node: highlighted (hovered / selected). */
  emphasis: Record<OrbitDepartmentId, number>;
}

export function createRuntime(): WorldRuntime {
  const vec = () => new Vector3();
  const zero = () => 0;
  return {
    hovered: null,
    selected: null,
    stage: 0,
    mix: { spread: 0, separate: 0, process: 0, recede: 0 },
    nodes: Object.fromEntries(ORBIT_IDS.map((id) => [id, vec()])) as WorldRuntime['nodes'],
    emphasis: Object.fromEntries(ORBIT_IDS.map((id) => [id, zero()])) as WorldRuntime['emphasis'],
  };
}

/** The department currently in focus (hover wins over selection). */
export function activeId(rt: WorldRuntime): OrbitDepartmentId | null {
  return rt.hovered ?? rt.selected;
}
