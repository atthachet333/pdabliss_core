-- Development-only demo sign-in bypass (additive): an audit event type for it.
-- The bypass itself is code gated on NODE_ENV / ENABLE_DEMO_ROUTES
-- (src/auth/demo-bypass.ts); production never takes that path.

-- AlterEnum
ALTER TYPE "AuthEventType" ADD VALUE 'DEMO_AUTH_BYPASS';
