# Contact & Consultation — `/contact` and `/consultation` (EP13 · split in EP24.1.4.3)

Since EP24.1.4.3 there are two routes, each answering one question:

- **`/contact` — "How do I reach PDA BLISS, and where are you?"** A short intro with phone, LINE
  and email (once each), the company name and address, a large live Google map and one
  *Open directions in Google Maps* action, then an invitation — *ยังไม่แน่ใจว่าควรเริ่มจากตรงไหน?*
  → **เริ่มปรึกษาเรา** → `/consultation`. No form, no wizard.
- **`/consultation` — "Help me work out what my organization needs."** The guided consultation:
  **a consultation, not a support ticket**. The visitor starts from what they want to talk about,
  adds as much context as they like, reviews a summary — and can always talk to PDA BLISS
  directly instead. Demos, package questions, Enterprise quotations, implementation, integration
  and general enquiries land here.

> **เริ่มจากปัญหา — ไม่จำเป็นต้องเริ่มจากชื่อฟีเจอร์**

## Layout

`/contact` (`pages/public/ContactPage.tsx`): compact intro with a consultation signpost → the
endpoint rail (phone · LINE OA · email) (`ContactOverview.tsx`) → location: company, address, a
dark-rendered live map and one directions link (`Location.tsx`) → the consultation gateway (six
numbered nodes running into *เริ่มปรึกษาเรา*). The map is Contact-only. Visual language since
EP24.1.4.4: see [EP24_1_4_4_REPORT.md](EP24_1_4_4_REPORT.md); page-local controls and metadata
type live in `features/contact/coreControls.ts`.

`/consultation` (`pages/public/ConsultationPage.tsx`):

- **Hero** — a quiet *back to Contact* link, *เล่าให้เราฟังว่าองค์กรของคุณทำงานอย่างไร* and the
  problem-first supporting copy.
- **Context banner** — what the page already knows from where the visitor came from
  (*คุณกำลังสอบถาม Enterprise · คุณกำลังสนใจ คลังสินค้า · คุณกำลังดู การผลิต*).
- **Guided flow** — one question at a time, six short steps on a numbered progress rail
  (`01 … 06`, CSS counters, so accessible names stay the plain labels). All six labels show when
  the flow is wide enough (container query, `@2xl`); narrower, the numbers plus the current step's
  name, so labels are never clipped. Topics are selectable paths with a technical code.
- **Context rail** (sticky on wide screens; below the flow on phones, as a disclosure) — progress
  (`01 / 06`), the choices so far, and a compact *prefer to talk now?* fallback with phone, LINE
  and email. No address, no map, no Google request.

## Inquiry model (`features/contact/model.ts`)

| Field | Values | Required |
| --- | --- | --- |
| `type` | `demo` · `consulting` · `enterprise` · `plans` · `integration` · `implementation` · `general` | yes (step 1) |
| `plan` | `starter` · `business` · `professional` · `enterprise` (from pricing) | no |
| `industry` | the six EP11 industries + `other` | no |
| `size` | `1-20` · `21-50` · `51-100` · `101-300` · `301-1000` · `1000+` (ranges only) | no |
| `departments` | the six EP06 departments | no |
| `problems` | 11 common problems, mapped to the EP09 solution taxonomy where one exists | no |
| `message` | free text, ≤ 1,500 characters | no |
| `method` | `line` (default) · `phone` · `email` | yes |
| `contact` | `name`, `company` (required) · `phone`, `email`, `lineId` (optional) | name + company |
| `source` | the prefill the visitor arrived with | — |

The seven types are grouped by intent — *getting to know CORE* (demo, general), *implementation
and use* (consulting, implementation, integration), *packages and pricing* (plans, enterprise) —
so the selector reads as three short choices, not seven equal cards.

## Steps

1. **Topic** — *คุณอยากคุยเรื่องอะไร?* (required)
2. **Organization** — industry, size range, departments of interest (optional, skippable)
3. **Situation** — common problems and a short note (optional, skippable)
4. **Reply method** — LINE, phone or email
5. **Contact details** — name and company, plus one way to reach the visitor that matches the
   chosen method
6. **Review** — the summary, the honest delivery notice and the privacy note

Moving forward focuses the next question's heading; validation focuses the first invalid field
and shows an error count. Earlier steps stay one click away in the step bar; a step past contact
details is never reachable while the details are invalid.

## Validation (`validation.ts`)

- Name and company: at least 2 characters.
- Email (if given): a valid address. Phone (if given): 9–15 digits. LINE ID (if given):
  2–40 of letters, digits, `.`, `_`, `-`, optionally starting with `@`.
- The reply method needs its channel: phone → phone; email → email; LINE → LINE ID **or** phone.
- Every message exists in Thai, English and Simplified Chinese.

## Query-prefill contract

| Parameter | Values | Effect |
| --- | --- | --- |
| `topic` (older alias: `interest`) | `demo` `consulting` `enterprise` `plans` `integration` `implementation` `general` (aliases: `quote`, `packages`, `pricing`, `api`, `training`, `consult`, `other`) | selects the topic |
| `plan` | `starter` `business` `professional` `enterprise` | shows the plan context; without `topic` implies `plans` (`enterprise` → `enterprise`) |
| `industry` | `distribution` `services` `projects` `retail` `property` `manufacturing` | preselects the industry and shows the context |
| `department` | `executive` `sales` `operations` `warehouse` `purchasing` `accounting` | preselects the department and shows the context |

Unknown values are ignored (the flow starts at step 1 with nothing selected; nothing is ever
submitted automatically). The browser referrer is never used, and what the visitor types never
enters the URL. `consultationPath()` builds links that follow the contract. Older
`/consultation?topic=…` links are forwarded to `/consultation?topic=…` with the same context.
Site CTAs that use it:

| From | Link |
| --- | --- |
| Pricing hero / closing demo | `/consultation?topic=demo` |
| Package explorer (non-Enterprise) | `/consultation?topic=demo&plan=<plan>` |
| Configurator summary | `?topic=plans&plan=<plan>` · Enterprise: `?topic=enterprise&plan=enterprise` |
| Pricing Enterprise block | `?topic=enterprise&plan=enterprise` · talk: `?topic=consulting` |
| `/enterprise` hero + closing | quote: `?topic=enterprise` · talk: `?topic=consulting` |
| Department pages | `?topic=consulting&department=<id>` |
| Industry pages / overview | `?topic=consulting&industry=<id>` / `?topic=consulting` |
| `/about` hero + ending | `?topic=consulting` |
| `/why-core` *ขอ Demo* | `?topic=demo` |

| Homepage closing *ขอคำปรึกษา* · floating panel *ขอรับคำปรึกษา* | `/consultation` |
| `/solutions` closing · `/how-core-works` hero *ขอ Demo* | `/consultation?topic=demo` |

Header *ติดต่อเรา*, mobile menu, footer, the homepage trust links, About and sign-in help still
go to `/contact`. There is no Consultation item in the navigation.

## Delivery — the honest limitation

There is **no delivery backend today**: no inquiry route, no email sending, no CRM, no LINE
Messaging API. `features/contact/delivery.ts` defines the seam:

```ts
interface InquiryDelivery {
  readonly available: boolean;
  send(inquiry: Inquiry): Promise<{ ok: true; reference?: string } | { ok: false; reason: 'unavailable' | 'failed' }>;
}
```

`getInquiryDelivery()` returns `UNAVAILABLE` (`available: false`, sends nothing, makes no
request). So the review step says plainly that the website has no online message service yet,
and the final button is **"เตรียมข้อความให้ PDA BLISS"** (prepare), not "send". After it the
page says **"ข้อความพร้อมแล้ว — แต่ยังไม่ได้ส่ง"** and hands the prepared message to the
visitor's own channels:

- **Send with your email app** — `mailto:` (central email) with a subject and the summary as
  the body
- **Chat on LINE OA** — the exact central LINE URL (new tab, announced)
- **Copy message** — to paste into the LINE chat
- **Call** — `tel:` the central number

No "sent successfully" text exists anywhere; tests check that no request is made.

### Connecting a real backend later

1. Add `POST /api/inquiries` to the backend: validate with the same rules (name, company, one
   matching channel, formats), rate-limit, then store or forward (email / CRM / LINE).
2. Return an HTTP-backed `InquiryDelivery` from `getInquiryDelivery()` with `available: true`.
3. In the review step, call `send()`; show success **only** on `{ ok: true }`, otherwise keep
   the hand-off channels.
4. Add a privacy notice for stored inquiries before enabling it.

## Direct contact

Always visible: phone **063-869-3614 (คุณวิน)**, **LINE OA @593oiwec**
(`https://line.me/R/ti/p/@593oiwec`), email **pdablissoffice@gmail.com** — all from
`config/contact.ts`. On `/contact` they appear once, in the intro; on `/consultation` as the
compact fallback beside the flow (and in the review step's hand-off). No response times are
promised.

## Privacy boundaries

Only what is needed to reply and understand the work. No national ID, financial data,
passwords, confidential documents or file upload; company size is a broad range; no revenue.
The review step repeats this. Nothing is stored or sent by the website.

## Structured data

`/contact` and `/about` add an Organization JSON-LD (not `/consultation`) built by `organizationSchema()`
(`config/company.ts`): legal name, the Thai name and brand as alternate names, the configured
site URL, the office address as printed (country TH), phone, email and the LINE OA as `sameAs`.
No logo, coordinates, founding date, headcount or other profiles.

## Files

```
frontend/src/features/contact/
├── model.ts        inquiry types/groups, query contract, options, Inquiry, parsePrefill, contactPath
├── validation.ts   detail rules → error keys
├── delivery.ts     InquiryDelivery seam (UNAVAILABLE today)
├── state.ts        flow reducer (steps, reached, errors, prepared)
├── copy.ts         th / en / zh-CN
├── summaryText.ts  summary rows + plain-text hand-off
├── Summary.tsx     summary list
├── ContactFlow.tsx the six steps + review / prepared
├── Panels.tsx      consultation hero, context banner, live summary, fallback channels
├── ContactOverview.tsx  /contact intro, direct channels, consultation invitation
├── contactPageCopy.ts   /contact copy (th / en / zh-CN)
├── Location.tsx    /contact location + live map
├── locationCopy.ts
└── contact.test.tsx
frontend/src/components/seo/OrganizationSchema.tsx
frontend/src/pages/public/ContactPage.tsx
frontend/src/pages/public/ConsultationPage.tsx
```
