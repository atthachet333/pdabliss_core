# Pricing & Packages — PDA BLISS CORE (EP07)

The public package and subscription experience at `/pricing` (`/en/pricing`, `/zh/pricing`).
Its message: **เริ่มจากสิ่งที่องค์กรต้องใช้** — start from what your organization needs.

> **Presentation only.** There is no billing backend, payment gateway, subscription database,
> invoicing or plan enforcement. Every price and rule on the page is presentation logic; the
> configurator and purchase flow are simulations that take no payment and create no account
> or workspace.

## Pricing philosophy

- **Priced per company.** One subscription = one company. CORE is built around an
  organization's connected workflow, not isolated individual accounts, so customers choose by
  the departments and the level of control they need — not by seats.
- **Every branch included.** All branches of that company live in the same workspace. There
  is no per-branch pricing. Another company (legal entity) needs its own subscription; CORE
  does not imply multi-company support.
- **No fixed public user limits.** Users are "จำนวนผู้ใช้งานตามที่ลงทะเบียนและขอบเขตบริการ".
  Additional users are an add-on or agreed scope. The configurator's user count is for
  simulation only and never changes a price.
- **No free plan, no free trial.** Visitors can always request a demo.
- **No VAT statement** on the page (neither "รวม VAT" nor "ไม่รวม VAT").
- **No invented proof**: no customer counts, savings percentages, ROI, uptime, logos,
  certifications or "best value" maths. Business is labelled แนะนำ by product positioning.

## Single source of truth

`frontend/src/features/pricing/plans.ts` holds every plan fact and rule. Copy files hold words
only; prices, limits and storage are filled in from `plans.ts` at render time, and the
explorer, configurator, comparison, recommendation and FAQ all read the same data.

```
frontend/src/features/pricing/
├── plans.ts             plan facts, annual policy, department rules, add-on availability, recommendation
├── copy.ts              th / en / zh-CN words (no numbers)
├── text.ts              words for plan facts (allowance, storage, users, Executive)
├── state.ts             shared selection (plan, billing), money formatter, section ids
├── controls.tsx         Segmented radio group, BillingToggle
├── CapabilityStack.tsx  the four-layer capability visual (SVG)
├── PlanPrice.tsx        price for a plan and billing cycle
├── PricingHero.tsx · PackageExplorer.tsx · CompanyAndBilling.tsx · PlanFinder.tsx
├── Configurator.tsx · Comparison.tsx · AddOnsAndServices.tsx · ClosingSections.tsx
└── pricing.test.tsx
frontend/src/pages/public/PricingPage.tsx  composes the page and owns the URL state
```

## The four packages

| | Starter | Business | Professional | Enterprise |
| - | - | - | - | - |
| Layer | Foundation · วางฐาน | Connected · เชื่อมต่อ | Controlled · ควบคุม | Tailored · ออกแบบเฉพาะ |
| Monthly | ฿399 | ฿699 · **แนะนำ** | ฿999 | ขอใบเสนอราคา |
| Company / branches | 1 company · all branches | 1 · all | 1 · all | 1 · all |
| Departments | up to 2 | up to 4 | all 6 standard | all + custom scope |
| Executive Workspace | — (from Business) | ✓ | ✓ full | ✓ |
| Storage | 3 GB | 10 GB | 30 GB | as agreed |
| Workflow | basic | cross-department | custom | organization-specific architecture |
| Approval | 1 level | multi-step | multi-level | organization-specific architecture |
| Automation rules | — | add-on | ✓ | ✓ |
| Custom roles / permissions | — | — | ✓ | project scope |
| Audit trail | — | basic | advanced | to organization scope |
| Notifications | basic | advanced | advanced + exception alerting | to organization scope |
| Reports | basic | advanced | advanced + Custom Reports | Custom Reports + dashboards, organization scope |
| Custom Reports | — | add-on | ✓ | ✓ |
| Custom dashboard | — | add-on | ✓ | ✓ |
| API / integration | not included | add-on | ✓ included | ✓ included + custom integration scope |
| Advanced import / export | — | — | ✓ | ✓ |
| Support | Email · LINE OA, business hours | priority | higher priority | dedicated · SLA where agreed |
| Call to action | Demo · configure | Demo · configure | Demo · configure | ขอใบเสนอราคา |

The **standard departments** are the six EP06 department pages: Executive, Sales, Operations,
Warehouse, Purchasing, Accounting. Starter cannot select Executive; Business and above can.

**Warehouse capability rule.** Whenever Warehouse is enabled — in any package — the core
warehouse controls come with it: Lot / Batch, Expiry, Stock Age, FEFO. Only advanced
warehouse automation rules follow the automation tier.

Enterprise capabilities "สามารถกำหนดในขอบเขตโครงการ" — they are not all included
automatically.

## Annual billing policy

| | Rule | Starter | Business | Professional |
| - | - | - | - | - |
| Monthly | normal price | ฿399 | ฿699 | ฿999 |
| Year 1 | pay the full 12 months | ฿4,788 | ฿8,388 | ฿11,988 |
| Year 2 | pay 10 months, use 12 | ฿3,990 | ฿6,990 | ฿9,990 |
| Year 3 onward | 15 % off the normal annual price | ≈ ฿4,070 | ≈ ฿7,130 | ≈ ฿10,190 |

**Calculation** (`annualPrices()` in `plans.ts`):

- normal annual = monthly × 12
- year 1 = monthly × 12
- year 2 = monthly × 10
- year 3+ exact = normal annual × 0.85 (4,069.80 · 7,129.80 · 10,189.80)
- year 3+ displayed = exact rounded to the nearest **10 THB**, always labelled "ประมาณ / approx. / 约"

The page never shows a single "save X %", because the benefit changes by year. Monthly is
presented as flexibility, annual as long-term value — monthly customers are not penalized in
the copy. Both include the same capabilities.

**Changes and cancellation** (no proration rules are published):

- Monthly: "เลือกแบบรายเดือนได้ และยกเลิกได้เมื่อจบรอบบิล". No refund promises are made.
- Upgrade: anytime.
- Downgrade: according to billing-cycle terms.

## Add-ons

Additional department · Additional users · Additional storage · API & Integration · Custom
workflow · Custom report · Custom dashboard · Automation package · Online training · On-site
training · Implementation service · Priority / dedicated support.

No add-on has a published price — each is "ประเมินตามขอบเขต". `ADDON_AVAILABILITY` in
`plans.ts` records, per plan, whether an add-on is **included**, an **add-on**, defined in the
**project scope** (Enterprise) or **not available** (start from a higher plan). Where an add-on
mirrors a plan fact (API, custom reports, dashboard, automation, workflow, support) the value
is derived from that fact, so they cannot disagree.

Adding departments: Starter is limited to 2 (more → start at Business); Business can add
departments on request ("ติดต่อเพื่อเพิ่มแผนก"); Professional includes all standard
departments; Enterprise defines custom departments in its scope.

## Services

- **Initial data migration** — "ย้ายข้อมูลเริ่มต้นโดยไม่มีค่าใช้จ่าย", with the subtle note
  "ขอบเขตการย้ายข้อมูลขึ้นอยู่กับรูปแบบและความพร้อมของข้อมูลเดิม".
- **Usage guide** — included in every package.
- **Training** — online, on-site, department or administrator training, charged per
  engagement; Enterprise may include training in its quotation.
- **Implementation support** and **Enterprise process mapping**.
- **Support tiers** as in the table above. No guaranteed response times are published.

## Enterprise quote model

Enterprise never uses the normal checkout. Its CTA is **ขอใบเสนอราคา** (secondary: พูดคุยกับ
ทีม PDA BLISS), and the flow is: consultation → organization requirements → process review →
quotation. Quotation links open `/contact?interest=plans`, which pre-selects "สอบถามแพ็กเกจ".

## CORE Early Access

"สิทธิพิเศษสำหรับองค์กรที่เริ่มใช้ CORE ในช่วงเปิดตัว": basic setup support, initial data
migration, an online onboarding session and price protection for an agreed period. No
percentage, no deadline, no countdown, no crossed-out prices; details are confirmed with the
team.

## Page structure

1. **Hero** — "เลือกระบบตามวิธีที่องค์กรของคุณทำงาน", per-company / all-branches copy,
   "เริ่มต้น ฿399 / เดือน", ดูแพ็คเกจ + ขอ Demo, the capability stack with all four layers.
2. **Package explorer** (`#packages`) — four plan tabs (keyboard tablist, sticky on phones),
   billing toggle, and the selected plan expanded: price, audience, allowances, capabilities,
   support, CTA and its capability layer.
3. **One company, every branch** (`#company`) — the model and why it is per company.
4. **Annual relationship** (`#billing`) — monthly vs annual, the three-step timeline, amounts
   per plan, change and cancellation policy.
5. **Find your package** (`#find-your-package`) — six questions, deterministic
   recommendation (`recommendPlan()`), no personal data.
6. **Configurator** (`#configure`) — package, departments (EP06 imagery, limits enforced,
   Executive blocked for Starter with the reason), approximate users, add-ons, billing; a
   summary that shows only the base package price and marks everything else "ต้องประเมิน
   เพิ่มเติม"; Enterprise switches to quote mode; the eight-step future purchase flow.
7. **Comparison** (`#compare`) — nine groups (Organization, Departments, Workflow, Warehouse,
   Reporting, Integration, Storage, Support, Services) as an accordion; a table on wide
   screens, one plan at a time on phones.
8. **Add-ons** (`#add-ons`), 9. **Onboarding & support** (`#onboarding`),
   10. **Enterprise** (`#enterprise`), 11. **Early Access** (`#early-access`),
   12. **FAQ** (`#faq`, answers built from `plans.ts`; heading on top, questions in two
   independent columns on desktop, one column below `lg`), 13. closing CTA.

### URL state

The selected plan is in the query string: `/pricing?plan=business`. Direct loads are safe —
unknown values fall back to Business — and older `#plan-<id>` links are understood. The
แพ็คเกจ mega menu links to `/pricing?plan=<id>#packages` (localized).

### Currency

Thai and English show `฿399`; English adds "Prices in Thai Baht (THB)". Chinese shows
`399 泰铢 / 月` and "价格以泰铢（THB）计". Amounts are never converted.

## Future checkout architecture

The page already models the self-service flow:

1. choose package → 2. choose departments → 3. user count → 4. add-ons → 5. monthly / annual
→ 6. company information → 7. payment → 8. create CORE workspace.

Steps 1–5 are simulated on the page today (state in `PricingPage` + `plans.ts` rules). A real
implementation should:

- move plan facts and the annual policy to the backend as the authority, keeping `plans.ts`
  as a typed mirror (or generating it), so displayed and charged prices cannot drift;
- validate department limits, Executive access and add-on availability server-side with the
  same rules (`adjustDepartments`, `toggleDepartment`, `ADDON_AVAILABILITY`);
- price add-ons only once they have approved prices — until then they stay "assessed by scope"
  and route to the team;
- keep Enterprise out of checkout (quotation flow);
- create the workspace only after confirmed payment, with one company per subscription.

## Accessibility & motion

- One H1; every section is labelled with an H2.
- Plan tabs: a tablist with roving focus (arrows, Home, End). Billing, recommendation and
  comparison choices: radio groups with the same keys. Comparison and FAQ: disclosure buttons
  with `aria-expanded`.
- Selected states carry a check mark; availability uses icons **and** words; Business's
  recommendation is a labelled badge.
- Targets are at least 44 px. The configurator fits at 320 px.
- The capability stack changes with CSS transitions only — no autoplay — and under reduced
  motion it switches instantly. It is decorative; every fact is also written in text.
