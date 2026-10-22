/** Pointer + drag input written by DOM listeners, read by the camera rig. */
export interface ControlState {
  /** Pointer over the stage, normalised −1…1 (desktop mouse only). */
  px: number;
  py: number;
  dragging: boolean;
  /** User rotation offsets (radians) and their velocities for inertia. */
  yaw: number;
  pitch: number;
  vYaw: number;
  vPitch: number;
  /** performance.now() of the last user input; auto motion resumes after a pause. */
  lastInput: number;
  /** Pixels moved during the current press — a click only counts below a threshold. */
  travel: number;
}

export function createControls(): ControlState {
  return {
    px: 0,
    py: 0,
    dragging: false,
    yaw: 0,
    pitch: 0,
    vYaw: 0,
    vPitch: 0,
    lastInput: 0,
    travel: 0,
  };
}
