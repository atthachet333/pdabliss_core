import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Info, Lock } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { z } from 'zod';
import { LogoMark } from '@/components/brand/Logo';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { controlClass } from '@/components/ui/fieldStyles';
import { Container } from '@/components/ui/Section';
import { usePageMeta } from '@/lib/usePageMeta';
import { WORKSPACE_ORDER, WORKSPACES } from '@/workspaces/registry';

const LoginSchema = z.object({
  email: z.email('รูปแบบอีเมลไม่ถูกต้อง'),
  password: z.string().min(8, 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'),
});
type LoginValues = z.infer<typeof LoginSchema>;

export default function LoginPage() {
  usePageMeta('เข้าสู่ระบบ', 'เข้าสู่พื้นที่ทำงาน PDA BLISS CORE ของคุณ');
  const [notice, setNotice] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({ resolver: zodResolver(LoginSchema) });

  return (
    <section className="relative isolate overflow-hidden pt-32 pb-24 sm:pt-40">
      <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_50%_50%_at_50%_10%,rgb(25_195_154/0.18),transparent_70%)]" />
      <Container className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-start">
        <div className="mx-auto w-full max-w-md rounded-card border border-border-strong surface-glass p-6 sm:p-8 lg:mx-0">
          <LogoMark className="size-11" />
          <h1 className="mt-5 text-h2 text-text-primary">เข้าสู่ระบบ</h1>
          <p className="mt-2 text-label text-text-secondary">
            ระบบจะพาคุณเข้าสู่พื้นที่ทำงานของแผนกคุณโดยตรง
          </p>

          <form noValidate onSubmit={handleSubmit(() => setNotice(true))} className="mt-8 space-y-5">
            <Field id="login-email" label="อีเมล" error={errors.email?.message}>
              <input
                id="login-email"
                type="email"
                autoComplete="username"
                className={controlClass(!!errors.email)}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'login-email-error' : undefined}
                {...register('email')}
              />
            </Field>
            <Field id="login-password" label="รหัสผ่าน" error={errors.password?.message}>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                className={controlClass(!!errors.password)}
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? 'login-password-error' : undefined}
                {...register('password')}
              />
            </Field>
            <Button type="submit" size="lg" className="w-full">
              <Lock className="size-4" aria-hidden />
              เข้าสู่ระบบ
            </Button>
            {notice && (
              <p role="status" className="flex items-start gap-2 rounded-xl border border-info/30 bg-info/10 p-3 text-caption text-info">
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                การยืนยันตัวตนจริงจะเปิดใช้ในรอบพัฒนาถัดไป ระหว่างนี้ทดลองใช้พื้นที่ทำงานเดโมด้านข้างได้
              </p>
            )}
          </form>
        </div>

        <div>
          <p className="eyebrow">Demo workspaces</p>
          <h2 className="mt-3 text-h3 text-text-primary">ทดลองพื้นที่ทำงานตามบทบาท</h2>
          <p className="mt-2 max-w-lg text-label text-text-secondary">
            ในระบบจริง ผู้ใช้จะไม่ต้องเลือกแผนก — ระบบพาเข้าสู่พื้นที่ทำงานตามสิทธิ์ของบัญชีโดยอัตโนมัติ
            รายการนี้มีไว้สำหรับเดโมเท่านั้น (ข้อมูลตัวอย่าง)
          </p>
          <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
            {WORKSPACE_ORDER.map((id) => {
              const ws = WORKSPACES[id];
              const Icon = ws.icon;
              return (
                <li key={id}>
                  <Link
                    to={`/app/${id}`}
                    className="group flex items-center gap-3 rounded-2xl border border-border-soft bg-surface-base/80 p-4 transition-[border-color,background-color] duration-200 hover:border-border-brand hover:bg-surface-raised"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-overlay group-hover:bg-brand-primary/15">
                      <Icon className="size-5 text-brand-soft group-hover:text-brand-glow" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-label font-medium text-text-primary">{ws.nameTh}</span>
                      <span className="block truncate text-caption text-text-muted">{ws.persona.role}</span>
                    </span>
                    <ArrowRight className="size-4 text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-brand-glow" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </Container>
    </section>
  );
}
