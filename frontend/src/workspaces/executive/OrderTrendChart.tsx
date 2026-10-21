import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts';
import { ORDER_TREND } from './data';

/*
 * Two series, same unit (count of orders) → one shared y-axis.
 * Palette validated against surface-raised (dark): chart-1 #14a883, chart-2 #4f8fe8.
 * Shipped uses a dashed stroke as secondary (non-colour) encoding.
 */

const SERIES = [
  { key: 'orders', label: 'คำสั่งซื้อเข้า', color: 'var(--color-chart-1)', dash: undefined },
  { key: 'shipped', label: 'ส่งมอบแล้ว', color: 'var(--color-chart-2)', dash: '6 4' },
] as const;

function TrendTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border-strong bg-surface-overlay px-3 py-2 shadow-raised">
      <p className="text-caption text-text-muted">{label}</p>
      {SERIES.map((s) => {
        const entry = payload.find((p) => p.dataKey === s.key);
        return (
          <p key={s.key} className="mt-1 flex items-center gap-2 text-label text-text-primary">
            <span aria-hidden className="h-0.5 w-3 rounded-full" style={{ background: s.color }} />
            {s.label}
            <span className="ml-auto pl-3 font-semibold tabular">
              {String(entry?.value ?? '—')}
            </span>
          </p>
        );
      })}
    </div>
  );
}

export default function OrderTrendChart() {
  const last = ORDER_TREND[ORDER_TREND.length - 1];
  return (
    <figure>
      <figcaption className="mb-3 flex flex-wrap items-center gap-4 text-caption text-text-secondary">
        {SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-2">
            <svg width="18" height="6" aria-hidden>
              <line
                x1="0"
                y1="3"
                x2="18"
                y2="3"
                stroke={s.color}
                strokeWidth="2"
                strokeDasharray={s.dash}
              />
            </svg>
            {s.label}
          </span>
        ))}
      </figcaption>
      <div
        className="h-64"
        role="img"
        aria-label={`แนวโน้มคำสั่งซื้อเข้าเทียบส่งมอบ 8 สัปดาห์ สัปดาห์ล่าสุด: เข้า ${last?.orders} ส่ง ${last?.shipped}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={ORDER_TREND} margin={{ top: 8, right: 56, bottom: 0, left: -12 }}>
            <CartesianGrid stroke="var(--color-border-soft)" vertical={false} />
            <XAxis
              dataKey="week"
              tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={40}
              allowDecimals={false}
            />
            <Tooltip content={TrendTooltip} cursor={{ stroke: 'var(--color-border-strong)' }} />
            {SERIES.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={2}
                strokeDasharray={s.dash}
                dot={false}
                activeDot={{ r: 5, stroke: 'var(--color-surface-base)', strokeWidth: 2 }}
                isAnimationActive={false}
                label={(props: {
                  index?: number;
                  x?: number | string;
                  y?: number | string;
                  value?: unknown;
                }) =>
                  props.index === ORDER_TREND.length - 1 ? (
                    <text
                      key={s.key}
                      x={Number(props.x) + 8}
                      y={Number(props.y) + 4}
                      fill="var(--color-text-secondary)"
                      fontSize={12}
                    >
                      {String(props.value)}
                    </text>
                  ) : (
                    <g key={`${s.key}-${props.index}`} />
                  )
                }
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-3 text-caption text-text-muted">
        <summary className="cursor-pointer hover:text-text-secondary">ดูข้อมูลเป็นตาราง</summary>
        <table className="mt-2 w-full text-left">
          <thead>
            <tr>
              <th className="py-1 font-medium">สัปดาห์</th>
              <th className="py-1 text-right font-medium">คำสั่งซื้อเข้า</th>
              <th className="py-1 text-right font-medium">ส่งมอบแล้ว</th>
            </tr>
          </thead>
          <tbody>
            {ORDER_TREND.map((r) => (
              <tr key={r.week} className="border-t border-border-soft text-text-secondary">
                <td className="py-1">{r.week}</td>
                <td className="py-1 text-right tabular">{r.orders}</td>
                <td className="py-1 text-right tabular">{r.shipped}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
