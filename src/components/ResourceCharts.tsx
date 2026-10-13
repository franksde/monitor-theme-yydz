/**
 * 节点系统资源监控全景组件 (Resource Charts & Telemetry)
 * 具备：
 * 1. 实时与窗口 Use 比例度量条 (CPU / 内存 / 磁盘 / 流量消耗)
 * 2. 内存与存储容量分布环形饼图 (Donut Charts)
 * 3. 24 时段负载活动热力图 (Activity Heatmap)
 * 4. 深度时序曲线面积图 (CPU / 内存 / 对数带宽峰值带 / 硬盘)
 * 5. 多视图自由切换胶囊 (综合总览 / 时序走势 / 负载热力 / 占比分布)
 * 遵循 AGENT.md 规范：采用微倒角 (2px)、全中文注释、工业仪器极简美学、零多余外部依赖。
 */

import { useMemo, useState } from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type DotItemDotProps,
} from "recharts"
import {
  Activity,
  Cpu,
  Flame,
  HardDrive,
  Layers,
  PieChart as PieIcon,
  TrendingUp,
} from "lucide-react"

import type { Node } from "@/lib/api"
import {
  axisBytes,
  bytes,
  percent,
  quarters,
  rate,
  RATE_FLOOR,
  rateAxis,
  tickClock,
  timeTicks,
  withGaps,
} from "@/lib/format"
import { cn } from "@/lib/utils"

export type MetricPoint = {
  ts: number
  cpu: number
  mem_used: number
  disk_used: number
  net_rx: number
  net_tx: number
  net_rx_max?: number
  net_tx_max?: number
}

export type ResourceChartsProps = {
  node: Node
  metrics: MetricPoint[]
  hours: number
}

// 视图模式定义
type ViewMode = "overview" | "trends" | "heatmap" | "donut"

const AXIS = { stroke: "currentColor", fontSize: 12, tickLine: false, axisLine: false }
const VALUE_AXIS = { ...AXIS, width: 68, interval: 0 }
const SERIES = { dot: false as const, strokeWidth: 1.5, isAnimationActive: false }
const RESOURCE_SERIES = {
  ...SERIES,
  dot: ({ cx, cy, index, points, stroke }: DotItemDotProps) =>
    cy == null || points[index - 1]?.y != null || points[index + 1]?.y != null ? null : (
      <circle cx={cx} cy={cy} r={2} fill={stroke} />
    ),
}

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

type PieTooltipProps = {
  active?: boolean
  payload?: Array<{
    name?: string
    value?: number
    payload?: {
      name: string
      value: number
      color: string
    }
  }>
  total?: number
  unitFormatter?: (val: number) => string
}

/**
 * 环形饼图定制悬浮提示框：
 * 1. 彻底解决文字颜色继承切片偏暗背景色（如 muted）导致不可读的问题，统一使用高对比度 text-foreground。
 * 2. 携带色标指示点与精准百分比，清晰易读。
 */
function CustomPieTooltip({ active, payload, total, unitFormatter = bytes }: PieTooltipProps) {
  if (!active || !payload || !payload.length) return null
  const item = payload[0]
  const val = Number(item.value ?? 0)
  const name = item.name ?? item.payload?.name ?? ""
  const color = item.payload?.color ?? "var(--color-primary)"
  const pct = total && total > 0 ? ((val / total) * 100).toFixed(1) : null

  return (
    <div className="min-w-[130px] rounded-[2px] border border-border/80 bg-card/95 px-3 py-2 text-xs shadow-xl backdrop-blur-xs select-none pointer-events-none z-50 animate-fade-in">
      <div className="flex items-center gap-1.5 font-medium text-foreground">
        <span
          className="size-2 rounded-[0.5px] shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="truncate">{name}</span>
        {pct !== null && (
          <span className="ml-auto font-mono text-[11px] font-normal text-muted-foreground">
            {pct}%
          </span>
        )}
      </div>
      <div className="mt-1 font-mono text-xs font-bold text-foreground">
        {unitFormatter(val)}
      </div>
    </div>
  )
}

export function ResourceCharts({ node, metrics, hours }: ResourceChartsProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("overview")
  const [hoveredHeatCell, setHoveredHeatCell] = useState<{
    label: string
    fullLabel: string
    hasData: boolean
    avgCpu: number
    maxCpu: number
    memUsed: number
    rxRate: number
    txRate: number
  } | null>(null)

  const m = node.metrics

  // 1. 数据行预处理（单位对齐与对数底数处理）
  const metricRows = useMemo(() => {
    const lift = (v: number) => Math.max(v, RATE_FLOOR)
    return metrics.map((p) => ({
      ...p,
      ts: p.ts * 1_000,
      rx: lift(p.net_rx),
      tx: lift(p.net_tx),
      rx_band: [lift(p.net_rx), lift(p.net_rx_max ?? p.net_rx)],
      tx_band: [lift(p.net_tx), lift(p.net_tx_max ?? p.net_tx)],
    }))
  }, [metrics])

  // 断点补齐行
  const chartRows = useMemo(() => withGaps(metricRows), [metricRows])

  // 峰值数据
  const peak = useMemo(() => {
    if (!metrics.some((m) => m.net_rx_max !== undefined)) return null
    const max = (pick: (m: MetricPoint) => number | undefined) =>
      metrics.reduce((hi, m) => Math.max(hi, pick(m) ?? 0), 0)
    return { rx: max((m) => m.net_rx_max), tx: max((m) => m.net_tx_max) }
  }, [metrics])

  // 坐标轴配置
  const axes = useMemo(() => {
    const max = (pick: (m: (typeof metricRows)[number]) => number) =>
      metricRows.reduce((hi, m) => Math.max(hi, pick(m)), 0)
    const cpuMax = max((m) => m.cpu)
    const cpuTop = Math.min(100, Math.max(10, Math.ceil(cpuMax / 10) * 10))
    return {
      cpu: { domain: [0, cpuTop], ticks: quarters(cpuTop) },
      rate: rateAxis(
        metricRows.reduce((lo, m) => Math.min(lo, m.rx, m.tx), Infinity),
        max((m) => Math.max(m.rx_band[1], m.tx_band[1]))
      ),
    }
  }, [metricRows])

  // 2. 统计聚合指标计算（平均与极值）
  const stats = useMemo(() => {
    if (metricRows.length === 0) {
      return {
        avgCpu: m?.cpu ?? 0,
        maxCpu: m?.cpu ?? 0,
        avgMem: m?.mem_used ?? 0,
        maxMem: m?.mem_used ?? 0,
        avgRx: m?.net_rx ?? 0,
        maxRx: m?.net_rx ?? 0,
        avgTx: m?.net_tx ?? 0,
        maxTx: m?.net_tx ?? 0,
      }
    }
    const totalCpu = metricRows.reduce((acc, r) => acc + r.cpu, 0)
    const maxCpu = metricRows.reduce((acc, r) => Math.max(acc, r.cpu), 0)
    const totalMem = metricRows.reduce((acc, r) => acc + r.mem_used, 0)
    const maxMem = metricRows.reduce((acc, r) => Math.max(acc, r.mem_used), 0)
    const totalRx = metricRows.reduce((acc, r) => acc + r.net_rx, 0)
    const maxRx = metricRows.reduce((acc, r) => Math.max(acc, r.net_rx), 0)
    const totalTx = metricRows.reduce((acc, r) => acc + r.net_tx, 0)
    const maxTx = metricRows.reduce((acc, r) => Math.max(acc, r.net_tx), 0)

    return {
      avgCpu: totalCpu / metricRows.length,
      maxCpu,
      avgMem: totalMem / metricRows.length,
      maxMem,
      avgRx: totalRx / metricRows.length,
      maxRx,
      avgTx: totalTx / metricRows.length,
      maxTx,
    }
  }, [metricRows, m])

  // 实际数据时间跨度计算（真实识别历史数据是覆盖全窗还是仅占一部分）
  const dataSpanInfo = useMemo(() => {
    if (metricRows.length === 0) return { actualHours: 0, text: "暂无遥测历史数据" }
    const minTs = metricRows[0].ts
    const maxTs = metricRows[metricRows.length - 1].ts
    const spanMs = Math.max(0, maxTs - minTs)
    const actualHours = Math.max(0.1, spanMs / (3600 * 1000))
    const windowLabel = hours < 24 ? `${hours} 小时` : `${Math.round(hours / 24)} 天`

    if (actualHours < hours * 0.75) {
      const actualLabel =
        actualHours < 1
          ? `${Math.max(1, Math.round(actualHours * 60))} 分钟`
          : actualHours < 24
            ? `${actualHours.toFixed(1)} 小时`
            : `${(actualHours / 24).toFixed(1)} 天`
      return {
        actualHours,
        text: `请求窗口 ${windowLabel} · 实际数据跨度约 ${actualLabel}（共 ${metricRows.length} 采样点）`,
      }
    }
    return {
      actualHours,
      text: `涵盖最近 ${windowLabel} · 共 ${metricRows.length} 采样点`,
    }
  }, [metricRows, hours])

  // 窗口内实际估算产生的网络吞吐流量
  const windowTraffic = useMemo(() => {
    if (metricRows.length < 2) {
      return {
        rx: node.day_rx,
        tx: node.day_tx,
        total: node.day_rx + node.day_tx,
      }
    }
    const durationSec = Math.max(1, (metricRows[metricRows.length - 1].ts - metricRows[0].ts) / 1000)
    const rxBytes = Math.round(stats.avgRx * durationSec)
    const txBytes = Math.round(stats.avgTx * durationSec)
    return {
      rx: rxBytes,
      tx: txBytes,
      total: rxBytes + txBytes,
    }
  }, [metricRows, stats.avgRx, stats.avgTx, node.day_rx, node.day_tx])

  // 3. 内存与存储环形饼图数据
  const ramPieData = useMemo(() => {
    const total = node.mem_total || 1
    const used = m ? m.mem_used : stats.avgMem
    const free = Math.max(0, total - used)
    return [
      { name: "已用内存", value: used, color: "var(--color-primary)" },
      { name: "空闲可用", value: free, color: "var(--color-chart-3)" },
    ]
  }, [node.mem_total, m, stats.avgMem])

  const diskPieData = useMemo(() => {
    const total = node.disk_total || 1
    const used = m ? m.disk_used : (metricRows[metricRows.length - 1]?.disk_used ?? 0)
    const free = Math.max(0, total - used)
    return [
      { name: "已用磁盘", value: used, color: "var(--color-chart-2)" },
      { name: "剩余空间", value: free, color: "var(--color-chart-4)" },
    ]
  }, [node.disk_total, m, metricRows])

  const trafficPieData = useMemo(() => {
    const rx = windowTraffic.rx || 1
    const tx = windowTraffic.tx || 1
    return [
      { name: "下行入网 (RX)", value: rx, color: "var(--color-ok)" },
      { name: "上行出网 (TX)", value: tx, color: "var(--color-chart-1)" },
    ]
  }, [windowTraffic])

  // 4. 活动热力图（根据请求时间跨度自适应为日级或时钟级聚合，空缺时段真实显示无数据，绝不虚构 0% / 0B）
  const heatmapBuckets = useMemo(() => {
    if (metricRows.length === 0) return []

    const now = metricRows[metricRows.length - 1].ts
    let bucketCount = 24
    let isDaily = false

    if (hours === 168) {
      // 7 天模式：7 个天级桶
      bucketCount = 7
      isDaily = true
    } else if (hours >= 720) {
      // 30 天模式（或更长）：30 个天级桶
      bucketCount = Math.min(30, Math.round(hours / 24))
      isDaily = true
    } else {
      // 24 小时或以内：24 个时段桶
      bucketCount = 24
      isDaily = false
    }

    const totalDuration = hours * 3600 * 1000
    const step = totalDuration / bucketCount
    const windowStart = now - totalDuration

    return Array.from({ length: bucketCount }, (_, i) => {
      const bMin = windowStart + i * step
      const bMax = bMin + step
      const items = metricRows.filter((r) => r.ts >= bMin && r.ts < bMax)
      const hasData = items.length > 0
      const count = items.length || 1

      const avgCpu = hasData ? items.reduce((acc, r) => acc + r.cpu, 0) / count : 0
      const maxCpu = hasData ? items.reduce((acc, r) => Math.max(acc, r.cpu), 0) : 0
      const memUsed = hasData ? items.reduce((acc, r) => acc + r.mem_used, 0) / count : 0
      const rxRate = hasData ? items.reduce((acc, r) => acc + r.net_rx, 0) / count : 0
      const txRate = hasData ? items.reduce((acc, r) => acc + r.net_tx, 0) / count : 0

      const dateObj = new Date(bMin)
      const label = isDaily
        ? `${dateObj.getMonth() + 1}/${dateObj.getDate()}`
        : hours === 24
          ? `${String(dateObj.getHours()).padStart(2, "0")}:00`
          : `${String(dateObj.getHours()).padStart(2, "0")}:${String(dateObj.getMinutes()).padStart(2, "0")}`

      const fullLabel = isDaily
        ? `${dateObj.getFullYear()}/${dateObj.getMonth() + 1}/${dateObj.getDate()}`
        : `${dateObj.getMonth() + 1}/${dateObj.getDate()} ${String(dateObj.getHours()).padStart(2, "0")}:${String(dateObj.getMinutes()).padStart(2, "0")}`

      return {
        index: i,
        label,
        fullLabel,
        hasData,
        avgCpu,
        maxCpu,
        memUsed,
        rxRate,
        txRate,
        sampleCount: items.length,
      }
    })
  }, [metricRows, hours])

  const heatmapTitle = useMemo(() => {
    if (hours === 168) return "近 7 天每日负荷活动热力矩阵 (7-Day Daily Activity Matrix)"
    if (hours >= 720) return `近 ${Math.round(hours / 24)} 天每日负荷活动热力矩阵 (${Math.round(hours / 24)}-Day Daily Activity Matrix)`
    return "24 时段时钟负荷活动热力矩阵 (24-Hour Activity Heatmap)"
  }, [hours])

  // 时间轴配置（以请求窗口为基准对齐时间轴，真实呈现数据实际起止与空缺分布，绝不盲目拉伸变形）
  const timeAxis = useMemo(() => {
    const now = metricRows.length > 0 ? metricRows[metricRows.length - 1].ts : Date.now()
    const windowStart = now - hours * 3600 * 1000
    const windowEnd = now
    const ticks = timeTicks(windowStart, windowEnd)

    return {
      dataKey: "ts",
      type: "number" as const,
      domain: [windowStart, windowEnd] as [number, number],
      ticks,
      tickFormatter: tickClock(ticks, hours),
      minTickGap: hours > 24 ? 72 : 40,
      ...AXIS,
    }
  }, [metricRows, hours])

  // 瞬时百分比计算
  const currentCpuPct = m ? m.cpu : stats.avgCpu
  const currentMemPct = m ? percent(m.mem_used, node.mem_total) : percent(stats.avgMem, node.mem_total)
  const currentDiskPct = m
    ? percent(m.disk_used, node.disk_total)
    : percent(metricRows[metricRows.length - 1]?.disk_used ?? 0, node.disk_total)
  const currentTrafficPct =
    node.traffic_limit > 0
      ? percent(node.month_rx + node.month_tx, node.traffic_limit)
      : null

  return (
    <div className="space-y-4">
      {/* 视图模式切换胶囊（移动端垂直分行避免挤压，按钮禁止折行并支持微滚动） */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 pb-2.5">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
          <Activity className="size-3.5 text-primary shrink-0" />
          <span className="font-semibold text-foreground whitespace-nowrap">主机资源分析测控</span>
          <span className="text-xs text-muted-foreground font-medium truncate">
            · {dataSpanInfo.text}
          </span>
        </div>

        {/* 模式选择按钮组（禁止内部文字换行） */}
        <div className="flex items-center gap-1 rounded-[2px] border border-border/60 bg-muted/30 p-0.5 text-xs overflow-x-auto no-scrollbar max-w-full shrink-0">
          <button
            type="button"
            onClick={() => setViewMode("overview")}
            className={cn(
              "flex items-center justify-center gap-1 rounded-[1px] px-2 py-0.5 transition-colors whitespace-nowrap shrink-0",
              viewMode === "overview"
                ? "bg-primary text-primary-foreground font-medium shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Activity className="size-3 shrink-0" />
            <span className="whitespace-nowrap">全景仪表</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode("trends")}
            className={cn(
              "flex items-center justify-center gap-1 rounded-[1px] px-2 py-0.5 transition-colors whitespace-nowrap shrink-0",
              viewMode === "trends"
                ? "bg-primary text-primary-foreground font-medium shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <TrendingUp className="size-3 shrink-0" />
            <span className="whitespace-nowrap">时序曲线</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode("heatmap")}
            className={cn(
              "flex items-center justify-center gap-1 rounded-[1px] px-2 py-0.5 transition-colors whitespace-nowrap shrink-0",
              viewMode === "heatmap"
                ? "bg-primary text-primary-foreground font-medium shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Flame className="size-3 shrink-0" />
            <span className="whitespace-nowrap">负载热力</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode("donut")}
            className={cn(
              "flex items-center justify-center gap-1 rounded-[1px] px-2 py-0.5 transition-colors whitespace-nowrap shrink-0",
              viewMode === "donut"
                ? "bg-primary text-primary-foreground font-medium shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <PieIcon className="size-3 shrink-0" />
            <span className="whitespace-nowrap">占比饼图</span>
          </button>
        </div>
      </div>

      {/* 1. USE 比例图：CPU、内存、硬盘、流量比例工控仪表矩阵 */}
      {(viewMode === "overview" || viewMode === "donut") && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* CPU 综合使用率 */}
          <div className="rounded-[2px] border border-border/70 bg-card/70 p-3 shadow-2xs backdrop-blur-xs">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <Cpu className="size-3.5 text-primary" />
                <span>CPU 核心负荷</span>
              </span>
              <span className="font-mono text-xs font-semibold text-foreground">
                {currentCpuPct.toFixed(1)}%
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-[1px] bg-muted/80">
              <div
                className={cn(
                  "h-full transition-all duration-300",
                  currentCpuPct > 80
                    ? "bg-destructive"
                    : currentCpuPct > 60
                      ? "bg-warn"
                      : "bg-primary"
                )}
                style={{ width: `${Math.min(100, Math.max(0, currentCpuPct))}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs font-mono font-medium text-muted-foreground">
              <span>窗口均值 {stats.avgCpu.toFixed(1)}%</span>
              <span>窗口峰值 {stats.maxCpu.toFixed(1)}%</span>
            </div>
          </div>

          {/* 内存空间使用率 */}
          <div className="rounded-[2px] border border-border/70 bg-card/70 p-3 shadow-2xs backdrop-blur-xs">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <Layers className="size-3.5 text-primary" />
                <span>物理内存占用</span>
              </span>
              <span className="font-mono text-xs font-semibold text-foreground">
                {currentMemPct.toFixed(1)}%
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-[1px] bg-muted/80">
              <div
                className="h-full bg-foreground transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(0, currentMemPct))}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs font-mono font-medium text-muted-foreground">
              <span>实时 {bytes(m ? m.mem_used : stats.avgMem)}</span>
              <span>均值 {bytes(stats.avgMem)}</span>
            </div>
          </div>

          {/* 存储空间占用率 */}
          <div className="rounded-[2px] border border-border/70 bg-card/70 p-3 shadow-2xs backdrop-blur-xs">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <HardDrive className="size-3.5 text-primary" />
                <span>系统存储占用</span>
              </span>
              <span className="font-mono text-xs font-semibold text-foreground">
                {currentDiskPct.toFixed(1)}%
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-[1px] bg-muted/80">
              <div
                className={cn(
                  "h-full transition-all duration-300",
                  currentDiskPct > 90 ? "bg-destructive" : "bg-foreground"
                )}
                style={{ width: `${Math.min(100, Math.max(0, currentDiskPct))}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs font-mono font-medium text-muted-foreground">
              <span>已用 {bytes(m ? m.disk_used : 0)}</span>
              <span>总量 {bytes(node.disk_total)}</span>
            </div>
          </div>

          {/* 网络出入吞吐 / 流量配额消耗 */}
          <div className="rounded-[2px] border border-border/70 bg-card/70 p-3 shadow-2xs backdrop-blur-xs">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <Activity className="size-3.5 text-primary" />
                <span>网络带宽吞吐</span>
              </span>
              <span className="font-mono text-xs font-semibold text-foreground">
                {currentTrafficPct !== null ? `月配额 ${currentTrafficPct.toFixed(1)}%` : `峰值 ${rate(Math.max(stats.maxRx, stats.maxTx))}`}
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-[1px] bg-muted/80">
              <div
                className="h-full bg-ok transition-all duration-300"
                style={{
                  width: `${currentTrafficPct !== null ? Math.min(100, currentTrafficPct) : 100}%`,
                }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs font-mono font-medium text-muted-foreground">
              <span>均值 ↓ {rate(stats.avgRx)}</span>
              <span>均值 ↑ {rate(stats.avgTx)}</span>
            </div>
          </div>
        </div>
      )}

      {/* 2. 环形饼图分布模块：内存分布、磁盘分布、网络流量占比 */}
      {(viewMode === "overview" || viewMode === "donut") && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {/* 内存环形饼图 */}
          <div className="relative overflow-visible flex flex-col rounded-[2px] border border-border/70 bg-card/60 p-3 shadow-2xs hover:z-30 transition-all">
            <div className="border-b border-border/40 pb-1.5 text-xs font-medium text-foreground">
              物理内存分布比例
            </div>
            <div className="relative mt-2 flex h-36 items-center justify-center overflow-visible">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                  <Tooltip
                    content={<CustomPieTooltip total={node.mem_total} />}
                    allowEscapeViewBox={{ x: true, y: true }}
                    isAnimationActive={false}
                    wrapperStyle={{ zIndex: 1000, pointerEvents: "none" }}
                  />
                  <Pie
                    data={ramPieData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={38}
                    outerRadius={54}
                    stroke="var(--color-card)"
                    strokeWidth={2}
                    isAnimationActive={true}
                    animationDuration={350}
                    animationEasing="ease-out"
                  >
                    {ramPieData.map((entry, index) => (
                      <Cell key={`ram-cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 z-0 flex flex-col items-center justify-center text-center">
                <span className="font-mono text-sm font-bold text-foreground">
                  {currentMemPct.toFixed(0)}%
                </span>
                <span className="text-xs text-muted-foreground font-medium">已用占比</span>
              </div>
            </div>
            <div className="mt-1 flex items-center justify-around border-t border-border/30 pt-2 text-xs font-mono font-medium">
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-[0.5px]" style={{ backgroundColor: ramPieData[0].color }} />
                <span className="text-muted-foreground">已用:</span>
                <span className="font-semibold text-foreground">{bytes(ramPieData[0].value)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-[0.5px]" style={{ backgroundColor: ramPieData[1].color }} />
                <span className="text-muted-foreground">可用:</span>
                <span className="font-semibold text-foreground">{bytes(ramPieData[1].value)}</span>
              </div>
            </div>
          </div>

          {/* 磁盘环形饼图 */}
          <div className="relative overflow-visible flex flex-col rounded-[2px] border border-border/70 bg-card/60 p-3 shadow-2xs hover:z-30 transition-all">
            <div className="border-b border-border/40 pb-1.5 text-xs font-medium text-foreground">
              存储空间分布比例
            </div>
            <div className="relative mt-2 flex h-36 items-center justify-center overflow-visible">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                  <Tooltip
                    content={<CustomPieTooltip total={node.disk_total} />}
                    allowEscapeViewBox={{ x: true, y: true }}
                    isAnimationActive={false}
                    wrapperStyle={{ zIndex: 1000, pointerEvents: "none" }}
                  />
                  <Pie
                    data={diskPieData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={38}
                    outerRadius={54}
                    stroke="var(--color-card)"
                    strokeWidth={2}
                    isAnimationActive={true}
                    animationDuration={350}
                    animationEasing="ease-out"
                  >
                    {diskPieData.map((entry, index) => (
                      <Cell key={`disk-cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 z-0 flex flex-col items-center justify-center text-center">
                <span className="font-mono text-sm font-bold text-foreground">
                  {currentDiskPct.toFixed(0)}%
                </span>
                <span className="text-xs text-muted-foreground font-medium">占用比例</span>
              </div>
            </div>
            <div className="mt-1 flex items-center justify-around border-t border-border/30 pt-2 text-xs font-mono font-medium">
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-[0.5px]" style={{ backgroundColor: diskPieData[0].color }} />
                <span className="text-muted-foreground">已用:</span>
                <span className="font-semibold text-foreground">{bytes(diskPieData[0].value)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-[0.5px]" style={{ backgroundColor: diskPieData[1].color }} />
                <span className="text-muted-foreground">剩余:</span>
                <span className="font-semibold text-foreground">{bytes(diskPieData[1].value)}</span>
              </div>
            </div>
          </div>

          {/* 流量上下行比例饼图 */}
          <div className="relative overflow-visible flex flex-col rounded-[2px] border border-border/70 bg-card/60 p-3 shadow-2xs sm:col-span-2 lg:col-span-1 hover:z-30 transition-all">
            <div className="border-b border-border/40 pb-1.5 text-xs font-medium text-foreground">
              {hours <= 24 ? "今日/窗口流量构成" : `近 ${hours < 720 ? `${Math.round(hours / 24)} 天` : "30 天"}流量构成`}
            </div>
            <div className="relative mt-2 flex h-36 items-center justify-center overflow-visible">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                  <Tooltip
                    content={<CustomPieTooltip total={trafficPieData[0].value + trafficPieData[1].value} />}
                    allowEscapeViewBox={{ x: true, y: true }}
                    isAnimationActive={false}
                    wrapperStyle={{ zIndex: 1000, pointerEvents: "none" }}
                  />
                  <Pie
                    data={trafficPieData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={38}
                    outerRadius={54}
                    stroke="var(--color-card)"
                    strokeWidth={2}
                    isAnimationActive={true}
                    animationDuration={350}
                    animationEasing="ease-out"
                  >
                    {trafficPieData.map((entry, index) => (
                      <Cell key={`trf-cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 z-0 flex flex-col items-center justify-center text-center">
                <span className="font-mono text-xs font-bold text-foreground">
                  {trafficPieData[1].value >= trafficPieData[0].value ? "↑ 出网" : "↓ 入网"}
                </span>
                <span className="text-xs text-muted-foreground font-medium">流量主导</span>
              </div>
            </div>
            <div className="mt-1 flex items-center justify-around border-t border-border/30 pt-2 text-xs font-mono font-medium">
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-[0.5px]" style={{ backgroundColor: trafficPieData[0].color }} />
                <span className="text-muted-foreground">下行:</span>
                <span className="font-semibold text-foreground">{bytes(trafficPieData[0].value)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-[0.5px]" style={{ backgroundColor: trafficPieData[1].color }} />
                <span className="text-muted-foreground">上行:</span>
                <span className="font-semibold text-foreground">{bytes(trafficPieData[1].value)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. 负载时段活动热力图 (Heatmap) */}
      {(viewMode === "overview" || viewMode === "heatmap") && (
        <div className="rounded-[2px] border border-border/70 bg-card/60 p-3.5 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Flame className="size-3.5 text-warn" />
              <span>{heatmapTitle}</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
              <span>低负荷 (0%)</span>
              <div className="flex items-center gap-0.5">
                <span className="size-2.5 rounded-[1px] bg-muted/60" />
                <span className="size-2.5 rounded-[1px] bg-emerald-500/30" />
                <span className="size-2.5 rounded-[1px] bg-sky-500/40" />
                <span className="size-2.5 rounded-[1px] bg-amber-500/50" />
                <span className="size-2.5 rounded-[1px] bg-rose-500/70" />
              </div>
              <span>过载 (100%)</span>
            </div>
          </div>

          {/* 热力格子矩阵 */}
          <div
            className={cn(
              "mt-3 grid gap-1",
              heatmapBuckets.length === 7
                ? "grid-cols-7"
                : heatmapBuckets.length === 30
                  ? "grid-cols-6 sm:grid-cols-10 md:grid-cols-15 lg:grid-cols-30"
                  : "grid-cols-6 sm:grid-cols-12 md:grid-cols-24"
            )}
          >
            {heatmapBuckets.map((bucket) => {
              const cpu = bucket.avgCpu
              let bgStyle = "bg-muted/20 border-dashed border-border/40 text-muted-foreground/60 cursor-default"
              if (bucket.hasData) {
                if (cpu > 80) bgStyle = "bg-rose-500/75 border-rose-500 text-white font-bold"
                else if (cpu > 60) bgStyle = "bg-amber-500/60 border-amber-500/80 text-foreground font-semibold"
                else if (cpu > 35) bgStyle = "bg-sky-500/45 border-sky-500/60 text-foreground font-medium"
                else if (cpu > 15) bgStyle = "bg-emerald-500/35 border-emerald-500/50 text-foreground"
                else bgStyle = "bg-muted/60 border-border/50 text-foreground/80 font-medium"
              }

              return (
                <div
                  key={`heat-${bucket.index}`}
                  className={cn(
                    "flex flex-col items-center justify-center rounded-[1px] border py-1.5 px-0.5 text-center transition-all hover:ring-1 hover:ring-primary hover:brightness-110 active:scale-[0.98]",
                    bgStyle
                  )}
                  onMouseEnter={() => setHoveredHeatCell(bucket)}
                  onMouseLeave={() => setHoveredHeatCell(null)}
                >
                  <span className="text-[10px] font-mono leading-tight opacity-90">{bucket.label}</span>
                  <span className="text-xs font-mono font-bold leading-tight mt-0.5">
                    {!bucket.hasData ? "—" : cpu < 1 ? "<1%" : `${cpu.toFixed(0)}%`}
                  </span>
                </div>
              )
            })}
          </div>

          {/* 悬停单元格详情提示条（预备好恒定高度容器，彻底根治悬浮信息切换时的元素抖动与高度跳跃） */}
          <div className="mt-2.5 min-h-[38px] flex items-center justify-between rounded-[1px] border border-border/60 bg-muted/30 px-3 py-1.5 text-xs font-mono transition-colors">
            {hoveredHeatCell ? (
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 w-full text-foreground animate-fade-in">
                <span className="font-semibold text-primary">
                  {hoveredHeatCell.fullLabel}
                </span>
                {hoveredHeatCell.hasData ? (
                  <>
                    <span>平均 CPU：<strong className="font-semibold text-foreground">{hoveredHeatCell.avgCpu.toFixed(1)}%</strong></span>
                    <span>CPU 峰值：<strong className="font-semibold text-foreground">{hoveredHeatCell.maxCpu.toFixed(1)}%</strong></span>
                    <span>内存：<strong className="font-semibold text-foreground">{bytes(hoveredHeatCell.memUsed)}</strong></span>
                    <span>
                      速率：↓ {rate(hoveredHeatCell.rxRate)} · ↑ {rate(hoveredHeatCell.txRate)}
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground font-medium">该时间段暂无上报的遥测采样数据（节点可能未注册或处于停机状态）</span>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center w-full gap-2 text-muted-foreground font-medium">
                <Activity className="size-3.5 opacity-60" />
                <span>鼠标悬停上方任意时段热力方块，即时查看对应时段 CPU 峰值、内存使用与流量详情</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. 时序曲线走势图（CPU、内存、网络对数速率、硬盘） */}
      {(viewMode === "overview" || viewMode === "trends") && (
        <div className="space-y-4 pt-1">
          {/* CPU 曲线 */}
          <div className="rounded-[2px] border border-border/70 bg-card/60 p-3 shadow-2xs">
            <div className="flex items-center justify-between border-b border-border/40 pb-2 text-xs font-semibold text-foreground">
              <span className="flex items-center gap-1.5">
                <Cpu className="size-3.5 text-primary" />
                <span>CPU 核心使用率走势</span>
              </span>
              <span className="font-mono text-xs font-normal text-muted-foreground">
                当前: {currentCpuPct.toFixed(1)}% · 均值: {stats.avgCpu.toFixed(1)}% · 峰值: {stats.maxCpu.toFixed(1)}%
              </span>
            </div>
            <div className="mt-2 h-40 w-full text-muted-foreground">
              <ResponsiveContainer>
                <AreaChart data={chartRows}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis {...timeAxis} />
                  <YAxis {...axes.cpu} unit="%" {...VALUE_AXIS} />
                  <Tooltip {...TOOLTIP_STYLE} formatter={(v) => [`${Number(v).toFixed(1)}%`, "CPU 负荷"]} />
                  <Area
                    dataKey="cpu"
                    stroke="var(--color-primary)"
                    fill="var(--color-primary)"
                    fillOpacity={0.16}
                    {...RESOURCE_SERIES}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 内存走势曲线 */}
          <div className="rounded-[2px] border border-border/70 bg-card/60 p-3 shadow-2xs">
            <div className="flex items-center justify-between border-b border-border/40 pb-2 text-xs font-semibold text-foreground">
              <span className="flex items-center gap-1.5">
                <Layers className="size-3.5 text-primary" />
                <span>物理内存使用趋势（上限 {bytes(node.mem_total)}）</span>
              </span>
              <span className="font-mono text-xs font-normal text-muted-foreground">
                当前: {bytes(m ? m.mem_used : stats.avgMem)} ({currentMemPct.toFixed(1)}%)
              </span>
            </div>
            <div className="mt-2 h-40 w-full text-muted-foreground">
              <ResponsiveContainer>
                <AreaChart data={chartRows}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis {...timeAxis} />
                  <YAxis
                    domain={[0, node.mem_total]}
                    ticks={quarters(node.mem_total)}
                    tickFormatter={axisBytes}
                    {...VALUE_AXIS}
                  />
                  <Tooltip {...TOOLTIP_STYLE} formatter={(v) => bytes(Number(v))} />
                  <Area
                    dataKey="mem_used"
                    name="物理内存"
                    stroke="var(--color-chart-2)"
                    fill="var(--color-chart-2)"
                    fillOpacity={0.16}
                    {...RESOURCE_SERIES}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 网络速率对数走势 */}
          <div className="rounded-[2px] border border-border/70 bg-card/60 p-3 shadow-2xs">
            <div className="flex items-center justify-between border-b border-border/40 pb-2 text-xs font-semibold text-foreground">
              <span className="flex items-center gap-1.5">
                <Activity className="size-3.5 text-primary" />
                <span>网络传输速率（对数刻度 · 含峰值带）</span>
              </span>
              <span className="font-mono text-xs font-normal text-muted-foreground">
                {peak ? `峰值: ↓ ${rate(peak.rx)} · ↑ ${rate(peak.tx)}` : `均值: ↓ ${rate(stats.avgRx)} · ↑ ${rate(stats.avgTx)}`}
              </span>
            </div>
            <div className="mt-2 h-40 w-full text-muted-foreground">
              <ResponsiveContainer>
                <ComposedChart data={chartRows}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis {...timeAxis} />
                  <YAxis scale="log" {...axes.rate} tickFormatter={axisBytes} unit="/s" {...VALUE_AXIS} />
                  <Tooltip
                    {...TOOLTIP_STYLE}
                    formatter={(_, name, item) => {
                      const mean = item?.payload?.[`net_${item.dataKey}`]
                      const top = item?.payload?.[`net_${item.dataKey}_max`]
                      return [top === undefined ? rate(mean) : `均值 ${rate(mean)} · 峰值 ${rate(top)}`, name]
                    }}
                  />
                  {[
                    { key: "rx", stroke: "var(--color-ok)" },
                    { key: "tx", stroke: "var(--color-chart-1)" },
                  ].map((s) => (
                    <Area
                      key={s.key}
                      dataKey={`${s.key}_band`}
                      stroke={s.stroke}
                      strokeWidth={1}
                      strokeDasharray="2 2"
                      fill={s.stroke}
                      fillOpacity={0.16}
                      isAnimationActive={false}
                      tooltipType="none"
                      legendType="none"
                    />
                  ))}
                  <Line dataKey="rx" name="下行入站" stroke="var(--color-ok)" {...RESOURCE_SERIES} />
                  <Line dataKey="tx" name="上行出站" stroke="var(--color-chart-1)" {...RESOURCE_SERIES} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 硬盘空间走势 */}
          <div className="rounded-[2px] border border-border/70 bg-card/60 p-3 shadow-2xs">
            <div className="flex items-center justify-between border-b border-border/40 pb-2 text-xs font-semibold text-foreground">
              <span className="flex items-center gap-1.5">
                <HardDrive className="size-3.5 text-primary" />
                <span>系统磁盘容量（上限 {bytes(node.disk_total)}）</span>
              </span>
              <span className="font-mono text-xs font-normal text-muted-foreground">
                当前已用: {bytes(m ? m.disk_used : 0)} ({currentDiskPct.toFixed(1)}%)
              </span>
            </div>
            <div className="mt-2 h-40 w-full text-muted-foreground">
              <ResponsiveContainer>
                <AreaChart data={chartRows}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis {...timeAxis} />
                  <YAxis
                    domain={[0, node.disk_total]}
                    ticks={quarters(node.disk_total)}
                    tickFormatter={axisBytes}
                    {...VALUE_AXIS}
                  />
                  <Tooltip {...TOOLTIP_STYLE} formatter={(v) => bytes(Number(v))} />
                  <Area
                    dataKey="disk_used"
                    name="磁盘存储"
                    stroke="var(--color-chart-2)"
                    fill="var(--color-chart-2)"
                    fillOpacity={0.16}
                    {...RESOURCE_SERIES}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
