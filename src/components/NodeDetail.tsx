import { Activity, useEffect, useMemo, useRef, useState } from "react"
import { DetailChartSkeleton } from "@/components/NodeDetailSkeleton"
import { api, type Node } from "@/lib/api"
import { windows } from "@/lib/format"
import { NodeSpecs } from "@/components/NodeSpecs"
import { LiveTelemetryBoard } from "@/components/LiveTelemetryBoard"
import { ResourceCharts, type MetricPoint } from "@/components/ResourceCharts"
import { LatencyDashboard, type PingSample, type ProbeSeries } from "@/components/LatencyDashboard"

type History = {
  metrics: MetricPoint[]
  ping: PingSample[]
  probes: Record<string, string>
  loss?: Record<string, number>
  step?: number
}
type Snapshot = History & { hours: number; nowTs: number }

/** 保留已加载内容及其分析状态；窗口请求成功后原位替换，失败保留旧快照并显式说明。 */
function useHistory(node: Node, hours: number, series: "metrics" | "ping", enabled: boolean) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [attempt, setAttempt] = useState(0)
  const lastSuccess = useRef({ hours: 0, at: 0, attempt: -1 })
  const currentNode = useRef(node)
  useEffect(() => {
    currentNode.current = node
  }, [node])
  useEffect(() => {
    if (!enabled) return
    let active = true
    let sequence = 0
    let pending: number | null = null
    const load = async (force = false) => {
      // 分类切回时复用一分钟内的同窗口快照；显式刷新及回到前台仍立即读取。
      const cached = lastSuccess.current
      if (
        !force &&
        cached.hours === hours &&
        cached.attempt === attempt &&
        Date.now() - cached.at < 60_000
      ) {
        setLoading(false)
        return
      }
      if (pending !== null || document.visibilityState !== "visible") return
      const request = ++sequence
      pending = request
      setLoading(true)
      setError("")
      const current = currentNode.current
      // 优先使用服务端的相对心跳校正客户端时钟；窗口固定在发起请求时刻。
      const nowTs =
        current.last_seen > 0 && current.last_seen_ago != null
          ? current.last_seen + current.last_seen_ago
          : Math.floor(Date.now() / 1000)
      try {
        const points = Math.min(1440, Math.max(300, Math.round(globalThis.innerWidth)))
        const next = await api<History>(
          `/nodes/${current.id}/metrics?hours=${hours}&points=${points}&series=${series}`,
        )
        if (
          !Array.isArray(next.metrics) ||
          !Array.isArray(next.ping) ||
          !Number.isFinite(next.step) ||
          Number(next.step) <= 0
        )
          throw new Error("历史接口返回的数据结构或采样步长无效")
        // 结构异常保留旧快照并显示带节点上下文的错误，避免坏字段进入图表后白屏。
        const validRate = (value: unknown) =>
          typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100
        if (
          next.ping.some(
            (point) =>
              !point ||
              !Number.isFinite(point.task_id) ||
              !Number.isFinite(point.ts) ||
              (point.latency !== null &&
                (typeof point.latency !== "number" ||
                  !Number.isFinite(point.latency) ||
                  point.latency < 0)) ||
              (point.loss !== undefined && !validRate(point.loss)) ||
              (point.band !== undefined &&
                (!Array.isArray(point.band) ||
                  point.band.length !== 2 ||
                  !point.band.every(
                    (value) => typeof value === "number" && Number.isFinite(value) && value >= 0,
                  ) ||
                  point.band[0] > point.band[1])),
          ) ||
          (next.probes !== undefined &&
            (!next.probes ||
              typeof next.probes !== "object" ||
              Array.isArray(next.probes) ||
              !Object.values(next.probes).every((value) => typeof value === "string"))) ||
          (next.loss !== undefined &&
            (!next.loss ||
              typeof next.loss !== "object" ||
              Array.isArray(next.loss) ||
              !Object.values(next.loss).every(validRate)))
        )
          throw new Error("历史接口返回的探测记录、线路名称或失败率格式无效")
        if (active && pending === request) {
          lastSuccess.current = { hours, at: Date.now(), attempt }
          setSnapshot({ ...next, hours, nowTs })
        }
      } catch (error) {
        if (active && pending === request)
          setError(
            `节点 #${current.id} · ${hours} 小时 · ${series === "ping" ? "网络延迟" : "系统资源"}：${error instanceof Error ? error.message : String(error)}`,
          )
      } finally {
        if (pending === request) {
          pending = null
          if (active) setLoading(false)
        }
      }
    }
    void load()
    const onVisible = () => {
      if (document.visibilityState === "visible") void load(true)
      else {
        // 挂起前的响应不回写；回到前台允许立即建立新请求。
        pending = null
        setLoading(false)
      }
    }
    document.addEventListener("visibilitychange", onVisible)
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load()
    }, 60_000)
    return () => {
      active = false
      clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [node.id, hours, series, enabled, attempt])
  return { snapshot, loading, error, retry: () => setAttempt((n) => n + 1) }
}

export function NodeDetail({ node, historyDays }: { node: Node; historyDays: number }) {
  const ranges = useMemo(() => windows(historyDays), [historyDays])
  const [tab, setTab] = useState<"resources" | "latency">("resources")
  const [picked, setPicked] = useState({ resources: 6, latency: 6 })
  const [smooth, setSmooth] = useState(false)
  const resourceHours = ranges.some((r) => r.hours === picked.resources)
    ? picked.resources
    : ranges[0].hours
  const latencyHours = ranges.some((r) => r.hours === picked.latency)
    ? picked.latency
    : ranges[0].hours
  const resource = useHistory(node, resourceHours, "metrics", tab === "resources")
  const latency = useHistory(node, latencyHours, "ping", tab === "latency")
  const selected = tab === "resources" ? resource : latency
  const hours = tab === "resources" ? resourceHours : latencyHours
  const pingSeries = useMemo<ProbeSeries[]>(() => {
    const snapshot = latency.snapshot
    if (!snapshot) return []
    const ids = new Set([
      ...snapshot.ping.map((p) => p.task_id),
      ...Object.keys(snapshot.probes ?? {}).map(Number),
    ])
    return [...ids].map((id) => ({
      id,
      name: snapshot.probes?.[id] ?? `探测线路 #${id}`,
      points: [
        ...new Map(
          snapshot.ping
            .filter(
              (p) =>
                p.task_id === id &&
                Number.isFinite(p.ts) &&
                p.ts >= snapshot.nowTs - snapshot.hours * 3600 &&
                p.ts <= snapshot.nowTs,
            )
            .map((p) => [p.ts, p]),
        ).values(),
      ].sort((a, b) => a.ts - b.ts),
      // 服务端省略零失败率；有记录且 loss 对象有效时才回退零，无记录仍为未知。
      loss:
        snapshot.loss && snapshot.ping.some((p) => p.task_id === id)
          ? (snapshot.loss[id] ?? 0)
          : null,
    }))
  }, [latency.snapshot])

  return (
    <div className="animate-fade-in space-y-4">
      <NodeSpecs node={node} />
      <LiveTelemetryBoard node={node} />
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-3">
        <div className="flex gap-1 rounded-[2px] border border-border/70 bg-muted/30 p-0.5">
          {[
            { key: "resources", label: "资源" },
            { key: "latency", label: "网络延迟" },
          ].map((item) => (
            <button
              type="button"
              key={item.key}
              aria-pressed={tab === item.key}
              onClick={() => setTab(item.key as typeof tab)}
              className={`rounded-[1px] px-3 py-1 text-xs transition-colors ${tab === item.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex max-w-full gap-1 overflow-x-auto">
          {ranges.map((range) => (
            <button
              type="button"
              key={range.hours}
              aria-pressed={hours === range.hours}
              onClick={() => setPicked((all) => ({ ...all, [tab]: range.hours }))}
              className={`shrink-0 rounded-[1px] px-2 py-1 text-xs transition-colors ${hours === range.hours ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>
      <div
        className="flex min-h-5 flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground"
        role="status"
      >
        <span>
          {selected.loading
            ? selected.snapshot
              ? "正在更新，当前保留上次成功的数据与统计窗口…"
              : "正在读取历史数据…"
            : "历史数据每 60 秒刷新，统计窗口随成功请求更新"}
        </span>
        <button
          type="button"
          disabled={selected.loading}
          onClick={selected.retry}
          className="transition-colors hover:text-foreground disabled:opacity-40"
        >
          立即刷新
        </button>
      </div>
      {selected.error && (
        <div
          role="alert"
          className="rounded-[2px] border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive"
        >
          读取历史数据失败：{selected.error}
          {selected.snapshot && "。下方保留上次成功的快照。"}
          <button type="button" onClick={selected.retry} className="ml-2 underline">
            重试
          </button>
        </div>
      )}
      {!selected.snapshot && !selected.error && <DetailChartSkeleton tab={tab} hours={hours} />}
      {/* Activity 保留分析状态并暂停隐藏图表的副作用，避免不可见图表反复测量零尺寸。 */}
      <Activity mode={tab === "resources" ? "visible" : "hidden"}>
        {resource.snapshot && (
          <div className={tab === "resources" ? "animate-fade-in" : ""}>
            <ResourceCharts
              node={node}
              metrics={resource.snapshot.metrics}
              step={resource.snapshot.step}
              hours={resource.snapshot.hours}
              nowTs={resource.snapshot.nowTs}
            />
          </div>
        )}
      </Activity>
      <Activity mode={tab === "latency" ? "visible" : "hidden"}>
        {latency.snapshot && (
          <div className={tab === "latency" ? "animate-fade-in" : ""}>
            <LatencyDashboard
              pingSeries={pingSeries}
              hours={latency.snapshot.hours}
              nowTs={latency.snapshot.nowTs}
              step={latency.snapshot.step}
              smooth={smooth}
              onToggleSmooth={setSmooth}
            />
          </div>
        )}
      </Activity>
    </div>
  )
}
