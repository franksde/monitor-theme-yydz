import { useMemo, useState } from "react"
import { ShieldCheck } from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"
import { calculateUptimeSla, type UptimeSlaSegment } from "@/lib/summary"
import { cn } from "@/lib/utils"

export type UptimeSlaBarProps = {
  metrics: Array<{ ts: number; minutes?: number }>
  step?: number
  hours: number
  nowTs?: number
}

/**
 * 格式化时间戳区间为时分或日期范围
 */
function formatTimeRange(startTs: number, endTs: number, hours: number) {
  const d1 = new Date(startTs * 1000)
  const d2 = new Date(endTs * 1000)
  const pad = (n: number) => String(n).padStart(2, "0")
  if (hours <= 24) {
    return `${pad(d1.getHours())}:${pad(d1.getMinutes())} - ${pad(d2.getHours())}:${pad(d2.getMinutes())}`
  }
  return `${d1.getMonth() + 1}/${d1.getDate()} ${pad(d1.getHours())}:${pad(d1.getMinutes())} - ${d2.getMonth() + 1}/${d2.getDate()} ${pad(d2.getHours())}:${pad(d2.getMinutes())}`
}

/**
 * 历史遥测观测覆盖率分段组件
 * 遵循 AGENT.md 规范：采用微倒角 (2px/1px)、工控极简风、悬浮原位 Tooltip
 */
export function UptimeSlaBar({ metrics, step = 60, hours, nowTs }: UptimeSlaBarProps) {
  const [hovered, setHovered] = useState<UptimeSlaSegment | null>(null)

  // 统一计算总覆盖率与 48 个分段；聚合桶内部按覆盖比例估算
  const { slaPct, segments } = useMemo(() => {
    return calculateUptimeSla(metrics, step, hours, 48, nowTs)
  }, [metrics, step, hours, nowTs])

  if (segments.length === 0) return null

  const slaTone =
    slaPct >= 99.9
      ? "text-online"
      : slaPct >= 99
        ? "text-primary"
        : slaPct >= 95
          ? "text-warn"
          : "text-destructive"

  return (
    <div className="relative rounded-[2px] border border-border/70 bg-card/70 p-3 text-xs shadow-2xs backdrop-blur-xs transition-colors hover:border-border">
      {/* 顶部标题与遥测覆盖率 */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 text-primary" />
          <span className="font-semibold text-foreground">遥测覆盖率</span>
          <span className="font-mono text-muted-foreground text-[11px]">
            · {hours >= 24 ? `${Math.round(hours / 24)} 天` : `${hours} 小时`}遥测窗口
          </span>
        </div>

        {/* 已观测时长占窗口比例 */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">观测覆盖率</span>
          <span className={cn("tnum font-mono text-sm font-bold tracking-tight", slaTone)}>
            {slaPct.toFixed(2)}%
          </span>
        </div>
      </div>

      {/* 中部：微倒角心跳色块条 */}
      <div className="relative mt-2.5">
        <div className="flex h-5 w-full items-stretch gap-[2px]">
          {segments.map((seg, idx) => {
            const barBg =
              seg.status === "up"
                ? "bg-online/85 hover:bg-online"
                : seg.status === "degraded"
                  ? "bg-warn/85 hover:bg-warn"
                  : "bg-destructive/85 hover:bg-destructive"

            return (
              <div
                key={seg.startTs ?? idx}
                onMouseEnter={() => setHovered(seg)}
                onMouseLeave={() => setHovered(null)}
                className={cn(
                  "flex-1 cursor-pointer rounded-[0.5px] transition-all hover:scale-y-110",
                  barBg,
                )}
              />
            )
          })}
        </div>

        {/* 悬浮原位 Tooltip */}
        {hovered && (
          <div className="pointer-events-none absolute left-1/2 top-7 -translate-x-1/2 z-20 flex items-center gap-2 rounded-[2px] border border-border/80 bg-card px-2.5 py-1 text-[11px] text-card-foreground shadow-md backdrop-blur-xs animate-fade-in max-w-[calc(100vw-3rem)] flex-wrap w-max">
            <span className="font-mono text-muted-foreground">
              {formatTimeRange(hovered.startTs, hovered.endTs, hours)}
            </span>
            <span className="h-2.5 w-[1px] bg-border" />
            <span>
              观测{" "}
              <strong className="font-mono text-foreground">{hovered.minutes.toFixed(1)}</strong> /{" "}
              {hovered.expected.toFixed(1)} 分钟
            </span>
            <span className="h-2.5 w-[1px] bg-border" />
            <span
              className={cn(
                "font-medium",
                hovered.status === "up"
                  ? "text-online"
                  : hovered.status === "degraded"
                    ? "text-warn"
                    : "text-destructive",
              )}
            >
              {hovered.status === "up"
                ? `已采集 (${hovered.pct}%)`
                : hovered.status === "degraded"
                  ? `部分覆盖 (${hovered.pct}%)`
                  : "未采集 (0%)"}
            </span>
          </div>
        )}
      </div>

      {/* 底部两端时间跨度标注 */}
      <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-muted-foreground/80">
        <span>{hours >= 24 ? `${Math.round(hours / 24)} 天前` : `${hours} 小时前`}</span>
        <span>缺测不等同于服务不可用{step > 60 ? " · 分段为聚合估算" : ""}</span>
        <span>当前</span>
      </div>
    </div>
  )
}

/**
 * 历史遥测覆盖率 骨架屏组件 (高保真 1:1 对齐真实组件)
 */
export function UptimeSlaBarSkeleton({ hours = 24 }: { hours?: number }) {
  return (
    <div className="relative rounded-[2px] border border-border/70 bg-card/70 p-3 text-xs shadow-2xs backdrop-blur-xs select-none">
      {/* 顶部标题与遥测覆盖率 */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 text-primary" />
          <span className="font-semibold text-foreground">遥测覆盖率</span>
          <span className="font-mono text-muted-foreground text-[11px]">
            · {hours >= 24 ? `${Math.round(hours / 24)} 天` : `${hours} 小时`}遥测窗口
          </span>
        </div>

        {/* 已观测时长占窗口比例占位 */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">观测覆盖率</span>
          <Skeleton className="h-5 w-14 rounded-[1px]" />
        </div>
      </div>

      {/* 中部：微倒角心跳色块条（48 根微色块呼吸占位） */}
      <div className="relative mt-2.5">
        <div className="flex h-5 w-full items-stretch gap-[2px]">
          {Array.from({ length: 48 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 rounded-[0.5px] bg-muted/60 animate-pulse"
              style={{ animationDelay: `${(i % 12) * 50}ms` }}
            />
          ))}
        </div>
      </div>

      {/* 底部两端时间跨度标注 */}
      <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-muted-foreground/80">
        <span>{hours >= 24 ? `${Math.round(hours / 24)} 天前` : `${hours} 小时前`}</span>
        <span className="flex items-center gap-1">
          <span className="size-1.5 rounded-[0.5px] bg-muted inline-block" />
          <Skeleton className="h-2.5 w-12 rounded-[0.5px]" />
        </span>
        <span>当前</span>
      </div>
    </div>
  )
}
