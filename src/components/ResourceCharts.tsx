import { CHART_ACTIVE_DOT, CHART_TOOLTIP } from "@/components/ui/chart-theme"
import { useMemo, useState, type ReactNode } from "react"
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type DotItemDotProps,
} from "recharts"
import type { Node } from "@/lib/api"
import { axisBytes, bytes, percent, rate, tickClock, timeTicks, withGaps } from "@/lib/format"
import {
  activityBuckets,
  metricStats,
  metricQuantile,
  monthUsage,
  windowMetrics,
  type MetricPoint,
} from "@/lib/telemetry"
import { cn } from "@/lib/utils"
import { UptimeSlaBar } from "@/components/UptimeSlaBar"

export type { MetricPoint } from "@/lib/telemetry"
export type CategoryMode =
  "all" | "timeline" | "heatmap" | "distribution" | "cpu" | "storage" | "network" | "connections"
export type ResourceChartsProps = {
  node: Node
  metrics: MetricPoint[]
  hours: number
  step?: number
  nowTs: number
}

/** 颜色按指标固定，所有分类、图例和分布图保持一致。 */
const COLORS = {
  cpu: "var(--color-primary)",
  mem: "var(--color-chart-2)",
  disk: "var(--color-chart-4)",
  swap: "var(--color-warn)",
  rx: "var(--color-online)",
  tx: "var(--color-chart-1)",
  tcp: "var(--color-primary)",
  udp: "var(--color-chart-2)",
  procs: "var(--color-chart-4)",
}
/** 保留原有孤立采样点标记，断档两侧的单点不能因无可连线而消失。 */
const isolatedDot = ({ cx, cy, index, points, stroke }: DotItemDotProps) =>
  cy == null || points[index - 1]?.y != null || points[index + 1]?.y != null ? null : (
    <circle cx={cx} cy={cy} r={2} fill={stroke} />
  )

const AXIS = {
  stroke: "currentColor",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
}
const CATEGORIES = [
  { key: "all", label: "全景仪表" },
  { key: "timeline", label: "时序曲线" },
  { key: "heatmap", label: "负载热力" },
  { key: "distribution", label: "占比分析" },
  { key: "cpu", label: "CPU 计算" },
  { key: "storage", label: "内存存储" },
  { key: "network", label: "网络流量" },
  { key: "connections", label: "连接进程" },
] as const

const number = (value: number) => Math.round(value).toLocaleString("zh-CN")
const cpuFormat = (value: number) => `${value.toFixed(1)}%`
const moment = (value: number) =>
  new Date(value * 1000).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })

/** 共用卡片边框和标题，长标题在窄屏自然换行。 */
function Panel({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-[2px] border border-border/70 bg-card/60 p-3">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-border/40 pb-2">
        <h3 className="text-xs font-semibold">{title}</h3>
        {note && <span className="text-[11px] text-muted-foreground">{note}</span>}
      </div>
      {children}
    </section>
  )
}

/** 分布图保留真实零值；全部为零或未采集时直接显示空态。 */
function Distribution({
  title,
  items,
  format = bytes,
}: {
  title: string
  items: { name: string; value: number | null; color: string }[]
  format?: (value: number) => string
}) {
  const known = items.filter(
    (item): item is typeof item & { value: number } =>
      item.value !== null && Number.isFinite(item.value) && item.value >= 0,
  )
  const total = known.reduce((sum, item) => sum + item.value, 0)
  return (
    <Panel title={title}>
      {total > 0 && known.length === items.length ? (
        <div className="h-36 text-muted-foreground">
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={known}
                dataKey="value"
                nameKey="name"
                innerRadius="55%"
                outerRadius="85%"
                stroke="var(--color-card)"
                isAnimationActive={false}
              >
                {known.map((item) => (
                  <Cell key={item.name} fill={item.color} />
                ))}
              </Pie>
              <Tooltip
                {...CHART_TOOLTIP}
                formatter={(v) =>
                  `${format(Number(v))} · ${((Number(v) / total) * 100).toFixed(1)}%`
                }
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex h-36 items-center justify-center text-xs text-muted-foreground">
          {known.length === items.length
            ? "当前数值为零"
            : known.length
              ? "数据不完整，暂不计算占比"
              : "暂无采集数据"}
        </div>
      )}
      <div className="space-y-1.5 text-xs">
        {items.map((item) => (
          <div key={item.name} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <i className="size-2" style={{ background: item.color }} />
              {item.name}
            </span>
            <span className="font-mono">{item.value === null ? "—" : format(item.value)}</span>
          </div>
        ))}
      </div>
    </Panel>
  )
}

export function ResourceCharts({ node, metrics, hours, step = 60, nowTs }: ResourceChartsProps) {
  const [category, setCategory] = useState<CategoryMode>("all")
  const [showTable, setShowTable] = useState(true)
  const [hidden, setHidden] = useState<Set<string>>(() => new Set())
  const [heatKey, setHeatKey] = useState("cpu")
  const [showNetworkPeaks, setShowNetworkPeaks] = useState(false)
  const start = nowTs - hours * 3600
  const m = node.online ? node.metrics : null
  const rows = useMemo(
    () => windowMetrics(metrics, start, nowTs, step),
    [metrics, start, nowTs, step],
  )
  const chartRows = useMemo(
    () =>
      withGaps(
        rows.map((row) => ({ ...row, ts: row.ts * 1000 })),
        step * 1000,
      ),
    [rows, step],
  )
  const buckets = useMemo(
    () => activityBuckets(rows, step, start, nowTs),
    [rows, step, start, nowTs],
  )
  const stats = useMemo(
    () => ({
      cpu: metricStats(rows, "cpu", step, start, nowTs, "cpu_max"),
      mem: metricStats(rows, "mem_used", step, start, nowTs),
      disk: metricStats(rows, "disk_used", step, start, nowTs),
      swap: metricStats(rows, "swap_used", step, start, nowTs),
      rx: metricStats(rows, "net_rx", step, start, nowTs, "net_rx_max"),
      tx: metricStats(rows, "net_tx", step, start, nowTs, "net_tx_max"),
      tcp: metricStats(rows, "tcp", step, start, nowTs),
      udp: metricStats(rows, "udp", step, start, nowTs),
      procs: metricStats(rows, "procs", step, start, nowTs),
    }),
    [rows, step, start, nowTs],
  )
  const ticks = timeTicks(start * 1000, nowTs * 1000)
  const timeAxis = {
    ...AXIS,
    dataKey: "ts",
    type: "number" as const,
    domain: [start * 1000, nowTs * 1000],
    ticks,
    tickFormatter: tickClock(ticks, hours),
    minTickGap: 45,
  }
  const usedTraffic = monthUsage(node)
  const quotaPct = node.traffic_limit > 0 ? percent(usedTraffic, node.traffic_limit) : null
  const descriptors = [
    {
      key: "cpu",
      category: "cpu",
      name: "CPU 使用率",
      field: "cpu",
      peakField: "cpu_max",
      color: COLORS.cpu,
      format: cpuFormat,
      current: m?.cpu,
      total: 100,
    },
    {
      key: "mem",
      category: "storage",
      name: "物理内存",
      field: "mem_used",
      color: COLORS.mem,
      format: bytes,
      current: m?.mem_used,
      total: node.mem_total,
    },
    {
      key: "disk",
      category: "storage",
      name: "磁盘占用",
      field: "disk_used",
      color: COLORS.disk,
      format: bytes,
      current: m?.disk_used,
      total: node.disk_total,
    },
    {
      key: "swap",
      category: "storage",
      name: "Swap 占用",
      field: "swap_used",
      color: COLORS.swap,
      format: bytes,
      current: m?.swap_used,
      total: node.swap_total,
    },
    {
      key: "rx",
      category: "network",
      name: "下行速率 RX",
      field: "net_rx",
      peakField: "net_rx_max",
      color: COLORS.rx,
      format: rate,
      current: m?.net_rx,
    },
    {
      key: "tx",
      category: "network",
      name: "上行速率 TX",
      field: "net_tx",
      peakField: "net_tx_max",
      color: COLORS.tx,
      format: rate,
      current: m?.net_tx,
    },
    {
      key: "tcp",
      category: "connections",
      name: "TCP 连接",
      field: "tcp",
      color: COLORS.tcp,
      format: number,
      current: m?.tcp,
    },
    {
      key: "udp",
      category: "connections",
      name: "UDP 套接字",
      field: "udp",
      color: COLORS.udp,
      format: number,
      current: m?.udp,
    },
    {
      key: "procs",
      category: "connections",
      name: "系统进程数",
      field: "procs",
      color: COLORS.procs,
      format: number,
      current: m?.procs,
    },
  ] as const
  const visible = descriptors.filter(
    (item) =>
      (category === "all" ||
        category === "timeline" ||
        category === "heatmap" ||
        category === "distribution" ||
        item.category === category) &&
      (item.key !== "swap" || node.swap_total > 0),
  )
  const display = (value: number | null | undefined, format: (n: number) => string) =>
    value == null ? "—" : format(value)

  /** 时序图统一时间轴与空缺规则；只有后端提供的真实峰值才标记为峰值。 */
  const historyChart = (keys: (typeof descriptors)[number]["key"][], title: string) => {
    const items = descriptors.filter((item) => keys.includes(item.key))
    const shownItems = items.filter((item) => !hidden.has(item.key))
    const hasData = shownItems.some((item) => stats[item.key].avg !== null)
    const format = items[0].format
    const isCpu = keys[0] === "cpu"
    const isNetwork = keys[0] === "rx"
    const isSocket = keys[0] === "tcp"
    return (
      <Panel
        title={title}
        note={
          isCpu || isNetwork
            ? "实线：桶均值 · 虚线：桶内峰值"
            : isSocket
              ? "TCP 左轴 · UDP 右轴；独立刻度"
              : "断线表示未采集；统计峰值为桶均值峰值"
        }
      >
        {isNetwork && (
          <label className="mb-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <input
              type="checkbox"
              checked={showNetworkPeaks}
              onChange={(event) => setShowNetworkPeaks(event.target.checked)}
            />
            显示桶内突发峰值（可能扩大纵轴）
          </label>
        )}
        {!hasData ? (
          <div className="flex h-48 items-center justify-center text-xs text-muted-foreground">
            {shownItems.length ? "当前窗口未采集此指标" : "已隐藏所有序列，请点击下方图例恢复"}
          </div>
        ) : (
          <div
            key={`${title}-${String(showNetworkPeaks)}-${shownItems.map((item) => item.key).join("-")}`}
            className="h-48 animate-fade-in text-muted-foreground"
          >
            <ResponsiveContainer>
              <ComposedChart
                syncId="node-resource-time"
                data={chartRows}
                margin={{ top: 8, right: 10, bottom: 0, left: 0 }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke="var(--color-border)"
                  strokeDasharray="3 3"
                />
                <XAxis {...timeAxis} />
                <YAxis
                  {...AXIS}
                  width={65}
                  domain={isCpu ? [0, 100] : [0, "auto"]}
                  tickFormatter={
                    isCpu
                      ? (v) => `${v}%`
                      : isNetwork
                        ? (v) => `${axisBytes(v)}/s`
                        : keys[0] === "mem" || keys[0] === "disk" || keys[0] === "swap"
                          ? axisBytes
                          : number
                  }
                />
                {isSocket && (
                  <YAxis
                    {...AXIS}
                    yAxisId="udp"
                    orientation="right"
                    width={42}
                    domain={[0, "auto"]}
                    allowDecimals={false}
                  />
                )}
                <Tooltip
                  {...CHART_TOOLTIP}
                  labelFormatter={(v) => new Date(Number(v)).toLocaleString("zh-CN")}
                  formatter={(v) => format(Number(v))}
                />
                {shownItems.map((item) => (
                  <Area
                    activeDot={CHART_ACTIVE_DOT}
                    key={item.key}
                    yAxisId={isSocket && item.key === "udp" ? "udp" : 0}
                    dataKey={item.field}
                    name={item.name}
                    stroke={item.color}
                    fill={item.color}
                    fillOpacity={items.length > 1 ? 0.035 : 0.12}
                    strokeWidth={1.5}
                    dot={isolatedDot}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                ))}
                {shownItems.map(
                  (item) =>
                    "peakField" in item &&
                    (!isNetwork || showNetworkPeaks) && (
                      <Line
                        activeDot={CHART_ACTIVE_DOT}
                        key={`${item.key}-peak`}
                        dataKey={item.peakField}
                        name={`${item.name}桶内峰值`}
                        stroke={item.color}
                        strokeDasharray="3 3"
                        strokeWidth={1}
                        dot={isolatedDot}
                        connectNulls={false}
                        isAnimationActive={false}
                      />
                    ),
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          {items.map((item) => (
            <button
              type="button"
              key={item.key}
              aria-pressed={!hidden.has(item.key)}
              onClick={() =>
                setHidden((old) => {
                  const next = new Set(old)
                  if (next.has(item.key)) next.delete(item.key)
                  else next.add(item.key)
                  return next
                })
              }
              className={cn(
                "text-left transition-opacity hover:opacity-80",
                hidden.has(item.key) && "opacity-40 line-through",
              )}
              style={{ color: item.color }}
            >
              <span aria-hidden="true">{hidden.has(item.key) ? "□" : "■"} </span>
              {item.name}：均值 {display(stats[item.key].avg, item.format)} ·{" "}
              {"peakField" in item ? "峰值" : "桶均值峰值"}{" "}
              {display(stats[item.key].peak, item.format)}
            </button>
          ))}
        </div>
      </Panel>
    )
  }

  /** 负荷分布仅统计已观测时长，同时显式展示窗口覆盖率。 */
  const distribution = useMemo(() => {
    const totals = [0, 0, 0, 0]
    for (const row of rows) {
      if (!Number.isFinite(row.cpu)) continue
      const sample = metricStats([row], "cpu", step, start, nowTs)
      totals[row.cpu < 20 ? 0 : row.cpu < 50 ? 1 : row.cpu < 80 ? 2 : 3] += sample.seconds
    }
    const total = totals.reduce((sum, n) => sum + n, 0)
    return totals.map((seconds, i) => ({
      name: ["低载 <20%", "平稳 20–50%", "繁忙 50–80%", "高载 ≥80%"][i],
      seconds,
      pct: total ? (seconds / total) * 100 : 0,
      color: [COLORS.rx, COLORS.cpu, COLORS.swap, "var(--color-destructive)"][i],
    }))
  }, [rows, step, start, nowTs])

  /** 容量类指标只与各自容量比较，禁止把 CPU、内存、磁盘相加成整体健康分。 */
  const capacity = descriptors.flatMap((item) =>
    "total" in item && item.total > 0
      ? [
        {
          name: item.name,
          color: item.color,
          current: item.current == null ? null : percent(item.current, item.total),
          average:
            stats[item.key].avg === null ? null : percent(stats[item.key].avg!, item.total),
        },
      ]
      : [],
  )
  const quantiles = useMemo(
    () =>
      ["cpu", "net_rx", "net_tx", "tcp"].map((key) => ({
        key,
        p50: metricQuantile(rows, key as keyof MetricPoint, step, start, nowTs, 0.5),
        p95: metricQuantile(rows, key as keyof MetricPoint, step, start, nowTs, 0.95),
      })),
    [rows, step, start, nowTs],
  )
  const heatItem = descriptors.find((item) => item.key === heatKey) ?? descriptors[0]
  const heatValue = (bucket: (typeof buckets)[number]) => {
    const field =
      heatItem.key === "cpu"
        ? "cpu"
        : heatItem.key === "rx"
          ? "rx"
          : heatItem.key === "tx"
            ? "tx"
            : heatItem.field
    const value = bucket[field as keyof typeof bucket] as number | null
    return value == null
      ? null
      : "total" in heatItem
        ? heatItem.total > 0
          ? percent(value, heatItem.total)
          : null
        : value
  }
  const heatFormat = "total" in heatItem ? cpuFormat : heatItem.format
  const heatMax = Math.max(1, ...buckets.map((bucket) => heatValue(bucket) ?? 0))

  return (
    <div className="monitor-charts space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
        <div>
          <h2 className="text-sm font-semibold">历史资源分析</h2>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {moment(start)} — {moment(nowTs)} · {rows.length} 个采样桶 · 桶宽{" "}
            {step < 3600 ? `${step / 60} 分钟` : `${step / 3600} 小时`}
          </p>
        </div>
        <div className="flex max-w-full gap-1 overflow-x-auto rounded-[2px] border border-border/60 bg-muted/30 p-0.5">
          {CATEGORIES.map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={category === item.key}
              onClick={() => setCategory(item.key)}
              className={cn(
                "shrink-0 rounded-[1px] px-2.5 py-1 text-xs transition-colors",
                category === item.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div key={category} className="animate-fade-in space-y-4">
        <UptimeSlaBar metrics={rows} step={step} hours={hours} nowTs={nowTs} />
        {category === "all" && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: "CPU 加权均值",
                value: display(stats.cpu.avg, cpuFormat),
                note: `桶内峰值 ${display(stats.cpu.peak, cpuFormat)}`,
                color: COLORS.cpu,
              },
              {
                label: "物理内存均值",
                value: display(stats.mem.avg, bytes),
                note: `容量 ${bytes(node.mem_total)}`,
                color: COLORS.mem,
              },
              {
                label: "窗口观测流量 · 估算",
                value:
                  stats.rx.avg === null && stats.tx.avg === null
                    ? "—"
                    : bytes(stats.rx.integral + stats.tx.integral),
                note: "仅累加已采集的 RX 与 TX",
                color: COLORS.rx,
              },
              {
                label: "TCP 平均连接",
                value: display(stats.tcp.avg, number),
                note: `桶均值峰值 ${display(stats.tcp.peak, number)}`,
                color: COLORS.tcp,
              },
            ].map((item) => (
              <section
                key={item.label}
                className="min-w-0 border border-border/70 bg-card/60 p-3"
                style={{ borderTopColor: item.color }}
              >
                <p className="text-[11px] text-muted-foreground">{item.label}</p>
                <p className="my-2 truncate font-mono text-xl font-semibold">{item.value}</p>
                <p className="text-[10px] text-muted-foreground">{item.note}</p>
              </section>
            ))}
          </div>
        )}
        {/* 各分类先呈现历史变化，再提供对应的分布与明细。 */}
        <div className="monitor-chart-grid">
          {(category === "all" || category === "timeline" || category === "cpu") &&
            historyChart(["cpu"], "CPU 使用率")}
          {(category === "timeline" || category === "storage") &&
            historyChart(["mem"], "物理内存使用走势")}
          {(category === "all" || category === "timeline" || category === "network") &&
            historyChart(["rx", "tx"], "网络传输速率 · 线性刻度")}
          {(category === "timeline" || category === "storage") &&
            historyChart(["disk"], "磁盘占用走势")}
          {(category === "storage" || category === "timeline") &&
            node.swap_total > 0 &&
            historyChart(["swap"], "Swap 使用走势")}
          {(category === "timeline" || category === "connections") &&
            historyChart(["tcp", "udp"], "TCP / UDP 套接字走势")}
          {(category === "timeline" || category === "connections") &&
            historyChart(["procs"], "系统进程数走势")}
        </div>
        {category === "all" && (
          <div className="monitor-chart-grid">
            <Panel title="资源容量使用率对比" note="淡色：历史加权均值 · 实色：当前值">
              {capacity.some((item) => item.current !== null || item.average !== null) ? (
                <div className="h-56 text-muted-foreground">
                  <ResponsiveContainer>
                    <BarChart layout="vertical" data={capacity} margin={{ right: 24 }}>
                      <CartesianGrid
                        horizontal={false}
                        stroke="var(--color-border)"
                        strokeDasharray="3 3"
                      />
                      <XAxis
                        {...AXIS}
                        type="number"
                        domain={[0, 100]}
                        tickFormatter={(v) => `${v}%`}
                      />
                      <YAxis {...AXIS} type="category" dataKey="name" width={76} />
                      <Tooltip {...CHART_TOOLTIP} formatter={(v) => cpuFormat(Number(v))} />
                      <Bar
                        dataKey="average"
                        name="历史加权均值"
                        fillOpacity={0.3}
                        isAnimationActive={false}
                      >
                        {capacity.map((item) => (
                          <Cell key={item.name} fill={item.color} />
                        ))}
                      </Bar>
                      <Bar dataKey="current" name="实时值" isAnimationActive={false}>
                        {capacity.map((item) => (
                          <Cell key={item.name} fill={item.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex h-56 items-center justify-center text-xs text-muted-foreground">
                  暂无可比较的实时或历史数据
                </div>
              )}
            </Panel>
            <Panel title="典型负荷与高位水平" note="桶均值分位数 · 按观测时长加权">
              <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-4 text-xs">
                <span className="text-muted-foreground">指标</span>
                <span className="text-muted-foreground">P50</span>
                <span className="text-muted-foreground">P95</span>
                {quantiles.map((item) => {
                  const descriptor = descriptors.find((d) => d.field === item.key)!
                  return (
                    <div key={item.key} className="contents">
                      <span style={{ color: descriptor.color }}>{descriptor.name}</span>
                      <span className="font-mono">{display(item.p50, descriptor.format)}</span>
                      <span className="font-mono">{display(item.p95, descriptor.format)}</span>
                    </div>
                  )
                })}
              </div>
              <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
                P95 表示约 95% 已观测时长的桶均值不超过此值；聚合后的分位数不能替代原始采样分位数。
              </p>
            </Panel>
          </div>
        )}
        {(category === "heatmap" || category === "cpu") && (
          <Panel title="分时负载热力" note="每格为窗口等分时段 · 灰格表示缺测">
            <div className="mb-3 flex flex-wrap gap-1">
              {descriptors
                .filter((item) => item.key !== "swap" || node.swap_total > 0)
                .map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    aria-pressed={heatKey === item.key}
                    onClick={() => setHeatKey(item.key)}
                    className={cn(
                      "border px-2 py-1 text-[11px] transition-colors",
                      heatKey === item.key
                        ? "border-primary/60 bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {item.name}
                  </button>
                ))}
            </div>
            <p className="mb-2 text-[11px] text-muted-foreground">
              {heatItem.name} ·{" "}
              {"total" in heatItem
                ? "颜色按容量百分比"
                : "颜色按当前窗口最大分时均值缩放；跨窗口颜色不可直接比较"}
            </p>
            <div
              key={heatKey}
              className="relative grid animate-fade-in grid-cols-4 gap-1.5 sm:grid-cols-6 lg:grid-cols-12"
            >
              {buckets.map((bucket) => (
                <div
                  key={bucket.start}
                  className="group rounded-[1px] border border-border/60 p-1.5 text-center transition-colors hover:border-primary focus-visible:outline focus-visible:outline-primary"
                  tabIndex={0}
                  role="img"
                  aria-label={`${moment(bucket.start)} 至 ${moment(bucket.end)}，${heatItem.name} ${display(heatValue(bucket), heatFormat)}，覆盖 ${bucket.coverage.toFixed(1)}%`}
                  style={{
                    background:
                      heatValue(bucket) === null
                        ? "var(--color-muted)"
                        : `color-mix(in srgb, ${heatItem.color} ${10 + Math.min(1, (heatValue(bucket) ?? 0) / ("total" in heatItem ? 100 : heatMax)) * 65}%, transparent)`,
                  }}
                >
                  <div className="text-[10px] text-muted-foreground">
                    {hours > 24
                      ? new Date(bucket.start * 1000).toLocaleDateString("zh-CN", {
                        month: "numeric",
                        day: "numeric",
                      })
                      : new Date(bucket.start * 1000).toLocaleTimeString("zh-CN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                  </div>
                  <div className="my-1 font-mono text-xs">
                    {display(heatValue(bucket), heatFormat)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    覆盖 {bucket.coverage.toFixed(0)}%
                  </div>
                  <span className="pointer-events-none absolute bottom-full left-1/2 z-20 hidden w-64 max-w-[calc(100vw-3rem)] -translate-x-1/2 border border-border bg-card p-2 text-left text-[11px] text-card-foreground shadow-sm group-hover:block group-focus-within:block">
                    {moment(bucket.start)} — {moment(bucket.end)}
                    <br />
                    {heatItem.name} 均值 {display(heatValue(bucket), heatFormat)}
                    {heatKey === "cpu" && <> · CPU 峰值 {display(bucket.peak, cpuFormat)}</>}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              灰格表示未采集。粗粒度桶的时段覆盖比例为估算值。
            </p>
          </Panel>
        )}
        {(category === "cpu" || category === "distribution") && (
          <div className="monitor-chart-grid">
            <Panel
              title="CPU 桶均值的负荷区间分布"
              note="占比以已观测时长为分母；不代表桶内瞬时峰值分布"
            >
              <div className="h-52 text-muted-foreground">
                <ResponsiveContainer>
                  <BarChart layout="vertical" data={distribution} margin={{ right: 15 }}>
                    <CartesianGrid
                      horizontal={false}
                      stroke="var(--color-border)"
                      strokeDasharray="3 3"
                    />
                    <XAxis
                      {...AXIS}
                      type="number"
                      domain={[0, 100]}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <YAxis {...AXIS} type="category" dataKey="name" width={105} />
                    <Tooltip
                      {...CHART_TOOLTIP}
                      formatter={(v, _name, item) =>
                        `${Number(v).toFixed(1)}% · ${(Number(item.payload.seconds) / 60).toFixed(1)} 分钟`
                      }
                    />
                    <Bar dataKey="pct" name="观测时长占比" isAnimationActive={false}>
                      {distribution.map((item) => (
                        <Cell key={item.name} fill={item.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {!stats.cpu.seconds && (
                <p className="text-xs text-muted-foreground">暂无有效 CPU 观测时长</p>
              )}
            </Panel>
            {category === "distribution" ? (
              <Distribution
                title="窗口估算流量构成"
                items={[
                  {
                    name: "下行 RX",
                    value: stats.rx.avg === null ? null : stats.rx.integral,
                    color: COLORS.rx,
                  },
                  {
                    name: "上行 TX",
                    value: stats.tx.avg === null ? null : stats.tx.integral,
                    color: COLORS.tx,
                  },
                ]}
              />
            ) : (
              <Panel title="当前系统负载" note="当前 1 / 5 / 15 分钟平均负载；不受历史窗口影响">
                {m?.load ? (
                  <>
                    <div className="h-40 text-muted-foreground">
                      <ResponsiveContainer>
                        <BarChart
                          data={m.load.map((value, i) => ({
                            name: ["1 分钟", "5 分钟", "15 分钟"][i],
                            value,
                          }))}
                        >
                          <XAxis {...AXIS} dataKey="name" />
                          <YAxis {...AXIS} domain={[0, "auto"]} />
                          <Tooltip {...CHART_TOOLTIP} formatter={(v) => Number(v).toFixed(2)} />
                          <ReferenceLine
                            y={node.cpu_cores}
                            stroke="var(--color-destructive)"
                            strokeDasharray="3 3"
                          />
                          <Bar
                            dataKey="value"
                            name="系统负载"
                            fill={COLORS.cpu}
                            isAnimationActive={false}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      虚线为 {node.cpu_cores} 核参考值；负载含可运行及不可中断任务，不能仅据其判断
                      CPU 饱和。
                    </p>
                  </>
                ) : (
                  <p className="py-12 text-center text-xs text-muted-foreground">
                    暂无实时负载数据
                  </p>
                )}
              </Panel>
            )}
          </div>
        )}
        {(category === "storage" || category === "distribution") && (
          <div className="monitor-chart-grid monitor-chart-grid--compact">
            {descriptors
              .filter(
                (item) =>
                  item.category === "storage" && (item.key !== "swap" || node.swap_total > 0),
              )
              .map((item) => (
                <Distribution
                  key={item.key}
                  title={`${item.name} · 当前容量分布`}
                  items={[
                    {
                      name: "已用",
                      value: item.current ?? null,
                      color: item.color,
                    },
                    {
                      name: "剩余",
                      value:
                        item.current == null || !("total" in item) || !item.total
                          ? null
                          : Math.max(0, item.total - item.current),
                      color: "var(--color-muted-foreground)",
                    },
                  ]}
                />
              ))}
          </div>
        )}
        {category === "network" && (
          <>
            <div className="monitor-chart-grid monitor-chart-grid--compact">
              <Distribution
                title="窗口估算流量构成"
                items={[
                  {
                    name: "下行 RX",
                    value: stats.rx.avg === null ? null : stats.rx.integral,
                    color: COLORS.rx,
                  },
                  {
                    name: "上行 TX",
                    value: stats.tx.avg === null ? null : stats.tx.integral,
                    color: COLORS.tx,
                  },
                ]}
              />
              <Panel title="当前计费周期配额" note="独立于历史窗口">
                <div className="space-y-3 text-xs">
                  <p>
                    已计量 <strong className="font-mono">{bytes(usedTraffic)}</strong>
                  </p>
                  <p>配额 {node.traffic_limit > 0 ? bytes(node.traffic_limit) : "不限流量"}</p>
                  <p>
                    模式：
                    {{
                      up: "仅上行",
                      down: "仅下行",
                      max: "双向取大",
                      sum: "双向合计",
                    }[node.traffic_mode] ?? "双向合计"}
                  </p>
                  <p>使用率 {quotaPct === null ? "—" : `${quotaPct.toFixed(1)}%`}</p>
                  {quotaPct !== null && (
                    <div className="h-1.5 bg-muted">
                      <div
                        className="h-full transition-all duration-300"
                        style={{
                          width: `${Math.min(100, quotaPct)}%`,
                          background: quotaPct >= 90 ? "var(--color-destructive)" : COLORS.cpu,
                        }}
                      />
                    </div>
                  )}
                  <p className="text-muted-foreground">每月 {node.traffic_reset_day || 1} 日重置</p>
                </div>
              </Panel>
              <Panel title="当前流量累计" note="独立于历史窗口">
                <dl className="space-y-3 text-xs">
                  {[
                    ["今日 RX", node.day_rx],
                    ["今日 TX", node.day_tx],
                    ["周期 RX", node.month_rx],
                    ["周期 TX", node.month_tx],
                    ["累计 RX", node.total_rx],
                    ["累计 TX", node.total_tx],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between">
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="font-mono">{bytes(Number(value))}</dd>
                    </div>
                  ))}
                </dl>
              </Panel>
            </div>
            <Panel title="分时观测流量" note="RX + TX 堆叠 · 速率 × 已观测时长 · 不补齐缺测">
              <div className="h-52 text-muted-foreground">
                <ResponsiveContainer>
                  <BarChart
                    data={buckets.map((bucket) => ({
                      ...bucket,
                      ts: bucket.start * 1000,
                    }))}
                  >
                    <CartesianGrid
                      stroke="var(--color-border)"
                      vertical={false}
                      strokeDasharray="3 3"
                    />
                    <XAxis
                      {...AXIS}
                      dataKey="ts"
                      tickFormatter={tickClock(ticks, hours)}
                      minTickGap={45}
                    />
                    <YAxis {...AXIS} tickFormatter={axisBytes} width={65} />
                    <Tooltip
                      {...CHART_TOOLTIP}
                      labelFormatter={(v) => moment(Number(v) / 1000)}
                      formatter={(v) => bytes(Number(v))}
                    />
                    <Bar
                      dataKey="rxBytes"
                      name="下行 RX 估算流量"
                      stackId="traffic"
                      fill={COLORS.rx}
                      isAnimationActive={false}
                    />
                    <Bar
                      dataKey="txBytes"
                      name="上行 TX 估算流量"
                      stackId="traffic"
                      fill={COLORS.tx}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
            <Panel title="分时平均网络速率" note="缺测时段留空；单位为字节每秒">
              <div className="h-52 text-muted-foreground">
                <ResponsiveContainer>
                  <BarChart
                    data={buckets.map((bucket) => ({
                      ...bucket,
                      ts: bucket.start * 1000,
                    }))}
                  >
                    <CartesianGrid stroke="var(--color-border)" vertical={false} />
                    <XAxis
                      dataKey="ts"
                      {...AXIS}
                      tickFormatter={tickClock(ticks, hours)}
                      minTickGap={45}
                    />
                    <YAxis {...AXIS} tickFormatter={axisBytes} width={65} />
                    <Tooltip
                      {...CHART_TOOLTIP}
                      labelFormatter={(v) => new Date(Number(v)).toLocaleString("zh-CN")}
                      formatter={(v) => rate(Number(v))}
                    />
                    <Bar dataKey="rx" name="RX" fill={COLORS.rx} isAnimationActive={false} />
                    <Bar dataKey="tx" name="TX" fill={COLORS.tx} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                窗口流量由速率 × 已观测时长估算，不替代服务端计费累计量。
              </p>
            </Panel>
          </>
        )}
        {category === "connections" && (
          <div className="monitor-chart-grid">
            <Distribution
              title="当前 TCP / UDP 数量构成"
              format={number}
              items={[
                { name: "TCP", value: m?.tcp ?? null, color: COLORS.tcp },
                { name: "UDP", value: m?.udp ?? null, color: COLORS.udp },
              ]}
            />
            <Panel title="分时系统进程数" note="各时段按实际观测时长加权；不是进程创建次数">
              <div className="h-52 text-muted-foreground">
                <ResponsiveContainer>
                  <BarChart
                    data={buckets.map((bucket) => ({
                      ...bucket,
                      ts: bucket.start * 1000,
                    }))}
                  >
                    <CartesianGrid
                      vertical={false}
                      stroke="var(--color-border)"
                      strokeDasharray="3 3"
                    />
                    <XAxis
                      {...AXIS}
                      dataKey="ts"
                      tickFormatter={tickClock(ticks, hours)}
                      minTickGap={45}
                    />
                    <YAxis {...AXIS} allowDecimals={false} />
                    <Tooltip
                      {...CHART_TOOLTIP}
                      labelFormatter={(v) => moment(Number(v) / 1000)}
                      formatter={(v) => Number(v).toFixed(1)}
                    />
                    <Bar
                      dataKey="procs"
                      name="平均进程数"
                      fill={COLORS.procs}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>
        )}
      </div>
      {/* 明细表按领域筛选，仅显示能从历史实际计算的指标。 */}
      <section className="overflow-hidden rounded-[2px] border border-border/70">
        <button
          type="button"
          aria-expanded={showTable}
          onClick={() => setShowTable((v) => !v)}
          className="flex w-full items-center justify-between bg-card/60 px-3 py-2 text-xs transition-colors hover:bg-muted/40"
        >
          <span>指标明细 · {visible.length} 项</span>
          <span>{showTable ? "收起 −" : "展开 +"}</span>
        </button>
        <div
          className={cn(
            "grid transition-[grid-template-rows,opacity] duration-200",
            showTable ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
          )}
          inert={!showTable}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full whitespace-nowrap text-left text-xs">
                <thead className="bg-muted/30 text-muted-foreground">
                  <tr>
                    {["指标", "实时值", "窗口加权均值", "窗口峰值 / 桶均值峰值", "容量"].map(
                      (label) => (
                        <th key={label} className="px-3 py-2 font-normal">
                          {label}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((item) => (
                    <tr key={item.key} className="border-t border-border/40">
                      <td className="px-3 py-2">{item.name}</td>
                      <td className="px-3 py-2 font-mono">{display(item.current, item.format)}</td>
                      <td className="px-3 py-2 font-mono">
                        {display(stats[item.key].avg, item.format)}
                      </td>
                      <td className="px-3 py-2 font-mono">
                        {display(stats[item.key].peak, item.format)}{" "}
                        {!("peakField" in item) && (
                          <span className="text-muted-foreground">（桶均值）</span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono">
                        {"total" in item && item.total > 0 ? item.format(item.total) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
      {rows.length === 0 && (
        <p role="status" className="text-center text-xs text-muted-foreground">
          当前窗口暂无历史遥测数据；缺测不等同于服务不可用。
        </p>
      )}
    </div>
  )
}
