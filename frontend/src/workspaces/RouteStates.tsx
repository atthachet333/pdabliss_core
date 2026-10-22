import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { isRouteErrorResponse, useLocation, useRouteError } from 'react-router';
import { ErrorState, LinkButton } from '@/components/core';
import { WORKSPACE_ORDER, WORKSPACES, workspacePath, type WorkspaceId } from './registry';

function useWorkspaceFromUrl(): WorkspaceId | null {
  const seg = useLocation().pathname.split('/')[2] ?? '';
  return (WORKSPACE_ORDER as readonly string[]).includes(seg) ? (seg as WorkspaceId) : null;
}

/** Unknown module inside a workspace — rendered within the shell, not a redirect. */
export function WorkspaceNotFound({ workspace }: { workspace: WorkspaceId }) {
  return (
    <>
      <h1 className="sr-only">ไม่พบหน้า</h1>
      <ErrorState
        kind="notFound"
        action={
          <LinkButton to={workspacePath(workspace)} icon={ArrowLeft}>
            กลับไปหน้าภาพรวม{WORKSPACES[workspace].shortTh}
          </LinkButton>
        }
      />
    </>
  );
}

/** Route errorElement for workspace pages: a calm unexpected-error state inside the shell. */
export function RouteError() {
  const error = useRouteError();
  const workspace = useWorkspaceFromUrl();
  const [reference] = useState(() => `UI-${Date.now().toString(36).toUpperCase()}`);
  const back = workspace && (
    <LinkButton to={workspacePath(workspace)} variant="ghost">
      กลับหน้าภาพรวม
    </LinkButton>
  );
  if (isRouteErrorResponse(error) && error.status === 404) {
    return <ErrorState kind="notFound" action={back} />;
  }
  return (
    <>
      <h1 className="sr-only">เกิดข้อผิดพลาด</h1>
      <ErrorState
        kind="unexpected"
        onRetry={() => window.location.reload()}
        action={back}
        reference={reference}
      />
    </>
  );
}
