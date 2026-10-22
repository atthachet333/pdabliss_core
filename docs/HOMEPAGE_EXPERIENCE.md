# Homepage Experience — PDA BLISS CORE (EP04)

The public homepage (`/`) is one story in eleven chapters. It is designed to move a visitor
through **WOW → curiosity → trust → product understanding**, in that order. Every chapter
has its own art direction; none of them is a "heading + paragraph + three cards" block.

Code: `frontend/src/pages/public/HomePage.tsx` composes the chapters from
`frontend/src/features/landing/home/` (the hero stays in `features/landing/sections/HeroExperience.tsx`
and the EP03 scene in `features/landing/core-world/`).

## The story

| # | Anchor | Chapter | Art direction | Interaction |
| - | ------ | ------- | ------------- | ----------- |
| 01 | `#core-world` | **CORE World** — *แต่ละแผนกทำงานได้เต็มที่ / ทุกงานเชื่อมเป็นระบบเดียว* | EP03 WebGL scene, unchanged | EP03 behaviour unchanged (drag on CORE/orbit, hover/click departments, CORE click and Escape clear) |
| 02 | `#who-for` (`#fit`) | **Who For** — *CORE ถูกสร้างขึ้นสำหรับองค์กร ที่งานเริ่มเดินผ่านหลายแผนก* | An organization drawn as a living diagram: a team → departments → connected operations → organization (TEAM / DEPARTMENTS / CONNECTED OPERATIONS / ORGANIZATION) | Short desktop pin (`250vh`) driven by native scroll; phones get stacked stages. Ends in the fit checklist `#fit` |
| 03 | `#complexity` | **Complexity** — *เมื่อองค์กรเติบโต เร็วกว่ากระบวนการ* | Colder, desaturated palette with grain. Nine friction artefacts (spreadsheets, chat follow-ups, duplicated entry, unclear versions…) as abstract cards — no third-party logos — scattered, tilted and tangled | Fragments drift further apart with scroll (transform only) |
| 04 | `#why-core` | **Why CORE** — editorial statements, then two philosophies | Large centred typography; one shape morphs from ONE LARGE SYSTEM (one block divided into menus) into CORE (purpose-built workspaces joined through one centre) | Short desktop pin (`230vh`); static comparison on phones / reduced motion. Never names or attacks another product |
| 05 | `#department-worlds` | **Department Worlds** — *แยกประสบการณ์การทำงาน แต่ไม่แยกข้อมูล* | Six environments, each with its own procedural SVG grammar and light: Sales (routes), Operations (timeline + now line), Warehouse (rack grid + scan), Purchasing (supplier network + approval path), Accounting (ledger + verification ticks), Executive (horizon arcs). The room's light follows the world's EP02 accent | Accessible tablist (←/→/Home/End). A **real EP02 workspace preview** (lazy, sample data) per world |
| 06 | `#connected-flow` | **Connected Flow** — *งานหนึ่งชิ้น เดินผ่านหลายแผนก โดยไม่หลุดระหว่างทาง* | Route map: six stations around CORE; every hop passes through CORE | Five selectable flows (การขาย, การจัดซื้อ, การรับสินค้า, การส่งมอบ, การจ่ายเงิน — native radio group). The route draws, a pulse travels station to station while in view; pause control. Labelled illustrative |
| 07 | `#error-control` | **Human Error** — *ระบบที่ดี ไม่ควรรอให้ความผิดพลาดเกิดขึ้น แล้วค่อยบอกว่าใครเป็นคนผิด* | Warm amber accent; the PREVENT / DETECT / ALERT / CONTROL / TRACE band | Five scenarios (tablist). Each plays while in view: the flow is interrupted → the problem is named → a correction appears → the flow continues. Replay button. Copy says "CORE ถูกออกแบบมาเพื่อรองรับ…" |
| 08 | `#executive` | **Executive Perspective** — *ข้อมูลจากทุกแผนก กลายเป็นภาพเดียวสำหรับผู้บริหาร* | Five department signal lines converge into the command view | Real EP02 executive preview: qualitative department states and exceptions — no revenue or invented financial metrics |
| 09 | `#enterprise` | **Enterprise** — *เริ่มจากกระบวนการที่องค์กรใช้วันนี้ และขยายไปพร้อมกับความซับซ้อนในวันข้างหน้า* | Isometric stack of eight architectural layers: Department-, Role-, Workflow-, Approval-, Audit-, Integration-, API-, Automation-ready | Layers separate as the visitor scrolls past (no pin). Honest note: "ready" = what CORE is structured to support, not a certification |
| 10 | `#trust` | **Trust** — PDA BLISS COMPANY LIMITED | Editorial, quiet, typographic; one philosophy quote | Links: รู้จัก PDA BLISS (`/about`), Why We Built CORE (`/#why-core`), ติดต่อเรา (`/contact`) |
| 11 | `#begin` | **Final CTA** — *ระบบที่ดีควรเข้ากับวิธีที่องค์กรของคุณทำงาน ไม่ใช่บังคับให้องค์กรทำงานตามระบบ* | The CORE language returns: CSS orbits and a breathing light (no second WebGL canvas) | ขอคำปรึกษา (`/contact`), สำรวจ CORE เพิ่มเติม (`/features`), ดูแผนกทั้งหมด (`/departments`). No price |

There is **no pricing section** on the homepage. `/pricing` still exists (header แพ็คเกจ menu
and the footer).

A quiet chapter indicator (dots, labels on hover/focus; plain anchor links) appears on very wide
screens (≥ 1536 px) once the visitor leaves the hero — it never sits over the CORE stage, and
only its 24 px dots are hit targets.

## Header

Superseded in EP05: the header, mega menus, mobile navigation, footer, cookie consent and
floating utilities are now the shared public shell — see [PUBLIC_SHELL.md](PUBLIC_SHELL.md).
The homepage-specific rules that remain: the shell's floating utility dock stays hidden while
the CORE hero is in view, and cross-page hash links (`/#connected-flow`) scroll to their
chapter after navigation.

## Scrolling rules

- Native scrolling only. No wheel or touch handlers on the page, no `scroll-snap`, no
  scroll-jacking. Pins are short (`230–250vh` wrappers with a `sticky` inner viewport) and
  desktop-only; progress is read from the scroll position (`useScroll`) and never written.
- Autoplaying content (Connected Flow, Human Error) runs only while in view and offers a
  pause or replay control.

## Product previews

`home/previews.tsx` renders real EP02 parts (`components/core`: `DataTable`, `StatusBadge`,
`WorkflowTimeline`, `ProgressBar`, `TaskList`, `ExceptionList`) with the workspace registry and
the same sample data the prototype uses. They are:

- lazy-loaded (the internal UI kit stays out of the homepage's main chunk);
- `aria-hidden` + `inert` inside a labelled `<figure>`, so they never add an `h1`, focus stops
  or duplicate landmarks;
- **privacy-correct:** Warehouse shows quantities, lots and dates — never price or cost;
  Accounting shows documents and states, not amounts; Executive shows qualitative states.

## Accessibility

One `h1` (the hero). Every chapter is a `<section>` labelled by its `h2`. All selectors are
real controls (tablists with roving focus, a native radio group, disclosure buttons). Visual
diagrams are `aria-hidden`; their content is always present as text (step lists, layer list,
principle list). Touch targets ≥ 44 px.

## Reduced motion

Chapters read `prefers-reduced-motion` live (`usePrefersReducedMotion`). Under reduce: pins
show their final composition, no autoplay (Connected Flow shows every step; Human Error shows
the finished annotated scenario), no scroll-driven transforms, CSS loops stop (global rule).
Nothing is hidden — the page is complete without motion.

## Copy rules

Thai-first. No invented metrics, customers, logos, certifications or uptime figures. Features
that are not live are described as what "CORE ถูกออกแบบมาเพื่อรองรับ…", and illustrative
content is labelled as such.
