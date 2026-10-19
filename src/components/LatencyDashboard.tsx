import { CHART_ACTIVE_DOT, CHART_TOOLTIP } from "@/components/ui/chart-theme"
import { memo, useMemo, useState } from "react"
import {
  Area,
  Bar,
  BarChart,
  Brush,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { clockFor, despike, tickClock, timeTicks } from "@/lib/format"
import type { PingPoint } from "@/lib/latency"
import { cn } from "@/lib/utils"

export type PingSample = PingPoint
export type ProbeSeries = { id: number; name: string; points: PingSample[]; loss: number | null }
export type LatencyDashboardProps = {
  pingSeries: ProbeSeries[]
  hours: number
  nowTs: number
  step?: number
  smooth: boolean
  onToggleSmooth: (smooth: boolean) => void
}
type ViewMode = "combined" | "split" | "ranking" | "loss"
const AXIS = { stroke: "currentColor", fontSize: 11, tickLine: false, axisLine: false }
const PALETTE = [
  "var(--color-primary)",
  "var(--color-chart-2)",
  "var(--color-chart-4)",
  "var(--color-online)",
  "var(--color-warn)",
  "var(--color-chart-5)",
]
const color = (id: number) => PALETTE[((id % PALETTE.length) + PALETTE.length) % PALETTE.length]
const ms = (value: number | null) => (value === null ? "—" : `${value.toFixed(1)} ms`)

/** 在超时与采集断档处分别滤波，避免跨越故障边界计算平滑值。 */
function smoothSegments(points: PingSample[], step: number) {
  const result: (number | null)[] = points.map(() => null)
  let from = 0
  while (from < points.length) {
    if (points[from].latency === null) {
      from++
      continue
    }
    let to = from + 1
    while (
      to < points.length &&
      points[to].latency !== null &&
      points[to].ts - points[to - 1].ts <= step * 1.5
    )
      to++
    const values = despike(points.slice(from, to).map((p) => p.latency))
    values.forEach((value, i) => {
      result[from + i] = value
    })
    from = to
  }
  return result
}

/** 小火花线以真实时间定位，超时和采集断档保留断点。 */
function Sparkline({
  points,
  step,
  stroke,
}: {
  points: PingSample[]
  step: number
  stroke: string
}) {
  const valid = points.filter((p) => p.latency !== null)
  if (valid.length < 2) return <span className="h-6 w-20" />
  const maximum = Math.max(1, ...valid.map((p) => p.latency ?? 0))
  const start = points[0].ts
  const span = Math.max(1, points[points.length - 1].ts - start)
  const paths: string[] = []
  let path = ""
  points.forEach((point, i) => {
    if (point.latency === null) {
      if (path) paths.push(path)
      path = ""
      return
    }
    if (i > 0 && point.ts - points[i - 1].ts > step * 1.5) {
      if (path) paths.push(path)
      path = ""
    }
    path += `${path ? "L" : "M"}${(((point.ts - start) / span) * 80).toFixed(1)},${(22 - (point.latency / maximum) * 20).toFixed(1)} `
  })
  if (path) paths.push(path)
  return (
    <svg viewBox="0 0 80 24" className="h-6 w-20 shrink-0" aria-hidden="true">
      {paths.map((d, i) => (
        <path key={i} d={d} stroke={stroke} fill="none" strokeWidth="1.5" />
      ))}
    </svg>
  )
}

export const LatencyDashboard = memo(function LatencyDashboard({
  pingSeries,
  hours,
  nowTs,
  step = 60,
  smooth,
  onToggleSmooth,
}: LatencyDashboardProps) {
  const [view, setView] = useState<ViewMode>("combined")
  const [hidden, setHidden] = useState<number[]>([])
  const [zoom, setZoom] = useState<{ hours: number; from: number; to: number } | null>(null)
  const start = nowTs - hours * 3600
  const summaries = useMemo(
    () =>
      pingSeries.map((series) => {
        const values = series.points
          .filter((p) => p.latency !== null && Number.isFinite(p.latency) && p.latency >= 0)
          .map((p) => p.latency as number)
        const last = series.points[series.points.length - 1]
        const stale = !!last && nowTs - last.ts > Math.max(step * 1.5, 120)
        const down = !!last && last.latency === null
        // 抖动只统计时间相邻的两个成功桶，不跨超时和缺测窗口。
        let differences = 0
        let pairs = 0
        series.points.forEach((point, i) => {
          const previous = series.points[i - 1]
          if (
            previous &&
            previous.latency !== null &&
            point.latency !== null &&
            point.ts - previous.ts <= step * 1.5
          ) {
            differences += Math.abs(point.latency - previous.latency)
            pairs++
          }
        })
        const avg = values.length ? values.reduce((sum, n) => sum + n, 0) / values.length : null
        const min = values.length
          ? Math.min(
              ...series.points
                .filter((p) => p.latency !== null)
                .map((p) => p.band?.[0] ?? p.latency!),
            )
          : null
        const max = values.length
          ? Math.max(...series.points.map((p) => p.band?.[1] ?? p.latency ?? 0))
          : null
        const loss = series.loss
        const quality = !last
          ? "暂无采样"
          : stale
            ? "近期无新采样"
            : down
              ? "最近探测失败"
              : avg === null
                ? "暂无有效探测"
                : loss === null
                  ? "失败率未知"
                  : loss > 0
                    ? "窗口内存在探测失败"
                    : "窗口内探测均成功"
        return {
          ...series,
          stale,
          down,
          avg,
          min,
          max,
          jitter: pairs ? differences / pairs : null,
          successBuckets: values.length,
          latest: last?.latency ?? null,
          quality,
        }
      }),
    [pingSeries, step, nowTs],
  )
  const shown = summaries.filter((series) => !hidden.includes(series.id))
  const ranking = [...shown]
    .filter((series) => series.avg !== null)
    .sort((a, b) => (a.avg ?? 0) - (b.avg ?? 0))
  const rows = useMemo(() => {
    const result = new Map<number, Record<string, number | [number, number] | null>>()
    const rowAt = (ts: number) => {
      if (!result.has(ts)) result.set(ts, { ts: ts * 1000 })
      return result.get(ts)!
    }
    for (const series of pingSeries) {
      const filtered = smoothSegments(series.points, step)
      series.points.forEach((point, i) => {
        const row = rowAt(point.ts)
        row[`loss${series.id}`] = point.loss ?? (point.latency === null ? 100 : 0)
        row[`raw${series.id}`] = point.latency
        row[`smooth${series.id}`] = filtered[i]
        row[`band${series.id}`] =
          point.latency === null ? null : (point.band ?? [point.latency, point.latency])
        const previous = series.points[i - 1]
        if (previous && point.ts - previous.ts > step * 1.5)
          rowAt((previous.ts + point.ts) / 2)[`raw${series.id}`] = null
      })
    }
    return [...result.values()].sort((a, b) => Number(a.ts) - Number(b.ts))
  }, [pingSeries, step])
  // 时间缩放跨视图共享；窗口改变后忽略旧索引，刷新沿用绝对时间区间。
  const activeZoom = zoom?.hours === hours && zoom.to > start && zoom.from < nowTs ? zoom : null
  const from = activeZoom ? Math.max(start, activeZoom.from) : start
  const to = activeZoom ? Math.min(nowTs, activeZoom.to) : nowTs
  const plottedRows = rows.filter(
    (row) => Number(row.ts) >= from * 1000 && Number(row.ts) <= to * 1000,
  )
  const ticks = timeTicks(from * 1000, to * 1000)
  const timeAxis = {
    ...AXIS,
    dataKey: "ts",
    type: "number" as const,
    domain: [from * 1000, to * 1000],
    ticks,
    tickFormatter: tickClock(ticks, hours),
    minTickGap: 45,
  }
  const solo = (id: number) =>
    setHidden(
      shown.length === 1 && shown[0].id === id
        ? []
        : summaries.filter((series) => series.id !== id).map((series) => series.id),
    )
  const noSelection = (
    <div className="flex min-h-40 items-center justify-center text-xs text-muted-foreground">
      没有选定线路，请点击上方“显示全部”或线路名称。
    </div>
  )

  /** 三种视图共用一套原始数据、线路选择及时间边界。 */
  const chart = (series: typeof shown, height: string) => (
    <div
      key={`${series.map((item) => item.id).join(",")}-${smooth}-${from}-${to}`}
      className={cn(height, "animate-fade-in text-muted-foreground")}
    >
      <ResponsiveContainer>
        <ComposedChart data={plottedRows}>
          <CartesianGrid stroke="var(--color-border)" vertical={false} strokeDasharray="3 3" />
          <XAxis {...timeAxis} />
          <YAxis {...AXIS} unit="ms" width={58} domain={[0, "auto"]} />
          <Tooltip
            {...CHART_TOOLTIP}
            labelFormatter={(v) => new Date(Number(v)).toLocaleString("zh-CN")}
            formatter={(v, name) => [ms(Number(v)), name]}
          />
          {!smooth && series.length === 1 && (
            <Area
              activeDot={CHART_ACTIVE_DOT}
              dataKey={`band${series[0].id}`}
              stroke="none"
              fill={color(series[0].id)}
              fillOpacity={0.12}
              connectNulls={false}
              tooltipType="none"
              isAnimationActive={false}
            />
          )}
          {series.map((item) => (
            <Line
              activeDot={CHART_ACTIVE_DOT}
              key={item.id}
              dataKey={`${smooth ? "smooth" : "raw"}${item.id}`}
              name={item.name}
              stroke={color(item.id)}
              strokeDasharray={item.id % 2 ? undefined : "4 2"}
              strokeWidth={1.5}
              dot={
                plottedRows.length < 60
                  ? { r: 2, fill: color(item.id), stroke: "var(--color-card)" }
                  : false
              }
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )

  return (
    <div className="monitor-charts space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-2">
        <div>
          <h2 className="text-sm font-semibold">网络延迟分析 · {pingSeries.length} 条线路</h2>
          <p className="mt-1 text-[11px] text-muted-foreground">
            卡片及排行统计完整 {hours < 24 ? `${hours} 小时` : `${hours / 24} 天`}
            窗口；缩放仅影响时序图。延迟曲线为桶内中位数，区间带为最低至最高值；“桶中位均值”是成功桶中位数的算术平均，不是原始探测均值。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={smooth}
              onChange={(event) => onToggleSmooth(event.target.checked)}
            />
            削峰显示
          </label>
          <div className="flex gap-1 rounded-[2px] border border-border/60 bg-muted/30 p-0.5">
            {[
              { key: "combined", label: "聚合对比" },
              { key: "split", label: "分轨矩阵" },
              { key: "loss", label: "探测失败率" },
              { key: "ranking", label: "延迟排行" },
            ].map((item) => (
              <button
                type="button"
                key={item.key}
                aria-pressed={view === item.key}
                onClick={() => setView(item.key as ViewMode)}
                className={cn(
                  "rounded-[1px] px-2 py-1 text-xs transition-colors",
                  view === item.key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {smooth && (
        <p className="text-[11px] text-muted-foreground">
          削峰会抑制真实尖峰，仅用于辅助观察走势；卡片及排行保留原始统计，关闭后查看故障峰值。
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">
          已选 {shown.length} / {summaries.length} 条 · 点击线路名称切换显示
        </span>
        <button
          type="button"
          onClick={() => setHidden([])}
          className="text-primary transition-opacity hover:opacity-70"
        >
          显示全部
        </button>
      </div>
      <div className="monitor-chart-grid monitor-chart-grid--compact">
        {summaries.map((series) => (
          <section
            key={series.id}
            className={cn(
              "min-w-0 rounded-[2px] border border-border/70 bg-card/60 p-3 transition-opacity",
              hidden.includes(series.id) && "opacity-45",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                aria-pressed={!hidden.includes(series.id)}
                onClick={() =>
                  setHidden((all) =>
                    all.includes(series.id)
                      ? all.filter((id) => id !== series.id)
                      : [...all, series.id],
                  )
                }
                className="flex min-w-0 items-center gap-2 text-left text-xs font-semibold transition-colors hover:text-primary"
              >
                <span className="size-2 shrink-0" style={{ background: color(series.id) }} />
                <span className="truncate" title={series.name}>
                  {series.name}
                </span>
              </button>
              <button
                type="button"
                onClick={() => solo(series.id)}
                className="shrink-0 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              >
                {shown.length === 1 && shown[0].id === series.id ? "取消聚焦" : "单线聚焦"}
              </button>
            </div>
            <div className="my-3 flex items-center justify-between gap-2">
              <div>
                <div
                  className={cn(
                    "font-mono text-lg",
                    (series.down || series.stale) && "text-destructive",
                  )}
                >
                  {series.down ? "失败" : ms(series.latest)}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">{series.quality}</div>
              </div>
              <Sparkline points={series.points} step={step} stroke={color(series.id)} />
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-border/40 pt-2 text-[11px]">
              {[
                ["桶中位均值", ms(series.avg)],
                ["最低", ms(series.min)],
                ["峰值", ms(series.max)],
                ["有效桶数", `${series.successBuckets} / ${series.points.length}`],
                ["相邻桶波动", ms(series.jitter)],
                ["窗口失败率", series.loss === null ? "未知" : `${series.loss.toFixed(2)}%`],
              ].map(([label, value]) => (
                <div key={label} className="flex flex-wrap justify-between gap-x-1">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-mono">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
      {pingSeries.length === 0 && (
        <div className="py-12 text-center text-xs text-muted-foreground">
          当前窗口没有探测线路或历史数据
        </div>
      )}
      {/* 独立的全窗口缩放条避免卸载视图后 Brush 与保存的缩放状态分离。 */}
      {rows.length > 1 && view !== "ranking" && (
        <div className="rounded-[2px] border border-border/60 bg-card/60 p-3">
          <div className="mb-2 flex justify-between text-[11px] text-muted-foreground">
            <span>
              时序图时间缩放 · {new Date(from * 1000).toLocaleString("zh-CN")} —{" "}
              {new Date(to * 1000).toLocaleString("zh-CN")}
            </span>
            <button
              type="button"
              onClick={() => setZoom(null)}
              className="ml-2 shrink-0 text-primary"
            >
              重置
            </button>
          </div>
          <div className="h-8 text-muted-foreground">
            <ResponsiveContainer>
              {/* 桶数量变化时重建缩放条的内部坐标，避免旧索引越界；时间选区仍由外层状态保留。 */}
              <ComposedChart key={rows.length} data={rows}>
                <Brush
                  dataKey="ts"
                  height={24}
                  stroke="var(--color-border)"
                  fill="var(--color-card)"
                  tickFormatter={clockFor(hours)}
                  startIndex={
                    activeZoom
                      ? Math.max(
                          0,
                          rows.findIndex((row) => Number(row.ts) >= from * 1000),
                        )
                      : 0
                  }
                  endIndex={
                    activeZoom
                      ? Math.max(
                          0,
                          rows.findLastIndex((row) => Number(row.ts) <= to * 1000),
                        )
                      : rows.length - 1
                  }
                  onChange={(range) => {
                    const first = rows[range.startIndex ?? 0]
                    const last = rows[range.endIndex ?? rows.length - 1]
                    if (first && last && first.ts !== last.ts)
                      setZoom({ hours, from: Number(first.ts) / 1000, to: Number(last.ts) / 1000 })
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      <div key={view} className="animate-fade-in">
        {shown.length === 0 ? (
          noSelection
        ) : view === "combined" ? (
          <section className="rounded-[2px] border border-border/70 bg-card/60 p-3">
            {chart(shown, "h-80")}
          </section>
        ) : view === "split" ? (
          <div className="monitor-chart-grid">
            {shown.map((series) => (
              <section
                key={series.id}
                className="min-w-0 rounded-[2px] border border-border/70 bg-card/60 p-3"
              >
                <h3 className="mb-2 text-xs font-semibold">{series.name} · 独立 Y 轴</h3>
                {chart([series], "h-48")}
              </section>
            ))}
          </div>
        ) : view === "loss" ? (
          <div className="monitor-chart-grid">
            {shown.map((series) => (
              <section key={series.id} className="min-w-0 border border-border/70 bg-card/60 p-3">
                <h3 className="mb-2 text-xs font-semibold">{series.name} · TCP 探测失败率</h3>
                <p className="mb-3 text-[11px] text-muted-foreground">
                  窗口失败率 {series.loss === null ? "未知" : `${series.loss.toFixed(2)}%`} ·
                  分时百分比由服务端取整；空白时段无采样。
                </p>
                <div className="h-48 text-muted-foreground">
                  <ResponsiveContainer>
                    <ComposedChart data={plottedRows}>
                      <CartesianGrid
                        vertical={false}
                        stroke="var(--color-border)"
                        strokeDasharray="3 3"
                      />
                      <XAxis
                        {...AXIS}
                        dataKey="ts"
                        type="number"
                        domain={[from * 1000, to * 1000]}
                        ticks={ticks}
                        tickFormatter={tickClock(ticks, hours)}
                        minTickGap={45}
                      />
                      <YAxis
                        {...AXIS}
                        domain={[0, 100]}
                        tickFormatter={(v) => `${v}%`}
                        width={42}
                      />
                      <Tooltip
                        {...CHART_TOOLTIP}
                        labelFormatter={(v) => new Date(Number(v)).toLocaleString("zh-CN")}
                        formatter={(v) => `${Number(v)}%`}
                      />
                      <Line
                        activeDot={CHART_ACTIVE_DOT}
                        dataKey={`loss${series.id}`}
                        name="桶内探测失败率"
                        stroke={color(series.id)}
                        strokeWidth={1}
                        dot={false}
                        connectNulls={false}
                        isAnimationActive={false}
                        tooltipType="none"
                      />
                      <Bar
                        dataKey={`loss${series.id}`}
                        name="桶内探测失败率"
                        fill={color(series.id)}
                        isAnimationActive={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </section>
            ))}
          </div>
        ) : ranking.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground">
            所选线路没有成功探测数据，无法计算延迟排行。
          </div>
        ) : (
          <section className="rounded-[2px] border border-border/70 bg-card/60 p-3">
            <p className="mb-3 text-[11px] text-muted-foreground">
              按桶中位均值排序；结合失败率及采样新鲜度判断，不能据此直接排名线路质量。
            </p>
            <div
              className="text-muted-foreground"
              style={{ height: Math.max(160, ranking.length * 42) }}
            >
              <ResponsiveContainer>
                <BarChart data={ranking} layout="vertical" margin={{ right: 20 }}>
                  <CartesianGrid horizontal={false} stroke="var(--color-border)" />
                  <XAxis {...AXIS} type="number" unit="ms" />
                  <YAxis {...AXIS} dataKey="name" type="category" width={110} />
                  <Tooltip
                    {...CHART_TOOLTIP}
                    labelFormatter={(v) => String(v)}
                    formatter={(v) => ms(Number(v))}
                  />
                  <Bar dataKey="avg" name="桶中位均值" isAnimationActive={false}>
                    {ranking.map((series) => (
                      <Cell key={series.id} fill={color(series.id)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        TCP 握手探测；失败与采集断档不连线。有采样且服务端省略失败率时按零处理，无采样显示未知。
        {step > 60 ? "当前为聚合桶，延迟波动不等同于逐次探测抖动。" : ""}
      </p>
    </div>
  )
})
