import { ORBIT_DEPARTMENTS } from '@/config/departments';
import type { OrbitDepartmentId } from './types';

/** The six orbiting departments (no three.js import — safe for the fallback and DOM). */
export const ORBIT_LIST = ORBIT_DEPARTMENTS as readonly OrbitDepartmentId[];
