import { Link } from 'react-router';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { publicSignup } from '@/config/site';
import { AuthFrame } from '@/features/auth/AuthFrame';
import { AUTH_COPY } from '@/features/auth/copy';
import { AuthLocale } from '@/features/auth/locale';
import { RegisterForm } from '@/features/auth/RegisterForm';
import { useCopy } from '@/i18n/useCopy';
import { usePageMeta } from '@/lib/usePageMeta';

/** /register (EP23) — self-registration. Never locale-prefixed; noindex. */
export default function RegisterPage() {
  return <AuthLocale>{publicSignup() ? <RegisterForm /> : <InvitationOnly />}</AuthLocale>;
}

/** EP48.5 F1/F3: with public sign-up closed, explain how accounts are created (no form). */
function InvitationOnly() {
  const c = useCopy(AUTH_COPY);
  usePageMeta(c.invite.closedTitle, c.invite.closedLead, { index: false });
  return (
    <AuthFrame kicker={c.invite.kicker} title={c.invite.closedTitle} lead={c.invite.closedLead}>
      <div className="mt-6" data-signup="invitation-only">
        <Link to="/login" className={buttonClasses('primary', 'lg')}>
          {c.common.signIn}
        </Link>
      </div>
    </AuthFrame>
  );
}
