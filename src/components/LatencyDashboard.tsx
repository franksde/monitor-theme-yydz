/**
 * 网络延迟多维测控驾驶舱组件 (Latency Dashboard & Route Analysis)
 * 具备：
 * 1. 探测线路指标卡片网格（含实时延迟、质量评级、丢包率、极值抖动、SVG 微型火花线趋势）
 * 2. 多视图自由切换（聚合多线对比 / 分轨独立矩阵 / 路由阶梯排行）
 * 3. 彻底修复底部时间滑块（Brush）在黑暗模式下的高亮大白块问题（自适应暗灰半透明工控滑块）
 * 4. 线路单选聚焦 (Solo)、隐藏/显示筛选、削峰 (Despike) 平滑滤波
 * 遵循 AGENT.md 规范：采用微倒角 (2px)、全中文注释、工业仪器极简美学、零多余外部依赖。
 */

import { useMemo, useState } from "react"
import {
  Area,
  Bar,
  BarChart,
  Brush,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  BarChart2,
  Grid,
  TrendingUp,
  Wifi,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { clockFor, despike, tickClock, timeTicks } from "@/lib/format"
import { cn } from "@/lib/utils"

export type PingSample = {
  task_id: number
  ts: number
  latency: number | null
  band?: [number, number]
  loss?: number
}

export type ProbeSeries = {
  id: number
  name: string
  points: PingSample[]
  loss: number
}

export type LatencyDashboardProps = {
  pingSeries: ProbeSeries[]
  hours: number
  smooth: boolean
  onToggleSmooth: (smooth: boolean) => void
}

type ViewMode = "combined" | "split" | "ranking"

const AXIS = { stroke: "currentColor", fontSize: 11, tickLine: false, axisLine: false }
const SERIES = { dot: false as const, strokeWidth: 1.5, isAnimationActive: false }

// 工控高对比度调色盘（多线路各具辨识度，同时兼具深浅色模式表现力）
const PALETTE = [
  { stroke: "oklch(0.68 0.19 145)", dash: undefined, label: "翠绿" },
  { stroke: "oklch(0.65 0.18 240)", dash: "5 3", label: "天蓝" },
  { stroke: "oklch(0.72 0.16 75)", dash: "2 2", label: "琥珀" },
  { stroke: "oklch(0.68 0.22 310)", dash: "8 3 2 3", label: "紫罗兰" },
  { stroke: "oklch(0.65 0.22 25)", dash: "4 2", label: "玫瑰" },
  { stroke: "oklch(0.62 0.15 195)", dash: "1 3", label: "青碧" },
]

const TOOLTIP_STYLE = {
  isAnimationActive: false,
  labelFormatter: (ts: unknown) => new Date(Number(ts)).toLocaleString("zh-CN"),
  contentStyle: {
    fontSize: 12,
    borderRadius: 2,
    border: "1px solid var(--color-border)",
    background: "var(--color-card)",
    color: "var(--color-foreground)",
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
  },
}

function despikeWindow(points: { ts: number }[]): number {
  let step = Infinity
  for (let i = 1; i < points.length; i++) step = Math.min(step, points[i].ts - points[i - 1].ts)
  return Math.min(15, Math.max(3, Math.round(420 / step) | 1))
}

function getProbeStyle(id: number, series: ProbeSeries[]) {
  const idx = series.findIndex((p) => p.id === id)
  return PALETTE[idx >= 0 ? idx % PALETTE.length : 0]
}

export function LatencyDashboard({
  pingSeries,
  hours,
  smooth,
  onToggleSmooth,
}: LatencyDashboardProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("combined")
  const [hiddenProbes, setHiddenProbes] = useState<number[]>([])
  const [zoom, setZoom] = useState<[number, number] | null>(null)

  // 1. 各探测线路样式映射（稳定绑定）
  const getStyle = (id: number) => getProbeStyle(id, pingSeries)

  // 2. 探测线路综合指标分析（最新、均值、最低、最高、抖动与质量等级）
  const probeSummaries = useMemo(() => {
    return pingSeries.map((s) => {
      const validPoints = s.points.filter((p) => p.latency !== null && p.latency !== undefined)
      const values = validPoints.map((p) => p.latency as number)

      const latest = validPoints.length > 0 ? validPoints[validPoints.length - 1].latency : null
      const min = values.length > 0 ? Math.min(...values) : 0
      const max = values.length > 0 ? Math.max(...values) : 0
      const sum = values.reduce((acc, v) => acc + v, 0)
      const avg = values.length > 0 ? sum / values.length : 0

      // 计算网络抖动（相邻采样点差值的绝对值均值）
      let diffSum = 0
      for (let i = 1; i < values.length; i++) {
        diffSum += Math.abs(values[i] - values[i - 1])
      }
      const jitter = values.length > 1 ? diffSum / (values.length - 1) : 0

      // 线路质量等级评级
      let tier = {
        label: "极佳",
        colorClass: "text-emerald-500",
      }
      if (avg >= 200 || s.loss >= 15) {
        tier = { label: "较差", colorClass: "text-rose-500" }
      } else if (avg >= 100 || s.loss >= 5) {
        tier = { label: "一般", colorClass: "text-amber-500" }
      } else if (avg >= 50) {
        tier = { label: "优良", colorClass: "text-sky-500" }
      }

      // 生成用于微型火花线 Sparkline 的数据采样
      const sparkSampleCount = 30
      const sparkStep = Math.max(1, Math.floor(validPoints.length / sparkSampleCount))
      const sparklineData = validPoints
        .filter((_, i) => i % sparkStep === 0)
        .slice(-sparkSampleCount)
        .map((p) => p.latency as number)

      return {
        ...s,
        latest,
        min,
        max,
        avg,
        jitter,
        tier,
        sparklineData,
        style: getProbeStyle(s.id, pingSeries),
      }
    })
  }, [pingSeries])

  // 3. 构建多线路时间对齐行（用于聚合图表）
  const pingRows = useMemo(() => {
    const rows = new Map<
      number,
      { ts: number } & Record<string, number | [number, number] | null>
    >()

    for (const s of pingSeries) {
      const windowSize = despikeWindow(s.points)
      const smoothed = despike(s.points.map((p) => p.latency), windowSize)
      const lo = despike(s.points.map((p) => p.band?.[0] ?? p.latency), windowSize)
      const hi = despike(s.points.map((p) => p.band?.[1] ?? p.latency), windowSize)

      s.points.forEach((p, i) => {
        const row = rows.get(p.ts) ?? { ts: p.ts * 1_000 }
        row[`t${s.id}`] = p.latency
        row[`s${s.id}`] = smoothed[i]
        row[`l${s.id}`] = p.loss ?? 0
        row[`b${s.id}`] = p.band ?? (p.latency === null ? null : [p.latency, p.latency])

        const [low, high] = [lo[i], hi[i]]
        row[`c${s.id}`] =
          low === null || high === null
            ? null
            : [Math.min(low, high, smoothed[i] ?? low), Math.max(low, high, smoothed[i] ?? high)]
        rows.set(p.ts, row)
      })
    }
    return [...rows.values()].sort((a, b) => a.ts - b.ts)
  }, [pingSeries])

  // 4. 当前处于激活展示状态的探测线路
  const shownProbes = useMemo(
    () => pingSeries.filter((s) => !hiddenProbes.includes(s.id)),
    [pingSeries, hiddenProbes]
  )

  // 5. 排序排行图表数据（按平均延迟由快到慢排序）
  const rankingData = useMemo(() => {
    return [...probeSummaries]
      .sort((a, b) => a.avg - b.avg)
      .map((s) => ({
        name: s.name,
        avg: Math.round(s.avg),
        min: Math.round(s.min),
        max: Math.round(s.max),
        jitter: Math.round(s.jitter),
        loss: s.loss,
      }))
  }, [probeSummaries])

  // 时间轴生成器
  const timeAxis = (rows: { ts: number }[], from = 0, to = rows.length - 1) => {
    const ticks = rows.length ? timeTicks(rows[from].ts, rows[to].ts) : []
    return {
      dataKey: "ts",
      type: "number" as const,
      domain: ["dataMin", "dataMax"] as const,
      ticks,
      tickFormatter: tickClock(ticks, hours),
      minTickGap: hours > 24 ? 72 : 40,
      ...AXIS,
    }
  }

  // 独占聚焦单条线路 (Solo)
  const handleSolo = (id: number) => {
    if (hiddenProbes.length === pingSeries.length - 1 && !hiddenProbes.includes(id)) {
      // 已经处于该单线 Solo 状态，点击恢复全部显示
      setHiddenProbes([])
    } else {
      // 将除该 id 外的所有其他线路隐藏
      setHiddenProbes(pingSeries.filter((s) => s.id !== id).map((s) => s.id))
    }
  }

  return (
    <div className="space-y-4">
      {/* 顶部控制栏与视图切换 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-2.5">
        <div className="flex items-center gap-2">
          <Wifi className="size-4 text-primary" />
          <span className="font-semibold text-foreground text-xs">网络延迟拓扑测控</span>
          <Badge className="h-4 rounded-[1px] px-1 text-[9px] uppercase tracking-wider text-muted-foreground border-border/60">
            {pingSeries.length} 条测试线路
          </Badge>
        </div>

        {/* 交互工具栏：削峰开关与视图模式切换器 */}
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground select-none">
            <input
              type="checkbox"
              checked={smooth}
              onChange={(e) => onToggleSmooth(e.target.checked)}
              className="accent-foreground rounded-[1px]"
            />
            <span>智能削峰</span>
          </label>

          {/* 视图模式按钮 */}
          <div className="flex items-center gap-1 rounded-[2px] border border-border/60 bg-muted/30 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setViewMode("combined")}
              className={cn(
                "flex items-center gap-1 rounded-[1px] px-2 py-0.5 transition-colors",
                viewMode === "combined"
                  ? "bg-primary text-primary-foreground font-medium shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <TrendingUp className="size-3" />
              <span>聚合对比</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode("split")}
              className={cn(
                "flex items-center gap-1 rounded-[1px] px-2 py-0.5 transition-colors",
                viewMode === "split"
                  ? "bg-primary text-primary-foreground font-medium shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Grid className="size-3" />
              <span>分轨矩阵</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode("ranking")}
              className={cn(
                "flex items-center gap-1 rounded-[1px] px-2 py-0.5 transition-colors",
                viewMode === "ranking"
                  ? "bg-primary text-primary-foreground font-medium shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <BarChart2 className="size-3" />
              <span>延迟排行</span>
            </button>
          </div>
        </div>
      </div>

      {/* 1. 探测线路指标卡片网格（直观卡片展现各线路现状、极值抖动与走势火花线） */}
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {probeSummaries.map((s) => {
          const isShown = !hiddenProbes.includes(s.id)
          const isSolo = hiddenProbes.length === pingSeries.length - 1 && isShown

          // 计算 SVG 火花线路径
          const spark = s.sparklineData
          const minVal = Math.min(...spark, 0)
          const maxVal = Math.max(...spark, 10)
          const range = Math.max(1, maxVal - minVal)
          const sparkW = 80
          const sparkH = 24
          const pointsStr = spark
            .map((val, idx) => {
              const x = (idx / (spark.length - 1 || 1)) * sparkW
              const y = sparkH - ((val - minVal) / range) * (sparkH - 4) - 2
              return `${x.toFixed(1)},${y.toFixed(1)}`
            })
            .join(" ")

          return (
            <div
              key={`probe-card-${s.id}`}
              onClick={() =>
                setHiddenProbes((h) =>
                  isShown ? [...h, s.id] : h.filter((id) => id !== s.id)
                )
              }
              className={cn(
                "group relative flex flex-col justify-between rounded-[2px] border p-2.5 transition-all duration-150 cursor-pointer select-none",
                isShown
                  ? "border-border/80 bg-card/75 shadow-2xs hover:border-primary/60"
                  : "border-border/30 bg-muted/20 opacity-40 hover:opacity-70"
              )}
            >
              {/* 卡片头部：线路名、色彩图例与质量徽标 */}
              <div className="flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5 truncate">
                  <span
                    className="h-2.5 w-1 rounded-[0.5px] shrink-0"
                    style={{ backgroundColor: s.style.stroke }}
                  />
                  <span className="truncate text-xs font-semibold text-foreground">
                    {s.name}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {s.loss > 0 && (
                    <Badge className="h-4 px-1 text-[9px] rounded-[1px] font-mono border-destructive/40 bg-destructive/15 text-destructive">
                      丢 {s.loss < 1 ? "<1" : Math.round(s.loss)}%
                    </Badge>
                  )}
                  <span className={cn("text-[10px] font-mono font-medium", s.tier.colorClass)}>
                    {s.tier.label}
                  </span>
                </div>
              </div>

              {/* 卡片主体：大字当前延迟 + 迷你火花线 */}
              <div className="my-2 flex items-baseline justify-between gap-2">
                <div>
                  <span className="font-mono text-xl font-bold tracking-tight text-foreground">
                    {s.latest !== null ? Math.round(s.latest) : "—"}
                  </span>
                  <span className="ml-1 text-[10px] text-muted-foreground font-mono">ms</span>
                </div>

                {/* 纯 SVG 微型火花线趋势图 */}
                {spark.length > 1 && (
                  <svg width={sparkW} height={sparkH} className="overflow-visible opacity-75">
                    <polyline
                      fill="none"
                      stroke={s.style.stroke}
                      strokeWidth="1.5"
                      strokeDasharray={s.style.dash}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={pointsStr}
                    />
                  </svg>
                )}
              </div>

              {/* 卡片底部：极值统计与独占聚焦快捷按钮 */}
              <div className="flex items-center justify-between border-t border-border/30 pt-1.5 text-[10px] font-mono text-muted-foreground">
                <span>
                  均 {Math.round(s.avg)} · 极 {Math.round(s.min)}-{Math.round(s.max)}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleSolo(s.id)
                  }}
                  className={cn(
                    "rounded-[1px] px-1 py-0.2 hover:bg-muted/80 transition-colors",
                    isSolo ? "bg-primary text-primary-foreground font-semibold" : "opacity-70 hover:opacity-100"
                  )}
                  title={isSolo ? "取消单线聚焦" : "单线聚焦 (Solo)"}
                >
                  {isSolo ? "独占中" : "单线"}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* 2. 核心图表区域：根据用户选定的视图模式渲染 */}

      {/* 2.1 聚合对比视图 (Combined View)：高度适中优雅，带底部深色自适应 Brush */}
      {viewMode === "combined" && (
        <div className="rounded-[2px] border border-border/70 bg-card/60 p-3 shadow-2xs">
          <div className="flex items-center justify-between border-b border-border/40 pb-2 text-xs font-semibold text-foreground">
            <span className="flex items-center gap-1.5">
              <TrendingUp className="size-3.5 text-primary" />
              <span>多线路时序延迟对比（已选 {shownProbes.length}/{pingSeries.length} 线）</span>
            </span>
            <span className="text-[11px] font-mono font-normal text-muted-foreground">
              拖动底部滑块可缩放时间区间
            </span>
          </div>

          <div className="mt-2.5 h-80 w-full text-muted-foreground sm:h-96">
            {shownProbes.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                没有选定任何探测线路，请点击上方卡片开启
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={pingRows}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis
                    {...timeAxis(
                      pingRows,
                      Math.min(zoom?.[0] ?? 0, pingRows.length - 1),
                      Math.min(zoom?.[1] ?? pingRows.length - 1, pingRows.length - 1)
                    )}
                  />
                  <YAxis unit="ms" width={48} domain={["auto", "auto"]} {...AXIS} />
                  <Tooltip
                    {...TOOLTIP_STYLE}
                    formatter={(v, name, item) => {
                      const loss = Number(item?.payload?.[`l${String(item.dataKey).slice(1)}`] ?? 0)
                      return [`${Math.round(Number(v))} ms${loss > 0 ? ` (丢包 ${loss}%)` : ""}`, name]
                    }}
                  />

                  {/* 单线路激活时展示 Smokeping 烟雾区间 */}
                  {shownProbes.length === 1 &&
                    shownProbes.map((s) => (
                      <Area
                        key={`band-${s.id}`}
                        dataKey={`${smooth ? "c" : "b"}${s.id}`}
                        stroke="none"
                        fill={getStyle(s.id).stroke}
                        fillOpacity={0.16}
                        isAnimationActive={false}
                        tooltipType="none"
                        legendType="none"
                        connectNulls
                      />
                    ))}

                  {/* 各线路折线 */}
                  {shownProbes.map((s) => {
                    const st = getStyle(s.id)
                    return (
                      <Line
                        key={`line-${s.id}`}
                        dataKey={`${smooth ? "s" : "t"}${s.id}`}
                        name={s.name}
                        stroke={st.stroke}
                        strokeDasharray={st.dash}
                        {...SERIES}
                        connectNulls
                      />
                    )
                  })}

                  {/* 彻底解决深色模式大白块的优雅工控 Brush 时间滑块 */}
                  <Brush
                    dataKey="ts"
                    height={22}
                    travellerWidth={8}
                    tickFormatter={clockFor(hours)}
                    fill="var(--color-card)"
                    stroke="var(--color-border)"
                    fillOpacity={0.65}
                    onChange={(r) =>
                      setZoom([r.startIndex ?? 0, r.endIndex ?? pingRows.length - 1])
                    }
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* 2.2 分轨独立矩阵视图 (Split Lanes)：每条线路拥有独立 Y 轴，低延迟与高延迟互不干扰 */}
      {viewMode === "split" && (
        <div className="grid gap-3 sm:grid-cols-2">
          {probeSummaries.map((s) => {
            const isShown = !hiddenProbes.includes(s.id)
            if (!isShown) return null

            // 单线路专属数据行
            const singleRows = pingRows.map((r) => ({
              ts: r.ts,
              latency: smooth ? r[`s${s.id}`] : r[`t${s.id}`],
              band: smooth ? r[`c${s.id}`] : r[`b${s.id}`],
            }))

            return (
              <div
                key={`split-lane-${s.id}`}
                className="rounded-[2px] border border-border/70 bg-card/60 p-3 shadow-2xs"
              >
                <div className="flex items-center justify-between border-b border-border/40 pb-1.5 text-xs">
                  <div className="flex items-center gap-1.5 truncate">
                    <span
                      className="size-2 rounded-[0.5px] shrink-0"
                      style={{ backgroundColor: s.style.stroke }}
                    />
                    <span className="font-semibold text-foreground truncate">{s.name}</span>
                  </div>
                  <div className="font-mono text-[11px] text-muted-foreground">
                    最新: {s.latest !== null ? Math.round(s.latest) : "—"}ms · 均值: {Math.round(s.avg)}ms
                  </div>
                </div>

                <div className="mt-2 h-44 w-full text-muted-foreground">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={singleRows}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                      <XAxis {...timeAxis(singleRows)} />
                      <YAxis unit="ms" width={40} domain={["auto", "auto"]} {...AXIS} />
                      <Tooltip
                        {...TOOLTIP_STYLE}
                        formatter={(v) => [`${Math.round(Number(v))} ms`, s.name]}
                      />
                      <Area
                        dataKey="band"
                        stroke="none"
                        fill={s.style.stroke}
                        fillOpacity={0.16}
                        isAnimationActive={false}
                        tooltipType="none"
                        connectNulls
                      />
                      <Line
                        dataKey="latency"
                        name={s.name}
                        stroke={s.style.stroke}
                        strokeDasharray={s.style.dash}
                        {...SERIES}
                        connectNulls
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 2.3 线路延迟排行柱状图 (Ranking View)：直观阶梯对比哪条线路最快最优 */}
      {viewMode === "ranking" && (
        <div className="rounded-[2px] border border-border/70 bg-card/60 p-3 shadow-2xs">
          <div className="flex items-center justify-between border-b border-border/40 pb-2 text-xs font-semibold text-foreground">
            <span className="flex items-center gap-1.5">
              <BarChart2 className="size-3.5 text-primary" />
              <span>各线路平均响应延迟梯队对比</span>
            </span>
            <span className="text-[11px] font-mono font-normal text-muted-foreground">
              按平均延迟从快到慢阶梯排列
            </span>
          </div>

          <div className="mt-3 h-80 w-full text-muted-foreground">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rankingData} layout="vertical" margin={{ left: 20, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                <XAxis type="number" unit="ms" {...AXIS} />
                <YAxis dataKey="name" type="category" width={80} {...AXIS} />
                <Tooltip
                  {...TOOLTIP_STYLE}
                  formatter={(v, name) => [
                    `${v} ms`,
                    name === "avg" ? "平均延迟" : name === "min" ? "最低延迟" : "最高延迟",
                  ]}
                />
                <Bar dataKey="avg" name="平均延迟" fill="var(--color-primary)" radius={[0, 2, 2, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
