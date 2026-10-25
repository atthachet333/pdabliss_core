import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Chapter, Frame, Stage as StagePlane } from '@/components/editorial/Layout';
import { Segmented } from '@/components/ui/Segmented';
import { useDepartments } from '@/config/departments';
import { DEPT_PAGES, deptPath, type DeptKey } from '@/features/departments/catalog';
import { Head } from '@/features/enterprise/parts';
import { getSolution } from '@/features/solutions/model';
import { DeptDot } from '@/features/story/parts';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { fill } from '@/lib/fill';
import { RESOURCES_COPY } from '../copy';
import { RESOURCE_META } from '../meta';
import { CategoryTag, ChipGroup, ResourceRow } from '../parts';
import {
  DEPARTMENT_READING,
  getResource,
  PROBLEM_GUIDE,
  PROBLEMS,
  resourcePath,
  START_PATHS,
  STAGES,
  type ProblemId,
  type ResourceId,
  type Stage,
  type StartPath,
} from '../registry';

/* ------------------------------------------------------------------ */
/* 02 Start here — three reading paths                                  */
/* ------------------------------------------------------------------ */

export function StartHere() {
  const c = useCopy(RESOURCES_COPY).start;
  const meta = useCopy(RESOURCE_META);
  const { href } = useLocale();
  const paths = Object.keys(START_PATHS) as StartPath[];
  return (
    <Chapter id="start" labelledBy="start-title" plane="navy" space="md">
      <Frame width="wide">
        <Head eyebrow={c.eyebrow} id="start-title" title={c.title} lead={c.lead} />
        <ol className="mt-12 divide-y divide-border-soft border-y border-border-soft">
          {paths.map((p, i) => (
            <li
              key={p}
              data-start-path={p}
              className="group/path grid grid-cols-1 gap-5 py-7 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.6fr)] lg:gap-12"
            >
              <div className="flex gap-4">
                <span aria-hidden className="text-h2 leading-none font-semibold text-brand-glow/80">
                  {String.fromCharCode(65 + i)}
                </span>
                <div>
                  <h3 className="text-h3 text-text-primary">{c.paths[p].q}</h3>
                  <p className="mt-1 text-label text-text-muted">{c.paths[p].note}</p>
                </div>
              </div>
              {/* The path: guides in order, joined by a line that lights on hover */}
              <ol className="relative grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-0">
                <span
                  aria-hidden
                  className="absolute top-[1.6rem] right-[16%] left-[16%] hidden h-px bg-border-strong transition-colors duration-500 group-hover/path:bg-brand-glow/60 motion-reduce:transition-none sm:block"
                />
                {START_PATHS[p].map((id, n) => (
                  <li key={id} className="relative sm:px-2 sm:text-center">
                    <Link
                      to={href(resourcePath(id))}
                      data-resource-link={id}
                      className="group flex min-h-11 items-center gap-3 rounded-2xl p-2 hover:bg-white/[0.03] sm:flex-col sm:gap-2"
                    >
                      <span className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-dark text-caption font-semibold text-brand-soft tabular shadow-[inset_0_0_0_1px_rgb(62_240_192/0.4)]">
                        {n + 1}
                        <span className="sr-only">{fill(c.step, { n: n + 1 })}</span>
                      </span>
                      <span className="text-label font-medium text-text-primary group-hover:text-brand-soft">
                        {meta.resources[id].title}
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ol>
      </Frame>
    </Chapter>
  );
}

/* ------------------------------------------------------------------ */
/* 03 Learn by problem — EP09 problems → guide, Solutions, How it works */
/* ------------------------------------------------------------------ */

export function ProblemsChapter() {
  const c = useCopy(RESOURCES_COPY).problems;
  const meta = useCopy(RESOURCE_META);
  const { href } = useLocale();
  const [problem, setProblem] = useState<ProblemId>('fallingThrough');
  const solution = getSolution(problem);
  const guide = PROBLEM_GUIDE[problem];
  return (
    <Chapter id="by-problem" labelledBy="problem-title" space="md">
      <Frame width="wide">
        <Head eyebrow={c.eyebrow} id="problem-title" title={c.title} lead={c.lead} />
        <div className="mt-10">
          <Segmented
            label={c.group}
            options={PROBLEMS.map((p) => ({ value: p, label: c.items[p].label }))}
            value={problem}
            onChange={setProblem}
            className="grid w-full grid-cols-2 sm:grid-cols-4"
          />
        </div>
        <StagePlane glow="warm" className="mt-6 p-6 sm:p-9">
          <div
            data-problem={problem}
            aria-live="polite"
            className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)] lg:gap-14"
          >
            <div>
              <p className="text-caption text-text-muted">{c.cause}</p>
              <p className="mt-2 text-h3 font-semibold text-text-primary">
                {c.items[problem].label}
              </p>
              <p className="mt-2 text-body text-text-secondary">{c.items[problem].cause}</p>
            </div>
            <ul className="space-y-3">
              <li>
                <Link
                  to={href(resourcePath(guide))}
                  data-problem-link="guide"
                  className="group flex min-h-11 items-center justify-between gap-4 rounded-2xl bg-white/[0.04] px-5 py-4 hover:bg-white/[0.07]"
                >
                  <span>
                    <span className="text-caption text-brand-soft">{c.guide}</span>
                    <span className="mt-0.5 block text-label font-semibold text-text-primary">
                      {meta.resources[guide].title}
                    </span>
                  </span>
                  <ArrowRight
                    aria-hidden
                    className="size-4 shrink-0 text-brand-soft transition-transform group-hover:translate-x-1"
                  />
                </Link>
              </li>
              <li>
                <Link
                  to={href(`/solutions#${solution.anchor}`)}
                  data-problem-link="solution"
                  className="group flex min-h-11 items-center justify-between gap-4 rounded-2xl px-5 py-3 shadow-[inset_0_0_0_1px_rgb(190_235_222/0.08)] hover:bg-white/[0.03]"
                >
                  <span>
                    <span className="text-caption text-text-muted">{c.solution}</span>
                    <span className="block text-label text-text-primary">
                      {c.items[problem].label}
                    </span>
                  </span>
                  <ArrowUpRight aria-hidden className="size-4 shrink-0 text-text-muted" />
                </Link>
              </li>
              <li>
                <Link
                  to={href(`/how-core-works#${solution.workflow}`)}
                  data-problem-link="workflow"
                  className="group flex min-h-11 items-center justify-between gap-4 rounded-2xl px-5 py-3 shadow-[inset_0_0_0_1px_rgb(190_235_222/0.08)] hover:bg-white/[0.03]"
                >
                  <span>
                    <span className="text-caption text-text-muted">{c.workflow}</span>
                    <span className="block text-label text-text-primary">
                      {c.chapters[solution.workflow]}
                    </span>
                  </span>
                  <ArrowUpRight aria-hidden className="size-4 shrink-0 text-text-muted" />
                </Link>
              </li>
            </ul>
          </div>
        </StagePlane>
      </Frame>
    </Chapter>
  );
}

/* ------------------------------------------------------------------ */
/* 04 Learn by department                                               */
/* ------------------------------------------------------------------ */

export function DepartmentsChapter() {
  const c = useCopy(RESOURCES_COPY).departments;
  const { href } = useLocale();
  const departments = useDepartments();
  const [dept, setDept] = useState<DeptKey>('warehouse');
  const name = (d: DeptKey) => departments.find((x) => x.id === d)!.name;
  return (
    <Chapter id="by-department" labelledBy="department-title" plane="navy" space="md">
      <Frame width="wide">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.5fr)] lg:gap-16">
          <div>
            <Head eyebrow={c.eyebrow} id="department-title" title={c.title} lead={c.lead} />
            <ChipGroup
              label={c.group}
              options={DEPT_PAGES.map((d) => ({
                value: d,
                label: (
                  <>
                    <DeptDot id={d} />
                    {name(d)}
                  </>
                ),
              }))}
              value={dept}
              onChange={setDept}
              dataKey="data-dept"
              className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2"
              chipClassName={(on) =>
                cn(
                  'text-left whitespace-normal',
                  on
                    ? 'bg-white/[0.08] font-semibold text-text-primary shadow-[inset_0_0_0_1px_rgb(62_240_192/0.4)]'
                    : 'text-text-secondary shadow-[inset_0_0_0_1px_rgb(190_235_222/0.08)] hover:text-text-primary',
                )
              }
            />
          </div>
          <div data-dept-reading={dept} aria-live="polite">
            <ol className="divide-y divide-border-soft border-y border-border-soft">
              {DEPARTMENT_READING[dept].map((id, i) => (
                <li key={id}>
                  <ResourceRow
                    id={id}
                    index={i}
                    note={(c.reasons[dept] as Partial<Record<ResourceId, string>>)[id]}
                  />
                </li>
              ))}
            </ol>
            <Link
              to={href(deptPath(dept))}
              data-dept-page={dept}
              className="mt-5 inline-flex min-h-11 items-center gap-1.5 text-label text-brand-soft underline-offset-4 hover:underline"
            >
              {fill(c.page, { name: name(dept) })}
              <ArrowUpRight aria-hidden className="size-4" />
            </Link>
          </div>
        </div>
      </Frame>
    </Chapter>
  );
}

/* ------------------------------------------------------------------ */
/* 05 Learn by organization stage                                       */
/* ------------------------------------------------------------------ */

export function StagesChapter() {
  const c = useCopy(RESOURCES_COPY).stages;
  const meta = useCopy(RESOURCE_META);
  const { href } = useLocale();
  const stages = Object.keys(STAGES) as Stage[];
  return (
    <Chapter id="by-stage" labelledBy="stage-title" space="md">
      <Frame width="wide">
        <Head eyebrow={c.eyebrow} id="stage-title" title={c.title} lead={c.lead} />
        <ol className="relative mt-12 grid grid-cols-1 gap-8 pl-6 md:grid-cols-2 md:pl-0 xl:grid-cols-4 xl:gap-6">
          {/* The growth line: vertical on phones, across on wide screens */}
          <span
            aria-hidden
            className="absolute top-1 bottom-1 left-[0.3rem] w-px bg-[linear-gradient(to_bottom,rgb(62_240_192/0.15),rgb(62_240_192/0.6))] md:hidden"
          />
          <span
            aria-hidden
            className="absolute top-[0.3rem] right-0 left-0 hidden h-px bg-[linear-gradient(90deg,rgb(62_240_192/0.15),rgb(62_240_192/0.6))] xl:block"
          />
          {stages.map((s, i) => (
            <li key={s} data-stage={s} className="relative">
              <span
                aria-hidden
                className="absolute top-1 -left-6 size-2.5 rounded-full bg-brand-glow shadow-[0_0_0_4px_rgb(5_11_18)] md:static md:mb-5 md:block"
                style={{ opacity: 0.45 + i * 0.18 }}
              />
              <p className="font-mono text-caption text-text-muted tabular">0{i + 1}</p>
              <h3 className="mt-1 text-h3 text-text-primary">{c.items[s].name}</h3>
              <p className="mt-1 text-label text-text-secondary">{c.items[s].focus}</p>
              <ul className="mt-4 space-y-1">
                {STAGES[s].map((id) => (
                  <li key={id}>
                    <Link
                      to={href(resourcePath(id))}
                      data-resource-link={id}
                      className="group flex min-h-11 items-center justify-between gap-3 border-t border-border-soft py-2"
                    >
                      <span className="min-w-0">
                        <CategoryTag
                          category={getResource(id).category}
                          className="text-[0.6875rem]"
                        />
                        <span className="block text-label text-text-primary group-hover:text-brand-soft">
                          {meta.resources[id].title}
                        </span>
                      </span>
                      <ArrowRight
                        aria-hidden
                        className="size-4 shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </Frame>
    </Chapter>
  );
}
