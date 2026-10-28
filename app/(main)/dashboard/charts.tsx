type Slice = { label: string; value: number; color: string };

export function Donut({ data }: { data: Slice[] }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = 80;
  const c = 2 * Math.PI * r;
  const slices = data
    .filter((d) => d.value > 0)
    .map((d, i, all) => ({
      ...d,
      len: (d.value / total) * c,
      offset: all.slice(0, i).reduce((s, p) => s + (p.value / total) * c, 0),
    }));

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 200" className="aspect-square w-full max-w-[280px] -rotate-90 animate-pop" role="img" aria-label="สัดส่วนตามสถานะ">
        <circle cx="100" cy="100" r={r} fill="none" stroke="currentColor" strokeOpacity=".07" strokeWidth="26" />
        {slices.map((s) => (
          <circle
            key={s.label}
            cx="100"
            cy="100"
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth="26"
            strokeDasharray={`${s.len} ${c - s.len}`}
            strokeDashoffset={-s.offset}
          />
        ))}
      </svg>
      <ul className="mt-5 flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm">
        {data.map((d) => (
          <li key={d.label} className="flex items-center gap-1.5">
            <span className="size-3.5 rounded-full" style={{ background: d.color }} />
            {d.label} <span className="font-semibold tabular-nums">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function VBars({ data }: { data: Slice[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="relative h-[280px] pl-8 pt-2 sm:h-[330px]">
      {[0, 1].map((t) => (
        <div
          key={t}
          className="absolute inset-x-8 border-t border-border"
          style={{ top: t === 0 ? "8px" : "calc(100% - 38px)" }}
        >
          <span className="absolute -left-6 -translate-y-1/2 text-xs text-muted-foreground">{t === 0 ? max : 0}</span>
        </div>
      ))}
      <div className="absolute inset-x-8 bottom-0 top-2 flex items-end justify-around pb-[38px]">
        {data.map((d, i) => (
          <div key={d.label} className="relative flex h-full w-10 items-end sm:w-14 justify-center">
            <div
              className="w-full origin-bottom animate-grow-y rounded-t-lg"
              style={{ height: `${(d.value / max) * 100}%`, background: d.color, animationDelay: `${i * 120}ms` }}
            />
            <span className="absolute text-xs font-semibold tabular-nums" style={{ bottom: `calc(${(d.value / max) * 100}% + 4px)` }}>
              {d.value}
            </span>
            <span className="absolute -bottom-[34px] max-w-20 truncate text-xs text-foreground/70 sm:text-sm" title={d.label}>{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Line chart; the y-axis top is rounded up so it always has whole-number gridlines. */
export function LineArea({ labels, values, color = "#1fbf6b", label }: { labels: string[]; values: number[]; color?: string; label: string }) {
  const peak = Math.max(...values, 1);
  const step = Math.max(1, Math.ceil(peak / 4));
  const max = step * Math.ceil(peak / step);
  const w = 700;
  const h = 220;
  const px = 36;
  const x = (i: number) => px + (i * (w - px * 1.5)) / (values.length - 1);
  const y = (v: number) => 10 + (1 - v / max) * (h - 20);
  const pts = values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const last = values.length - 1;

  return (
    <svg viewBox={`0 0 ${w} ${h + 30}`} className="w-full" role="img" aria-label={label}>
      {Array.from({ length: max / step + 1 }, (_, i) => i * step).map((v) => (
        <g key={v}>
          <line x1={px} x2={w} y1={y(v)} y2={y(v)} stroke="currentColor" strokeOpacity=".08" />
          <text x={px - 10} y={y(v) + 4} textAnchor="end" className="fill-muted-foreground text-[11px]">
            {v}
          </text>
        </g>
      ))}
      <polygon
        points={`${x(0)},${y(0)} ${pts} ${x(last)},${y(0)}`}
        fill={color}
        fillOpacity=".12"
        className="animate-fade-up [animation-delay:600ms]"
      />
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={1}
        className="animate-draw"
      />
      <circle cx={x(last)} cy={y(values[last])} r="5" fill="#fff" stroke={color} strokeWidth="2.5" className="animate-pop [animation-delay:1.2s]" />
      {labels.map((l, i) => (
        <text key={l + i} x={x(i)} y={h + 18} textAnchor="middle" className="fill-muted-foreground text-[10px]">
          {l}
        </text>
      ))}
    </svg>
  );
}

export function HBars({ data }: { data: Slice[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <ul className="space-y-5 py-4">
      {data.map((d, i) => (
        <li key={d.label} className="flex items-center gap-4">
          <span className="w-24 shrink-0 text-right text-sm text-muted-foreground sm:w-28">{d.label}</span>
          <div className="flex h-10 flex-1 items-center gap-2 sm:h-12">
            <div
              className="h-full origin-left animate-grow-x rounded-r-xl"
              style={{ width: `${(d.value / max) * 100}%`, background: d.color, animationDelay: `${i * 120}ms` }}
            />
            <span className="text-sm font-semibold tabular-nums">{d.value}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
