import { UserPlus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { authApi } from '@/features/auth/api';
import { AuthFrame, Notice } from '@/features/auth/AuthFrame';
import { AUTH_COPY } from '@/features/auth/copy';
import { commonError, errorCode, passwordProblem } from '@/features/auth/errors';
import { FieldError, PasswordField, TextField } from '@/features/auth/fields';
import { withLocale } from '@/features/auth/localeState';
import { fullNameProblem, normalizePhone } from '@/features/auth/profile';
import { PROFILE_COPY } from '@/features/auth/profileCopy';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { usePageMeta } from '@/lib/usePageMeta';

/*
 * EP48.5 F1 — /account/invitation for someone WITHOUT an account. Public self-service sign-up
 * is closed on the public host, so an invited person creates the account here, from the
 * invitation link: the server binds it to the invited address (no email field), verifies it
 * through the link itself, joins the company with the invited role, and opens NO session —
 * the person then signs in normally (password + emailed code). Someone who already has an
 * account signs in instead; the token stays in memory across that detour (InvitationPage).
 */

type Field = 'fullName' | 'phone' | 'password' | 'confirm' | 'terms';
type Errors = Partial<Record<Field, string>>;
const ORDER: Field[] = ['fullName', 'phone', 'password', 'confirm', 'terms'];
const NEXT = `/login?next=${encodeURIComponent('/account/invitation')}`;

export function InvitationSignup({ token }: { token: string }) {
  const c = useCopy(AUTH_COPY);
  const p = useCopy(PROFILE_COPY);
  const { locale } = useLocale();
  usePageMeta(c.invite.meta.title, c.invite.meta.description, { index: false });
  const [form, setForm] = useState({ fullName: '', phone: '', password: '', confirm: '' });
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [joined, setJoined] = useState<string | null>(null);

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((v) => ({ ...v, [key]: e.target.value }));

  const validate = (): Errors => {
    const next: Errors = {};
    const name = fullNameProblem(form.fullName);
    if (name) {
      next.fullName = name === 'required' ? p.errors.fullNameRequired : p.errors.fullNameInvalid;
    }
    if (form.phone.trim() && !normalizePhone(form.phone)) next.phone = p.errors.phoneInvalid;
    if (!form.password) next.password = c.common.required.password;
    else {
      // The server also refuses a password containing the invited address.
      const problem = passwordProblem(form.password, '');
      if (problem) next.password = c.common.policy[problem];
    }
    if (!form.confirm) next.confirm = c.common.required.confirm;
    else if (form.confirm !== form.password) next.confirm = c.common.mismatch;
    if (!terms) next.terms = c.common.required.terms;
    return next;
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    setFailure(null);
    const first = ORDER.find((k) => found[k]);
    if (first) {
      document.getElementById(`invite-${first}`)?.focus();
      return;
    }
    setPending(true);
    try {
      const res = await authApi.registerFromInvitation({
        token,
        password: form.password,
        fullName: form.fullName.trim().replace(/\s+/g, ' '),
        phone: form.phone.trim() || undefined,
        locale,
        acceptTerms: true,
      });
      setJoined(res.company.name);
    } catch (err) {
      const code = errorCode(err);
      setFailure(
        code === 'ACCOUNT_EXISTS'
          ? c.invite.accountExists
          : code === 'COMPANY_UNAVAILABLE'
            ? c.invite.companyUnavailable
            : ['TOKEN_EXPIRED', 'TOKEN_USED', 'TOKEN_INVALID'].includes(code)
              ? c.account.invitationBad
              : commonError(err, c),
      );
    } finally {
      setPending(false);
    }
  };

  const linkClass = cn(
    'inline-flex min-h-11 items-center text-label text-brand-soft',
    'underline-offset-4 hover:underline',
  );

  if (joined) {
    return (
      <AuthFrame kicker={c.invite.kicker} title={c.invite.title}>
        <div className="mt-6 space-y-4" data-invitation="account-created">
          <Notice tone="success">{c.invite.done(joined)}</Notice>
          <Link to="/login" {...withLocale(locale)} className={buttonClasses('primary', 'lg')}>
            {c.common.signIn}
          </Link>
        </div>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame kicker={c.invite.kicker} title={c.invite.title} lead={c.invite.lead}>
      <form noValidate onSubmit={onSubmit} className="mt-6 space-y-5" data-invitation="signup">
        <TextField
          id="invite-fullName"
          label={p.fullName}
          autoComplete="name"
          maxLength={120}
          required
          value={form.fullName}
          onChange={set('fullName')}
          error={errors.fullName}
          hint={p.fullNameHint}
        />
        <TextField
          id="invite-phone"
          label={
            <>
              {p.phone}{' '}
              <span className="font-normal text-text-muted">({c.common.optional})</span>
            </>
          }
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          maxLength={32}
          value={form.phone}
          onChange={set('phone')}
          error={errors.phone}
        />
        <PasswordField
          id="invite-password"
          label={c.common.password}
          autoComplete="new-password"
          required
          value={form.password}
          onChange={set('password')}
          error={errors.password}
          hint={c.common.passwordHint}
          showLabel={c.common.show}
          hideLabel={c.common.hide}
          capsLockLabel={c.common.capsLock}
        />
        <PasswordField
          id="invite-confirm"
          label={c.common.confirmPassword}
          autoComplete="new-password"
          required
          value={form.confirm}
          onChange={set('confirm')}
          error={errors.confirm}
          showLabel={c.common.show}
          hideLabel={c.common.hide}
          capsLockLabel={c.common.capsLock}
        />
        <div>
          <label className="flex min-h-6 items-start gap-3 text-label text-text-secondary">
            <input
              id="invite-terms"
              type="checkbox"
              checked={terms}
              onChange={(e) => setTerms(e.target.checked)}
              aria-invalid={!!errors.terms}
              aria-describedby={errors.terms ? 'invite-terms-error' : undefined}
              className="mt-1 size-4.5 shrink-0 accent-brand-primary"
            />
            <span>
              {c.register.termsBefore}{' '}
              <Link
                to="/terms"
                target="_blank"
                className="text-brand-soft underline underline-offset-4"
              >
                {c.register.terms}
              </Link>{' '}
              {c.register.termsAnd}{' '}
              <Link
                to="/privacy"
                target="_blank"
                className="text-brand-soft underline underline-offset-4"
              >
                {c.register.privacy}
              </Link>
            </span>
          </label>
          {errors.terms && <FieldError id="invite-terms-error">{errors.terms}</FieldError>}
        </div>

        {failure && <Notice tone="error">{failure}</Notice>}

        <button
          type="submit"
          disabled={pending}
          className={buttonClasses('primary', 'lg', 'w-full')}
        >
          <UserPlus className="size-4" aria-hidden />
          {pending ? c.invite.submitting : c.invite.submit}
        </button>
        <Link to={NEXT} {...withLocale(locale)} className={linkClass} data-link="invite-sign-in">
          {c.invite.haveAccount}
        </Link>
      </form>
    </AuthFrame>
  );
}
