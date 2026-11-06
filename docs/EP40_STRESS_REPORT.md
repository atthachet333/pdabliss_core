# EP40 Stress, Load and Concurrency Report

All load and race traffic went to an **isolated local QA backend** (`localhost:2112`, run with
`tsx` in development mode) and a **disposable database** (`pdabliss_core_e2e40`, migrated and
demo-seeded for EP40). The load script refuses any other database. Nothing touched
`pdabliss_core_dev`, a public domain or another service. These are **measured local baselines,
not a production SLA**.

## Environment

- **Host:** Windows 11, 16 GB RAM, PostgreSQL 18 on 5432. The machine was in normal use
  (desktop apps, a game, browsers): 1.7–3.0 GB free before the runs.
- **Backend:** a single Node process via `tsx` (development mode: no build and no clustering),
  using Prisma's default connection pool (11 connections observed).
- **Load client:** Node `fetch` workers with real persona sessions (cookie auth), sampling host
  CPU, free RAM and backend RSS every 5 s (asynchronously), plus `pg_stat_activity`.
- **Safety:** a run aborts when free memory falls under a floor (1.5 GB in the first run, 900 MB
  in the final one). Write stages are bounded by request count, and each uses its own disposable
  documents.
- **Provisional thresholds,** set before the run for a dev-mode single process: no 5xx, no
  timeouts, p95 below 250 ms up to 25 readers, below 600 ms at 50, invariants intact after
  every write stage.

## Read workload (17 representative endpoints, rotated)

The endpoints:
- company and operations context, and permission authorization;
- master-data search;
- purchase requests and orders;
- stock, FEFO and movements;
- sales and production lists and details;
- Executive lists.

| Stage | Clients | Duration | Requests | Throughput | p50 | p95 | p99 | Max | Errors |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Baseline | 1 | 30 s | 1,820 | 60.7 /s | 15.6 ms | 27.7 ms | 34.2 ms | 61 ms | 0 |
| Light | 10 | 60 s | 10,956 | 182.5 /s | 51.8 ms | 92.4 ms | 111.8 ms | 220 ms | 0 |
| Moderate | 25 | 60 s | 12,614 | 209.9 /s | 108.1 ms | 209.7 ms | 247.2 ms | 401 ms | 0 |
| Higher | 50 | 30 s | 6,487 | 215.0 /s | 212.4 ms | 428.0 ms | 465.4 ms | 523 ms | 0 |

Every response was 200. Host CPU peaked at 57 %; backend RSS was 658–663 MB, flat (no growth
under load); database connections stayed at 11.

**Reading:** throughput saturates near 210–215 requests/s in this single dev-mode process.
Beyond 10 clients, latency grows linearly with concurrency (queueing), not with errors. Every
provisional threshold was met.

## Write workload (independent disposable documents)

| Stage | Workers × iterations | Requests | Throughput | p50 | p95 | p99 | Status | Invariants |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| Sales draft + submit | 10 × 20 | 400 | 99.5 /s | 97.9 ms | 115.6 ms | 140.9 ms | 200 × 200, 201 × 200 | intact |
| Confirm + FEFO allocate (shared stock) | 10 × 10 | 400 | 83.7 /s | 113.4 ms | 165.7 ms | 192.6 ms | 200 × 300, 201 × 100 | intact |
| Request → approve → PO → issue → receipt posted | 5 × 6 | 240 | 89.6 /s | 52.8 ms | 81.1 ms | 96.0 ms | 200 × 150, 201 × 90 | intact |
| Pick → pack → ship → dispatch | 5 × 4 | 220 | 101.4 /s | 47.6 ms | 64.1 ms | 80.1 ms | 200 × 140, 201 × 80 | intact |

The 10 ledger and reservation invariants were checked after each stage: 0 mismatches,
0 negative balances, 0 over-reserved identities, 0 duplicate postings.

**Totals:** 33,137 requests over 8 stages. 0 errors, 0 timeouts, 0 HTTP 5xx.

### Measurement note

The first run sampled the host *synchronously*, which froze the load client for about 1.9 s every
5 s and inflated p99 to about 1.9 s. Its memory guard also stopped the light read stage because
the host was busy. The sampler was made asynchronous and the whole run repeated; only the clean
second run is reported above.

## Race matrix (real concurrent HTTP, 5 rounds each, fresh items per round)

| # | Scenario | 2xx | Expected 409 | Other 4xx | 5xx | Timeouts | Outcome checked |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | Sales allocation vs Sales allocation | 10 | 0 | 0 | 0 | 0 | reserved = on hand (5 of 5), never more |
| 2 | Sales vs Production allocation | 10 | 0 | 0 | 0 | 0 | reserved 6 of 6 |
| 3 | Production vs Production allocation | 10 | 0 | 0 | 0 | 0 | reserved 7 of 7 |
| 4 | Sales dispatch vs Production issue (same item) | 10 | 0 | 0 | 0 | 0 | both posted, exact remainder |
| 5 | Sales dispatch vs transfer of the free rest | 10 | 0 | 0 | 0 | 0 | both posted, nothing negative |
| 6 | Material issue vs adjustment of the free part | 10 | 0 | 0 | 0 | 0 | both posted, exact remainder |
| 7 | Allocation vs cycle-count start | 10 | 0 | 0 | 0 | 0 | consistent; count cancelled after |
| 8 | Transfer vs adjustment (both want 4 of 5) | 5 | 5 | 0 | 0 | 0 | exactly one wins |
| 9 | Goods-receipt reversal vs reservation | 5 | 5 | 0 | 0 | 0 | reversal refused once stock is reserved |
| 10 | Triple sales dispatch | 5 | 10 | 0 | 0 | 0 | exactly one SALES_ISSUE |
| 11 | Triple material-issue post | 5 | 10 | 0 | 0 | 0 | exactly one consumption |
| 12 | Triple finished-goods receipt post | 5 | 10 | 0 | 0 | 0 | exactly one output |
| 13 | Partial receipt post vs reversal of the first | 10 | 0 | 0 | 0 | 0 | on hand equals the posted receipts |
| 14 | Completion vs new material issue | 5 | 5 | 0 | 0 | 0 | no issue on a completed order |
| 15 | Sales cancellation vs allocation | 6 | 4 | 0 | 0 | 0 | a cancelled order holds nothing |
| 16 | Branch access revoked vs posting | 5 | 5 | 0 | 0 | 0 | never created in another branch (after EP40-02) |
| 17 | 12 parallel document creates | 60 | 0 | 0 | 0 | 0 | 12 unique numbers each round |
| 18 | Same new lot created twice at once | 10 | 0 | 0 | 0 | 0 | one lot row, both quantities |

**90 rounds, 0 failing.** After every round the 10 database invariants were re-checked and were
all zero.

## Locking and deadlocks (code review)

- **Location locks:** advisory locks (shared for movements, exclusive for counts and location
  changes), always taken in sorted id order.
- **Stock locks:** reservations lock the item's balance rows in id order (`lockBalances`). Every
  decrease row-locks its balance (`FOR UPDATE`) and re-reads both sides' reservations under the
  lock.
- **Documents:** state changes are conditional updates on the expected status, so a concurrent
  second decision finds the status changed (409).
- **Deadlocks / serialization failures:** if they still occur, they are mapped to
  `409 CONCURRENT_UPDATE` with nothing written. There is **no automatic retry**, so a
  consequential operation can never be applied twice. None occurred in the 90 rounds.

## Limits and not covered

- These are single-process, development-mode figures on a shared desktop. Production sizing (a
  built server, clustering, pool size, PostgreSQL tuning) needs its own test on production-like
  hardware.
- No soak test longer than about 4 minutes, and no network-latency injection.
- At 50 concurrent readers the host stayed below its limits. Higher concurrency was deliberately
  not attempted on a machine in use.
