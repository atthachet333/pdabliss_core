import type { DepartmentCode } from '../billing/catalog.js';
import type { CompanyRole, PermissionEffect } from '../generated/prisma/enums.js';
import type { OperationalPermission } from '../permissions/catalog.js';

/*
 * The demo personas (EP28.1) — the ONE definition of every seeded demo
 * account of the demo company: the seed (src/auth/bootstrap.ts) applies it,
 * the development sign-in bypass allowlists exactly these addresses
 * (src/auth/demo-bypass.ts), and the development-only persona list on the
 * sign-in page reads it (GET /api/v1/demo/personas). Docs: docs/DEMO_PERSONAS.md.
 *
 * Personas differ by role, department assignment and branch access only —
 * what each may do comes from the EP27 role defaults and resolver, never from
 * code here. One persona carries a single permission exception to exercise
 * the exception screens. Passwords come from the local environment
 * (`passwordEnv`); nothing here is a secret.
 *
 * Applied ONCE per account (marker: a DEMO_PERSONA_APPLIED audit entry on the
 * membership); an administrator's later change of role, departments, branch
 * access, job title or exceptions is never undone by a later seed.
 */

export type DemoPersonaKey =
  | 'OWNER'
  | 'SYSTEM_ADMIN'
  | 'EXECUTIVE'
  | 'SALES'
  | 'OPERATIONS'
  | 'WAREHOUSE'
  | 'PURCHASING'
  | 'ACCOUNTING'
  | 'STAFF';

export interface DemoPersona {
  key: DemoPersonaKey;
  /** Short English label for the development persona list. */
  label: string;
  email: string;
  /** Environment key holding this account's local password (never committed). */
  passwordEnv: string;
  /** The four EP23 accounts must have a password; the EP28.1 ones are seeded when theirs is set. */
  required: boolean;
  fullName: string;
  jobTitle: string;
  role: CompanyRole;
  /** Department assignments (the first is primary). Only what the persona needs. */
  departments: readonly DepartmentCode[];
  /** 'ALL' or the branch codes of a SELECTED_BRANCHES scope. */
  branches: 'ALL' | readonly string[];
  exception?: { permission: OperationalPermission; effect: PermissionEffect };
  purpose: string;
}

export const DEMO_PERSONAS: readonly DemoPersona[] = [
  {
    key: 'OWNER',
    label: 'Owner',
    email: 'owner.demo@pdabliss.com',
    passwordEnv: 'DEMO_COMPANY_OWNER_PASSWORD',
    required: true,
    fullName: 'Demo Company Owner',
    jobTitle: 'Managing Director',
    role: 'COMPANY_OWNER',
    departments: [],
    branches: 'ALL',
    purpose: 'Full company authority: every enabled department and branch, all administration.',
  },
  {
    key: 'SYSTEM_ADMIN',
    label: 'System Admin',
    email: 'admin.demo@pdabliss.com',
    passwordEnv: 'DEMO_SYSTEM_ADMIN_PASSWORD',
    required: true,
    fullName: 'Demo System Admin',
    jobTitle: 'IT & System Administrator',
    role: 'SYSTEM_ADMIN',
    departments: [],
    branches: 'ALL',
    purpose:
      'Company administration (branches, people, permissions, master data) below the owner; no department work unless assigned.',
  },
  {
    key: 'EXECUTIVE',
    label: 'Executive',
    email: 'executive.demo@pdabliss.com',
    passwordEnv: 'DEMO_EXECUTIVE_PASSWORD',
    required: true,
    fullName: 'Demo Executive',
    jobTitle: 'Executive Director',
    role: 'EXECUTIVE',
    departments: [],
    branches: 'ALL',
    purpose: 'Read-only view across every enabled department; no create, edit or approve.',
  },
  {
    key: 'SALES',
    label: 'Sales',
    email: 'sales.demo@pdabliss.com',
    passwordEnv: 'DEMO_SALES_PASSWORD',
    required: false,
    fullName: 'Demo Sales',
    jobTitle: 'Sales Coordinator',
    role: 'DEPARTMENT_STAFF',
    departments: ['SALES'],
    branches: ['00000'],
    purpose: 'Sales staff at the Head Office: customers and items to read, Sales workspace only.',
  },
  {
    key: 'OPERATIONS',
    label: 'Operations',
    email: 'operations.demo@pdabliss.com',
    passwordEnv: 'DEMO_OPERATIONS_PASSWORD',
    required: false,
    fullName: 'Demo Operations',
    jobTitle: 'Operations Manager',
    role: 'DEPARTMENT_MANAGER',
    departments: ['OPERATIONS'],
    branches: ['00000', '00001'],
    purpose:
      'Operations manager in two branches (branch selector): maintains the item master, units and categories.',
  },
  {
    key: 'WAREHOUSE',
    label: 'Warehouse',
    email: 'warehouse.demo@pdabliss.com',
    passwordEnv: 'DEMO_WAREHOUSE_PASSWORD',
    required: false,
    fullName: 'Demo Warehouse',
    jobTitle: 'Warehouse Officer',
    role: 'DEPARTMENT_STAFF',
    departments: ['WAREHOUSE'],
    branches: ['00001'],
    purpose:
      'Warehouse staff in the demo branch only — the privacy persona: item identity and its branch locations, nothing financial, no customers or suppliers.',
  },
  {
    key: 'PURCHASING',
    label: 'Purchasing',
    email: 'purchasing.demo@pdabliss.com',
    passwordEnv: 'DEMO_PURCHASING_PASSWORD',
    required: false,
    fullName: 'Demo Purchasing',
    jobTitle: 'Purchasing Manager',
    role: 'DEPARTMENT_MANAGER',
    departments: ['PURCHASING'],
    branches: ['00000', '00001'],
    purpose:
      'Purchasing manager in two branches: maintains suppliers, reads items — the persona for EP29 purchase requests.',
  },
  {
    key: 'ACCOUNTING',
    label: 'Accounting',
    email: 'accounting.demo@pdabliss.com',
    passwordEnv: 'DEMO_ACCOUNTING_PASSWORD',
    required: false,
    fullName: 'Demo Accounting',
    jobTitle: 'Accounting Manager',
    role: 'DEPARTMENT_MANAGER',
    departments: ['ACCOUNTING'],
    branches: ['00000'],
    purpose: 'Accounting manager at the Head Office: reads customer and supplier identity only.',
  },
  {
    key: 'STAFF',
    label: 'Staff (legacy)',
    email: 'staff.demo@pdabliss.com',
    passwordEnv: 'DEMO_STAFF_PASSWORD',
    required: true,
    fullName: 'Demo Staff',
    jobTitle: 'Warehouse Assistant (legacy demo)',
    role: 'DEPARTMENT_STAFF',
    departments: ['WAREHOUSE'],
    branches: ['00001'],
    exception: { permission: 'warehouse.receiving.process', effect: 'DENY' },
    purpose:
      'Legacy EP25 account kept for compatibility: Warehouse staff in the demo branch with ONE exception (receiving denied) to exercise the exception screens.',
  },
];

/** Exactly these addresses may use the development sign-in bypass. */
export const DEMO_PERSONA_EMAILS: readonly string[] = DEMO_PERSONAS.map((p) => p.email);

/** The audit action marking that a persona's defaults were applied (once). */
export const DEMO_PERSONA_MARKER = 'DEMO_PERSONA_APPLIED' as const;
