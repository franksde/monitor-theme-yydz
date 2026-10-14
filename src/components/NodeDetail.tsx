/**
 * 节点全景详情与深度测控组件 (Node Detail & Telemetry Center)
 * 集成：
 * 1. 顶部工控硬件与系统规格总览 (NodeSpecs)
 * 2. 深度系统资源监控 (ResourceCharts: Use 比例度量条 / 环形饼图 / 24 时段热力图 / 时序曲线走势)
 * 3. 网络延迟拓扑多维测控驾驶舱 (LatencyDashboard: 线路质量卡片矩阵 / 聚合对比 / 分轨矩阵 / 阶梯排行)
 * 遵循 AGENT.md 规范：采用微倒角 (2px)、全中文注释、工业仪器极简美学、零多余外部依赖。
 */

import { useEffect, useMemo, useState } from "react"

import { DetailChartSkeleton } from "@/components/NodeDetailSkeleton"
import { api, type Node } from "@/lib/api"
import { windows } from "@/lib/format"
import { NodeSpecs } from "@/components/NodeSpecs"
import { ResourceCharts, type MetricPoint } from "@/components/ResourceCharts"
import { LatencyDashboard, type PingSample, type ProbeSeries } from "@/components/LatencyDashboard"

/** 探测点名称映射字典 */
type Probes = Record<string, string>

/** 探测丢包率统计 */
type Loss = Record<string, number>

const TABS = [
  { key: "resources", label: "资源" },
  { key: "latency", label: "网络延迟" },
] as const

/**
 * 时间窗口切换按钮
 * 遵循 AGENT.md 规范：采用微倒角 rounded-[2px]，具有柔和的交互动效
 */
function Tab({
  active,
  onClick,
  narrow = false,
  children,
}: {
  active: boolean
  onClick: () => void
  narrow?: boolean
  children: string
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-[2px] py-1 text-xs font-medium transition-all duration-150 ${
        narrow ? "px-1.5 sm:px-2.5" : "px-2.5"
      } ${
        active
          ? "bg-primary text-primary-foreground shadow-2xs font-semibold"
          : "text-muted-foreground hover:bg-muted/70 hover:text-foreground active:scale-[0.98]"
      }`}
    >
      {children}
    </button>
  )
}

export function NodeDetail({ node, historyDays }: { node: Node; historyDays: number }) {
  const ranges = useMemo(() => windows(historyDays), [historyDays])
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("resources")
  const [picked, setPicked] = useState<{ resources: number; latency: number }>({
    resources: 6,
    latency: 6,
  })
  const hours = picked[tab]
  const [smooth, setSmooth] = useState(false)
  const [data, setData] = useState<{
    metrics: MetricPoint[]
    ping: PingSample[]
    probes: Probes
    loss?: Loss
    step?: number
  } | null>(null)
  const [failed, setFailed] = useState("")
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    // oxlint-disable-next-line react/set-state-in-effect
    setData(null)
    // oxlint-disable-next-line react/set-state-in-effect
    setFailed("")

    const points = Math.round(globalThis.innerWidth * (globalThis.devicePixelRatio || 1))
    const series = tab === "latency" ? "ping" : "metrics"

    api<{ metrics: MetricPoint[]; ping: PingSample[]; probes: Probes; loss?: Loss; step?: number }>(
      `/nodes/${node.id}/metrics?hours=${hours}&points=${points}&series=${series}`,
    )
      .then((next) => {
        if (active) setData(next)
      })
      .catch((e: Error) => {
        if (active) {
          setFailed(e.message)
          setData({ metrics: [], ping: [], probes: {} })
        }
      })

    return () => {
      active = false
    }
  }, [node.id, hours, tab, attempt])

  // 处理延迟探测线路集合
  const pingSeries: ProbeSeries[] = useMemo(() => {
    return [...new Set((data?.ping ?? []).map((p) => p.task_id))]
      .map((id) => {
        const points = (data?.ping ?? []).filter((p) => p.task_id === id)
        const loss = data?.loss?.[id] ?? 0
        return {
          id,
          name: data?.probes?.[id] ?? `探测线路 #${id}`,
          points,
          loss,
        }
      })
      .filter((s) => s.points.length > 0)
  }, [data])

  return (
    <div className="animate-fade-in space-y-4">
      {/* 1. 顶部工控硬件与系统规格总览 */}
      <NodeSpecs node={node} />

      {/* 2. 详情监控主视图控制栏（资源/延迟切换与时间范围选择，移动端响应式防换行） */}
      <div className="space-y-2.5 border-t border-border/70 pt-3.5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {/* 标签页选择器 */}
          <div className="flex items-center gap-1 rounded-[2px] border border-border/70 bg-muted/40 p-0.5 shrink-0 self-start">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                aria-pressed={tab === t.key}
                onClick={() => setTab(t.key)}
                className={`rounded-[1px] px-3 py-1 text-xs font-medium transition-all duration-150 whitespace-nowrap shrink-0 ${
                  tab === t.key
                    ? "bg-primary text-primary-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* 时间跨度窗口选择器（支持平滑滚动，禁止折行） */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar max-w-full shrink-0">
            {ranges.map((r) => (
              <Tab
                key={r.hours}
                narrow
                active={hours === r.hours}
                onClick={() => setPicked((all) => ({ ...all, [tab]: r.hours }))}
              >
                {r.label}
              </Tab>
            ))}
          </div>
        </div>
      </div>

      {/* 3. 遥测核心展示区（内部已在热力矩阵上方内嵌服务可用性 SLA） */}
      {!data ? (
        <DetailChartSkeleton tab={tab} hours={hours} />
      ) : failed ? (
        <div
          className="rounded-[2px] border border-destructive/30 bg-destructive/5 py-8 text-center text-sm text-destructive"
          role="alert"
        >
          读取历史遥测数据失败：{failed}
          <button
            type="button"
            className="ml-2 font-medium underline underline-offset-4 hover:opacity-80"
            onClick={() => setAttempt((n) => n + 1)}
          >
            重试
          </button>
        </div>
      ) : tab === "latency" ? (
        pingSeries.length === 0 ? (
          <div className="rounded-[2px] border border-border/60 bg-muted/20 py-12 text-center text-sm text-muted-foreground">
            当前时间窗口内没有可用网络延迟探测数据
          </div>
        ) : (
          <LatencyDashboard
            pingSeries={pingSeries}
            hours={hours}
            smooth={smooth}
            onToggleSmooth={setSmooth}
          />
        )
      ) : data.metrics.length === 0 ? (
        <div className="rounded-[2px] border border-border/60 bg-muted/20 py-12 text-center text-sm text-muted-foreground">
          当前时间窗口内没有可用系统资源遥测数据
        </div>
      ) : (
        <ResourceCharts
          node={node}
          metrics={data.metrics}
          step={data.step}
          hours={hours}
        />
      )}
    </div>
  )
}
