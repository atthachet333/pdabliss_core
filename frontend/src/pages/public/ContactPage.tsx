import { zodResolver } from '@hookform/resolvers/zod';
import { CircleCheck, Info } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams } from 'react-router';
import { z } from 'zod';
import { ContactDetails } from '@/components/contact/ContactDetails';
import { PageHero } from '@/components/layout/PageHero';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { controlClass } from '@/components/ui/fieldStyles';
import { Container } from '@/components/ui/Section';
import { useCopy, type Localized } from '@/i18n/useCopy';
import { usePageMeta } from '@/lib/usePageMeta';

const th = {
  metaTitle: 'ติดต่อเรา',
  metaDescription: 'ติดต่อทีมงาน PDA BLISS CORE เพื่อขอเดโมหรือสอบถามแพ็กเกจ',
  title: 'พูดคุยกับทีม PDA BLISS CORE',
  lead: 'เล่าให้เราฟังว่าแผนกไหนในองค์กรของคุณต้องการเชื่อมงานกันมากที่สุด',
  agendaTitle: 'สิ่งที่เราจะคุยกัน',
  agenda: [
    'แผนกที่ต้องการเริ่มใช้งานก่อน',
    'เอกสารและขั้นตอนอนุมัติที่ใช้อยู่',
    'โครงสร้างแพ็กเกจที่เหมาะกับองค์กร',
  ],
  channels: 'ช่องทางติดต่อ',
  devNote:
    'ช่วงพัฒนาระบบ (EP00): แบบฟอร์มนี้ตรวจสอบข้อมูลบนหน้าจอเท่านั้น และยังไม่ส่งข้อมูลไปยังเซิร์ฟเวอร์',
  okTitle: 'ข้อมูลถูกต้องครบถ้วน',
  okBody:
    'ในเวอร์ชันเดโมนี้ยังไม่มีการส่งข้อมูลจริง ระบบรับข้อความจะเปิดใช้งานในรอบพัฒนาถัดไป',
  back: 'กลับไปที่แบบฟอร์ม',
  fields: {
    name: 'ชื่อ-นามสกุล',
    company: 'บริษัท',
    email: 'อีเมลที่ทำงาน',
    interest: 'หัวข้อที่สนใจ',
    message: 'รายละเอียด',
  },
  interests: { demo: 'ขอดูเดโมระบบ', plans: 'สอบถามแพ็กเกจ', other: 'อื่น ๆ' },
  errors: {
    name: 'กรุณากรอกชื่อ-นามสกุล',
    company: 'กรุณากรอกชื่อบริษัท',
    email: 'รูปแบบอีเมลไม่ถูกต้อง',
    interest: 'กรุณาเลือกหัวข้อ',
    message: 'กรุณาระบุรายละเอียดอย่างน้อย 10 ตัวอักษร',
  },
  submit: 'ตรวจสอบและส่งข้อความ',
};

const COPY: Localized<typeof th> = {
  th,
  en: {
    metaTitle: 'Contact us',
    metaDescription: 'Contact the PDA BLISS CORE team to request a demo or ask about packages.',
    title: 'Talk to the PDA BLISS CORE team',
    lead: 'Tell us which departments in your organization most need to connect their work.',
    agendaTitle: 'What we will discuss',
    agenda: [
      'The departments you want to start with',
      'The documents and approval steps you use today',
      'The package structure that fits your organization',
    ],
    channels: 'Contact channels',
    devNote:
      'Development phase (EP00): this form only validates on screen and does not send anything to a server yet.',
    okTitle: 'Everything looks complete',
    okBody:
      'This demo version does not send data yet. Message delivery will be enabled in the next development round.',
    back: 'Back to the form',
    fields: {
      name: 'Full name',
      company: 'Company',
      email: 'Work email',
      interest: 'Topic',
      message: 'Details',
    },
    interests: { demo: 'Request a system demo', plans: 'Ask about packages', other: 'Other' },
    errors: {
      name: 'Please enter your full name',
      company: 'Please enter your company name',
      email: 'Please enter a valid email address',
      interest: 'Please choose a topic',
      message: 'Please write at least 10 characters',
    },
    submit: 'Check and send message',
  },
  'zh-CN': {
    metaTitle: '联系我们',
    metaDescription: '联系 PDA BLISS CORE 团队，申请演示或咨询方案。',
    title: '与 PDA BLISS CORE 团队沟通',
    lead: '告诉我们贵公司哪些部门最需要把工作连接起来。',
    agendaTitle: '我们将讨论的内容',
    agenda: ['希望最先启用的部门', '目前使用的单据与审批流程', '适合贵公司的方案结构'],
    channels: '联系方式',
    devNote: '开发阶段（EP00）：此表单仅在页面上校验，尚不会把数据发送到服务器。',
    okTitle: '信息填写完整',
    okBody: '此演示版本尚未真正发送数据，消息接收功能将在下一轮开发中启用。',
    back: '返回表单',
    fields: {
      name: '姓名',
      company: '公司',
      email: '工作邮箱',
      interest: '咨询主题',
      message: '详细说明',
    },
    interests: { demo: '申请系统演示', plans: '咨询方案', other: '其他' },
    errors: {
      name: '请输入姓名',
      company: '请输入公司名称',
      email: '邮箱格式不正确',
      interest: '请选择主题',
      message: '请至少填写 10 个字符',
    },
    submit: '检查并发送',
  },
};

function makeSchema(e: (typeof th)['errors']) {
  return z.object({
    name: z.string().trim().min(2, e.name),
    company: z.string().trim().min(2, e.company),
    email: z.email(e.email),
    interest: z.enum(['demo', 'plans', 'other'], { message: e.interest }),
    message: z.string().trim().min(10, e.message).max(2000),
  });
}
type ContactValues = z.infer<ReturnType<typeof makeSchema>>;

export default function ContactPage() {
  const c = useCopy(COPY);
  usePageMeta(c.metaTitle, c.metaDescription);
  const [submitted, setSubmitted] = useState(false);
  const schema = useMemo(() => makeSchema(c.errors), [c.errors]);
  // `?interest=plans` (from /pricing) pre-selects the topic; anything else keeps "demo".
  const [params] = useSearchParams();
  const initialInterest = params.get('interest') === 'plans' ? 'plans' : 'demo';
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ContactValues>({
    resolver: zodResolver(schema),
    defaultValues: { interest: initialInterest },
  });

  // EP00: the form validates on the client only and sends nothing anywhere.
  const onSubmit = () => setSubmitted(true);

  const describedBy = (field: keyof ContactValues) =>
    errors[field] ? `${field}-error` : undefined;

  return (
    <>
      <PageHero eyebrow="Contact" title={c.title} lead={c.lead} />
      <Container className="grid gap-10 pb-24 lg:grid-cols-[1fr_1.2fr]">
        <aside className="space-y-4">
          <div className="rounded-card border border-border-soft bg-surface-base/80 p-6">
            <h2 className="text-h3 text-text-primary">{c.agendaTitle}</h2>
            <ul className="mt-4 space-y-2 text-label text-text-secondary">
              {c.agenda.map((a) => (
                <li key={a}>• {a}</li>
              ))}
            </ul>
          </div>
          {/* EP05: channels read from the central contact config (config/contact.ts). */}
          <div className="rounded-card border border-border-soft bg-surface-base/80 p-6">
            <h2 className="text-h3 text-text-primary">{c.channels}</h2>
            <ContactDetails className="mt-5" />
          </div>
          <p className="flex items-start gap-2.5 rounded-2xl border border-border-soft bg-surface-raised/40 p-4 text-caption text-text-secondary">
            <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
            {c.devNote}
          </p>
        </aside>

        <div className="rounded-card border border-border-soft bg-surface-base/80 p-6 sm:p-8">
          {submitted ? (
            <div role="status" className="flex flex-col items-center py-12 text-center">
              <CircleCheck className="size-12 text-success" aria-hidden />
              <h2 className="mt-4 text-h3 text-text-primary">{c.okTitle}</h2>
              <p className="mt-2 max-w-sm text-label text-text-secondary">{c.okBody}</p>
              <Button variant="secondary" className="mt-6" onClick={() => setSubmitted(false)}>
                {c.back}
              </Button>
            </div>
          ) : (
            <form
              noValidate
              onSubmit={handleSubmit(onSubmit)}
              className="grid gap-5 sm:grid-cols-2"
            >
              <Field id="name" label={c.fields.name} error={errors.name?.message}>
                <input
                  id="name"
                  autoComplete="name"
                  className={controlClass(!!errors.name)}
                  aria-invalid={!!errors.name}
                  aria-describedby={describedBy('name')}
                  {...register('name')}
                />
              </Field>
              <Field id="company" label={c.fields.company} error={errors.company?.message}>
                <input
                  id="company"
                  autoComplete="organization"
                  className={controlClass(!!errors.company)}
                  aria-invalid={!!errors.company}
                  aria-describedby={describedBy('company')}
                  {...register('company')}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field id="email" label={c.fields.email} error={errors.email?.message}>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    className={controlClass(!!errors.email)}
                    aria-invalid={!!errors.email}
                    aria-describedby={describedBy('email')}
                    {...register('email')}
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field id="interest" label={c.fields.interest} error={errors.interest?.message}>
                  <select
                    id="interest"
                    className={controlClass(!!errors.interest)}
                    aria-invalid={!!errors.interest}
                    {...register('interest')}
                  >
                    <option value="demo">{c.interests.demo}</option>
                    <option value="plans">{c.interests.plans}</option>
                    <option value="other">{c.interests.other}</option>
                  </select>
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field id="message" label={c.fields.message} error={errors.message?.message}>
                  <textarea
                    id="message"
                    rows={5}
                    className={controlClass(!!errors.message, true)}
                    aria-invalid={!!errors.message}
                    aria-describedby={describedBy('message')}
                    {...register('message')}
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" size="lg" disabled={isSubmitting} className="w-full sm:w-auto">
                  {c.submit}
                </Button>
              </div>
            </form>
          )}
        </div>
      </Container>
    </>
  );
}
