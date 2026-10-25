import type { Phase } from '@/features/enterprise/model';
import type { Localized } from '@/i18n/useCopy';

/*
 * The implementation journey (EP16): ten practical steps, each inside one of
 * the six EP10 phases so the language matches /enterprise. Shared by the
 * /resources home (short names) and the implementation guide (full text).
 */

export const JOURNEY_STEPS = [
  { id: 'discover', phase: 'discover' },
  { id: 'mapping', phase: 'discover' },
  { id: 'responsibility', phase: 'design' },
  { id: 'workflow', phase: 'design' },
  { id: 'data', phase: 'prepare' },
  { id: 'configure', phase: 'configure' },
  { id: 'validate', phase: 'configure' },
  { id: 'train', phase: 'prepare' },
  { id: 'launch', phase: 'launch' },
  { id: 'improve', phase: 'improve' },
] as const satisfies readonly { id: string; phase: Phase }[];
export type JourneyStepId = (typeof JOURNEY_STEPS)[number]['id'];

export const JOURNEY_NAMES: Localized<Record<JourneyStepId, string>> = {
  th: {
    discover: 'ทำความเข้าใจองค์กร',
    mapping: 'Process Mapping',
    responsibility: 'ความรับผิดชอบของแต่ละแผนก',
    workflow: 'ออกแบบ Workflow',
    data: 'เตรียมข้อมูล',
    configure: 'ตั้งค่าระบบ',
    validate: 'ตรวจสอบความถูกต้อง',
    train: 'ฝึกอบรม',
    launch: 'เริ่มใช้งานจริง',
    improve: 'ปรับปรุงต่อเนื่อง',
  },
  en: {
    discover: 'Discover',
    mapping: 'Process mapping',
    responsibility: 'Department responsibility',
    workflow: 'Workflow design',
    data: 'Data preparation',
    configure: 'Configuration',
    validate: 'Validation',
    train: 'Training',
    launch: 'Launch',
    improve: 'Improve',
  },
  'zh-CN': {
    discover: '了解组织',
    mapping: '流程梳理',
    responsibility: '部门职责',
    workflow: '工作流设计',
    data: '数据准备',
    configure: '系统配置',
    validate: '验证',
    train: '培训',
    launch: '正式上线',
    improve: '持续改进',
  },
};
