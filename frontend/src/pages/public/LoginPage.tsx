import { zodResolver } from '@hookform/resolvers/zod';
import { CircleAlert, Eye, EyeOff, FlaskConical, Loader2, Lock } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import { LogoMark } from '@/components/brand/Logo';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { controlClass } from '@/components/ui/fieldStyles';
import { Container } from '@/components/ui/Section';
import { usePageMeta } from '@/lib/usePageMeta';
import { PROTOTYPE_ENABLED } from '@/prototype/config';
import { lastWorkspace, prototypeSignIn, usePrototypeSession } from '@/prototype/session';

const LoginSchema = z.object({
  username: z.string().trim().min(1, 'กรุณากรอกชื่อผู้ใช้'),
  password: z.string().min(1, 'กรุณากรอกรหัสผ่าน'),
});
type LoginValues = z.infer<typeof LoginSchema>;

/** Only same-app workspace paths are accepted as a post-login destination. */
function safeNext(next: string | null): string | null {
  return next && /^\/app\/[a-z-]+(\/[a-z-]+)?$/.test(next) ? next : null;
}

function UnavailableNotice() {
  return (
    <div className="mx-auto w-full max-w-md rounded-card border border-border-strong surface-glass p-8 text-center">
      <LogoMark className="mx-auto size-11" />
      <h1 className="mt-5 text-h2 text-text-primary">เข้าสู่ระบบ</h1>
      <p className="mt-3 text-label text-text-secondary">
        ระบบเข้าสู่ระบบจะเปิดให้บริการเมื่อพร้อมใช้งานจริง
      </p>
    </div>
  );
}

export default function LoginPage() {
  usePageMeta('เข้าสู่ระบบ', 'เข้าสู่พื้นที่ทำงาน PDA BLISS CORE');
  const session = usePrototypeSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({ resolver: zodResolver(LoginSchema) });

  const destination = safeNext(params.get('next')) ?? `/app/${lastWorkspace()}`;

  if (!PROTOTYPE_ENABLED) {
    return (
      <section className="pt-36 pb-24">
        <Container>
          <UnavailableNotice />
        </Container>
      </section>
    );
  }

  if (session && !pending) return <Navigate to={destination} replace />;

  const onSubmit = async (values: LoginValues) => {
    setFailed(false);
    setPending(true);
    // Brief pause so the loading state can be reviewed; there is no network call.
    await new Promise((r) => setTimeout(r, 350));
    if (prototypeSignIn(values.username, values.password)) {
      navigate(destination, { replace: true });
    } else {
      setPending(false);
      setFailed(true);
    }
  };

  return (
    <section className="relative isolate overflow-hidden pt-32 pb-24 sm:pt-40">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_50%_50%_at_50%_10%,rgb(25_195_154/0.16),transparent_70%)]"
      />
      <Container>
        <div className="mx-auto w-full max-w-md rounded-card border border-border-strong surface-glass p-6 sm:p-9">
          <div className="flex items-center justify-between">
            <LogoMark className="size-11" />
            <span className="inline-flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning/10 px-2.5 py-1 text-caption font-medium text-warning">
              <FlaskConical className="size-3.5" aria-hidden />
              ต้นแบบ
            </span>
          </div>
          <h1 className="mt-6 text-h2 text-text-primary">เข้าสู่ระบบ</h1>
          <p className="mt-2 text-label text-text-secondary">
            บัญชีทดลองสำหรับตรวจหน้าจอพื้นที่ทำงานของแต่ละแผนกเท่านั้น
          </p>

          <form noValidate onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5">
            <Field id="login-username" label="ชื่อผู้ใช้" error={errors.username?.message}>
              <input
                id="login-username"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                className={controlClass(!!errors.username)}
                aria-invalid={!!errors.username}
                aria-describedby={errors.username ? 'login-username-error' : undefined}
                {...register('username')}
              />
            </Field>
            <Field id="login-password" label="รหัสผ่าน" error={errors.password?.message}>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className={`${controlClass(!!errors.password)} pr-12`}
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? 'login-password-error' : undefined}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-control text-text-muted hover:text-text-primary"
                >
                  {showPassword ? (
                    <EyeOff className="size-4.5" aria-hidden />
                  ) : (
                    <Eye className="size-4.5" aria-hidden />
                  )}
                </button>
              </div>
            </Field>

            {failed && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 p-3 text-caption text-danger"
              >
                <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง
              </p>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={pending}>
              {pending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Lock className="size-4" aria-hidden />
              )}
              {pending ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
            </Button>
          </form>

          <p className="mt-6 border-t border-border-soft pt-5 text-caption text-text-muted">
            ในระบบจริง ผู้ใช้จะเข้าสู่พื้นที่ทำงานของแผนกตนเองโดยอัตโนมัติหลังเข้าสู่ระบบ
          </p>
        </div>
      </Container>
    </section>
  );
}
