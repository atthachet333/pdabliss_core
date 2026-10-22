import { zodResolver } from '@hookform/resolvers/zod';
import { CircleCheck, Info } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ContactDetails } from '@/components/contact/ContactDetails';
import { PageHero } from '@/components/layout/PageHero';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { controlClass } from '@/components/ui/fieldStyles';
import { Container } from '@/components/ui/Section';
import { usePageMeta } from '@/lib/usePageMeta';

const ContactSchema = z.object({
  name: z.string().trim().min(2, 'กรุณากรอกชื่อ-นามสกุล'),
  company: z.string().trim().min(2, 'กรุณากรอกชื่อบริษัท'),
  email: z.email('รูปแบบอีเมลไม่ถูกต้อง'),
  interest: z.enum(['demo', 'plans', 'other'], { message: 'กรุณาเลือกหัวข้อ' }),
  message: z.string().trim().min(10, 'กรุณาระบุรายละเอียดอย่างน้อย 10 ตัวอักษร').max(2000),
});
type ContactValues = z.infer<typeof ContactSchema>;

export default function ContactPage() {
  usePageMeta('ติดต่อเรา', 'ติดต่อทีมงาน PDA BLISS CORE เพื่อขอเดโมหรือสอบถามแพ็กเกจ');
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ContactValues>({ resolver: zodResolver(ContactSchema), defaultValues: { interest: 'demo' } });

  // EP00: the form validates on the client only and sends nothing anywhere.
  const onSubmit = () => setSubmitted(true);

  const describedBy = (field: keyof ContactValues) => (errors[field] ? `${field}-error` : undefined);

  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="พูดคุยกับทีม PDA BLISS CORE"
        lead="เล่าให้เราฟังว่าแผนกไหนในองค์กรของคุณต้องการเชื่อมงานกันมากที่สุด"
      />
      <Container className="grid gap-10 pb-24 lg:grid-cols-[1fr_1.2fr]">
        <aside className="space-y-4">
          <div className="rounded-card border border-border-soft bg-surface-base/80 p-6">
            <h2 className="text-h3 text-text-primary">สิ่งที่เราจะคุยกัน</h2>
            <ul className="mt-4 space-y-2 text-label text-text-secondary">
              <li>• แผนกที่ต้องการเริ่มใช้งานก่อน</li>
              <li>• เอกสารและขั้นตอนอนุมัติที่ใช้อยู่</li>
              <li>• โครงสร้างแพ็กเกจที่เหมาะกับองค์กร</li>
            </ul>
          </div>
          {/* EP05: channels read from the central contact config (config/contact.ts). */}
          <div className="rounded-card border border-border-soft bg-surface-base/80 p-6">
            <h2 className="text-h3 text-text-primary">ช่องทางติดต่อ</h2>
            <ContactDetails className="mt-5" />
          </div>
          <p className="flex items-start gap-2.5 rounded-2xl border border-border-soft bg-surface-raised/40 p-4 text-caption text-text-secondary">
            <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
            ช่วงพัฒนาระบบ (EP00): แบบฟอร์มนี้ตรวจสอบข้อมูลบนหน้าจอเท่านั้น และยังไม่ส่งข้อมูลไปยังเซิร์ฟเวอร์
          </p>
        </aside>

        <div className="rounded-card border border-border-soft bg-surface-base/80 p-6 sm:p-8">
          {submitted ? (
            <div role="status" className="flex flex-col items-center py-12 text-center">
              <CircleCheck className="size-12 text-success" aria-hidden />
              <h2 className="mt-4 text-h3 text-text-primary">ข้อมูลถูกต้องครบถ้วน</h2>
              <p className="mt-2 max-w-sm text-label text-text-secondary">
                ในเวอร์ชันเดโมนี้ยังไม่มีการส่งข้อมูลจริง ระบบรับข้อความจะเปิดใช้งานในรอบพัฒนาถัดไป
              </p>
              <Button variant="secondary" className="mt-6" onClick={() => setSubmitted(false)}>
                กลับไปที่แบบฟอร์ม
              </Button>
            </div>
          ) : (
            <form noValidate onSubmit={handleSubmit(onSubmit)} className="grid gap-5 sm:grid-cols-2">
              <Field id="name" label="ชื่อ-นามสกุล" error={errors.name?.message}>
                <input id="name" autoComplete="name" className={controlClass(!!errors.name)} aria-invalid={!!errors.name} aria-describedby={describedBy('name')} {...register('name')} />
              </Field>
              <Field id="company" label="บริษัท" error={errors.company?.message}>
                <input id="company" autoComplete="organization" className={controlClass(!!errors.company)} aria-invalid={!!errors.company} aria-describedby={describedBy('company')} {...register('company')} />
              </Field>
              <div className="sm:col-span-2">
                <Field id="email" label="อีเมลที่ทำงาน" error={errors.email?.message}>
                  <input id="email" type="email" autoComplete="email" className={controlClass(!!errors.email)} aria-invalid={!!errors.email} aria-describedby={describedBy('email')} {...register('email')} />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field id="interest" label="หัวข้อที่สนใจ" error={errors.interest?.message}>
                  <select id="interest" className={controlClass(!!errors.interest)} aria-invalid={!!errors.interest} {...register('interest')}>
                    <option value="demo">ขอดูเดโมระบบ</option>
                    <option value="plans">สอบถามแพ็กเกจ</option>
                    <option value="other">อื่น ๆ</option>
                  </select>
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field id="message" label="รายละเอียด" error={errors.message?.message}>
                  <textarea id="message" rows={5} className={controlClass(!!errors.message, true)} aria-invalid={!!errors.message} aria-describedby={describedBy('message')} {...register('message')} />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" size="lg" disabled={isSubmitting} className="w-full sm:w-auto">
                  ตรวจสอบและส่งข้อความ
                </Button>
              </div>
            </form>
          )}
        </div>
      </Container>
    </>
  );
}
