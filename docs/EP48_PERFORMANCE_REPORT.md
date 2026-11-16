# EP48 — Performance Report

Development measurements on this workstation (disposable PostgreSQL 18 cluster, backend in `tsx` development mode).
They show relative cost and bounds; they are **not** a production capacity claim (EP44 C-5 load test still applies).

## 1. Bundle (`npm run build`, `scripts/perf-budget.mjs`) — no budget raised

| Budget                      | Cap       | EP47    | EP48        | Change                     |
| --------------------------- | --------- | ------- | ----------- | -------------------------- |
| All JS (raw)                | 4,300 KiB | 4,163.5 | **4,223.1** | +59.6                      |
| Initial JS (gzip)           | 205 KiB   | 182.8   | **182.8**   | 0                          |
| Initial CSS (gzip)          | 52 KiB    | 50.8    | **50.9**    | +0.1                       |
| Static HTML (raw)           | 560 KiB   | 525.1   | **525.1**   | 0                          |
| HTML files                  | 111       | 111     | 111         | —                          |
| Largest public route (gzip) | 72 KiB    | 56.6    | 56.8        | +0.2 (a shared icon group) |

New lazy chunk `CommandCenter` ≈ 55 KiB raw (page + investigation + TH / EN / ZH copy), loaded only at
`/core/executive…`. The EP47 refresh hook moved to a shared 1.5 KiB `liveResource` chunk (no duplication). No charting or
other library added; nothing new on public routes.

## 2. Backend

| Request                                                | SQL statements executed                                    | Median  | p95     | Response size |
| ------------------------------------------------------ | ---------------------------------------------------------- | ------- | ------- | ------------- |
| `GET /executive/overview` (all branches)               | **59**                                                     | 20.8 ms | 26.0 ms | 28.6 KB       |
| `GET /executive/overview?branch=` (one)                | **59**                                                     | 20.2 ms | 24.6 ms | 27.4 KB       |
| `GET /executive/documents/production-order/:id`        | **39** (56 before limiting the trace to its document kind) | 13.4 ms | 14.3 ms | 0.9 KB        |
| `GET /dashboards/sales` (EP47, comparison)             | 18                                                         | 9.4 ms  | 13.0 ms | 4.7 KB        |
| `GET /company/context` (session + permission baseline) | 11                                                         | —       | —       | —             |

- Statements counted from the PostgreSQL statement log of the QA database only (`log_min_duration_statement = 0`,
  `execute` / `statement` entries), 15 requests each for latency, on the seeded demo company after the real-stack flows.
- The count is **constant**: it does not grow with the number of documents or branches (aggregation in PostgreSQL —
  `GROUP BY` + `LATERAL` sums for sales progress, request ordering and receive progress; `groupBy` counts; bounded
  `findMany` with explicit `select`; no per-document query). Branches are one `ANY($ids)` parameter.
- No full business table is sent to the browser; the answer carries counts, top 5 items per flow, top 25 queue items,
  20 activity entries.
- 50 sequential overview requests: 1.47 s (incl. sign-in). Backend RSS 253 → 271 MB (development process).

## 3. Frontend requests

One `GET /executive/overview` per load (in development, React StrictMode starts and aborts a first request — verified:
status 0, 0 bytes; production builds do not double-mount); refresh every 120 s only while visible; a filter change
aborts the previous request; no request is made by people without access (CORE home / menu entries are hidden for them
and the server refuses direct calls).
