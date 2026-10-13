/**
 * 首页监控卡片网络延迟测试展示组件 (Node Card Latency Panel)
 * 包含：各线路实时延迟数值、一小时波动趋势火花线 (Sparkline)、丢包率指示、工控微倒角质感。
 * 遵循 AGENT.md 规范：采用中文注释、微倒角 rounded-[2px]、全等宽工控排版、零冗余外部依赖。
 */

import { useMemo } from "react"
import type { Node } from "@/lib/api"
import {
  evaluateLatency,
  pickPingRows,
  useNodeLatency,
  type ProbeLine,
} from "@/lib/latency"
import { cn } from "@/lib/utils"

const SPARK_WIDTH = 80
const SPARK_HEIGHT = 16

/**
 * 微型延迟走势火花线组件 (Sparkline)
 * 高度仅 16px，支持真实超时断点切断绘制，不伪造连续连接
 */
function LatencySparkline({
  points,
  grade,
}: {
  points: { latency: number | null }[]
  grade: "ok" | "warn" | "bad" | "down"
}) {
  const values = useMemo(() => points.map((p) => p.latency), [points])

  const segments = useMemo(() => {
    const valid = values.filter((v): v is number => v !== null)
    if (valid.length < 2) return []

    const min = Math.min(...valid)
    const max = Math.max(...valid)
    const span = max - min || 1

    const getX = (index: number) =>
      values.length <= 1 ? 0 : (index * SPARK_WIDTH) / (values.length - 1)
    const getY = (val: number) =>
      SPARK_HEIGHT - 2 - ((val - min) / span) * (SPARK_HEIGHT - 4)

    const segList: string[] = []
    let current: string[] = []

    values.forEach((v, i) => {
      if (v === null) {
        if (current.length > 0) {
          segList.push(current.join(" "))
          current = []
        }
      } else {
        current.push(`${getX(i).toFixed(1)},${getY(v).toFixed(1)}`)
      }
    })

    if (current.length > 0) {
      segList.push(current.join(" "))
    }

    return segList
  }, [values])

  if (segments.length === 0) {
    return <span className="h-4 flex-1" />
  }

  const strokeColor =
    grade === "bad"
      ? "var(--color-destructive)"
      : grade === "warn"
        ? "var(--color-warn)"
        : grade === "down"
          ? "var(--color-muted-foreground)"
          : "var(--color-online)"

  return (
    <svg
      viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`}
      preserveAspectRatio="none"
      className="h-3.5 flex-1 min-w-[50px] opacity-75 transition-opacity hover:opacity-100"
      aria-hidden="true"
    >
      {segments.map((pointsStr, idx) => (
        <polyline
          key={`seg-${idx}`}
          points={pointsStr}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  )
}

/**
 * 首页卡片延迟测试条目面板
 */
export function LatencySection({
  node,
  pingLines = "",
  enabled = true,
}: {
  node: Node
  pingLines?: string
  enabled?: boolean
}) {
  const { lines: allProbes, loading } = useNodeLatency(node, enabled)

  // 根据后台设置挑选展示的条目
  const rows = useMemo<ProbeLine[]>(() => {
    return pickPingRows(allProbes || [], pingLines, 3)
  }, [allProbes, pingLines])

  if (!enabled) return null

  // 离线节点展示对齐的工控状态占位，保持卡片物理高度完全对称统一
  if (!node.online) {
    return (
      <div className="mt-3.5 space-y-1.5 border-t border-border/60 pt-2.5">
        <div className="flex items-center justify-between text-xs font-mono font-medium text-muted-foreground pb-0.5">
          <span>网络延迟</span>
          <span>监测状态</span>
        </div>
        <div className="flex h-[76px] items-center justify-center rounded-[2px] border border-dashed border-border/60 bg-muted/15 px-3 text-center text-xs font-mono text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-[1px] bg-offline" />
            <span>节点处于离线状态 · 延迟监测挂起</span>
          </span>
        </div>
      </div>
    )
  }

  // 加载中占位微骨架：保持 h-[76px] 恒定高度，避免加载完成后卡片高度跳动
  if (loading && rows.length === 0) {
    return (
      <div className="mt-3.5 space-y-1.5 border-t border-border/50 pt-2.5">
        <div className="flex items-center justify-between text-xs font-mono font-medium text-muted-foreground pb-0.5">
          <span className="h-3 w-14 rounded-[1px] bg-muted/40 animate-pulse" />
          <span className="h-3 w-20 rounded-[1px] bg-muted/40 animate-pulse" />
        </div>
        <div className="flex h-[76px] flex-col justify-around py-1">
          <div className="flex items-center justify-between gap-2">
            <span className="h-2.5 w-12 rounded-[1px] bg-muted/40 animate-pulse" />
            <span className="h-2.5 flex-1 max-w-[80px] rounded-[1px] bg-muted/30 animate-pulse" />
            <span className="h-2.5 w-10 rounded-[1px] bg-muted/40 animate-pulse" />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="h-2.5 w-12 rounded-[1px] bg-muted/40 animate-pulse" />
            <span className="h-2.5 flex-1 max-w-[80px] rounded-[1px] bg-muted/30 animate-pulse" />
            <span className="h-2.5 w-10 rounded-[1px] bg-muted/40 animate-pulse" />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="h-2.5 w-12 rounded-[1px] bg-muted/40 animate-pulse" />
            <span className="h-2.5 flex-1 max-w-[80px] rounded-[1px] bg-muted/30 animate-pulse" />
            <span className="h-2.5 w-10 rounded-[1px] bg-muted/40 animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  // 没有任何 ping 测试条目时展示对齐的工控占位说明
  if (rows.length === 0) {
    return (
      <div className="mt-3.5 space-y-1.5 border-t border-border/60 pt-2.5">
        <div className="flex items-center justify-between text-xs font-mono font-medium text-muted-foreground pb-0.5">
          <span>网络延迟</span>
          <span>监测状态</span>
        </div>
        <div className="flex h-[76px] items-center justify-center rounded-[2px] border border-dashed border-border/50 bg-muted/10 px-3 text-center text-xs font-mono text-muted-foreground/80">
          <span>暂无配置延迟探测任务</span>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-3.5 space-y-1.5 border-t border-border/60 pt-2.5">
      <div className="flex items-center justify-between text-xs font-mono font-medium text-muted-foreground pb-0.5">
        <span>网络延迟</span>
        <span>1H 走势 · 丢包</span>
      </div>

      <div className="flex min-h-[76px] flex-col justify-around space-y-1">
        {rows.map((probe) => {
          const ms = probe.latestMs
          const loss = probe.loss
          const grade = evaluateLatency(ms, loss)

          const msClass =
            grade === "bad"
              ? "text-destructive font-semibold"
              : grade === "warn"
                ? "text-warn font-medium"
                : grade === "down"
                  ? "text-muted-foreground"
                  : "text-online font-medium"

          const lossClass =
            loss >= 5
              ? "text-destructive font-semibold"
              : loss > 0
                ? "text-warn font-medium"
                : "text-muted-foreground"

          return (
            <div
              key={`probe-${probe.id}`}
              className="flex items-center gap-2 text-xs font-mono"
            >
              {/* 线路名称 */}
              <span
                className="w-14 shrink-0 truncate text-xs text-muted-foreground font-medium"
                title={probe.name}
              >
                {probe.name}
              </span>

              {/* 当前最新延迟 */}
              <span className={cn("tnum w-13 shrink-0 text-right text-xs", msClass)}>
                {ms === null ? "超时" : `${ms} ms`}
              </span>

              {/* 1 小时微走势火花线 */}
              <LatencySparkline points={probe.points} grade={grade} />

              {/* 丢包率 */}
              <span className={cn("tnum w-9 shrink-0 text-right text-xs", lossClass)}>
                {loss > 0 ? `${loss.toFixed(1)}%` : "0.0%"}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
