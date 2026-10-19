import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type Props = { label: ReactNode; pct: number | null; foot: ReactNode; empty?: ReactNode; compact?: boolean }

// 阈值配色：≥90% 红，≥70% 黄，其余前景色
export function meterTone(pct: number | null) {
  if (pct === null) return { text: "text-muted-foreground", bar: "bg-foreground" }
  if (pct >= 90) return { text: "text-destructive", bar: "bg-destructive" }
  if (pct >= 70) return { text: "text-warn", bar: "bg-warn" }
  return { text: "text-foreground", bar: "bg-foreground/85" }
}

/**
 * 仪表指示条（横向一行读完）：标签 | 进度条 | 百分比，下方一行次级细节
 * 遵循 AGENT.md 规范：微倒角 rounded-[1px]，宽度变化平滑缓动
 */
export function Meter({ label, pct, foot, empty = "—", compact = false }: Props) {
  const filled = pct === null ? 0 : Math.min(100, Math.max(0, pct))
  const tone = meterTone(pct)
  const value = pct === null ? empty : `${pct < 10 ? pct.toFixed(1) : pct.toFixed(0)}%`
  // 紧凑：标签 | 进度条 | 细节 | 百分比，一行读完，省掉细节那一行
  if (compact) {
    return (
      <div className="grid min-w-0 grid-cols-[2.25rem_minmax(2.5rem,1fr)_auto_3rem] items-center gap-2">
        <span className="truncate text-xs text-muted-foreground">{label}</span>
        <div className="h-1.5 w-full overflow-hidden rounded-[1px] bg-muted/80 ring-1 ring-border/20">
          <div
            className={cn("h-full rounded-[1px] transition-[width,background-color] duration-500 ease-out", tone.bar)}
            style={{ width: `${filled}%` }}
          />
        </div>
        <span className="tnum max-w-[9rem] truncate whitespace-nowrap text-right font-mono text-[11px] text-muted-foreground">{foot}</span>
        <span className={cn("tnum text-right font-mono text-sm font-semibold tracking-tight", tone.text)}>{value}</span>
      </div>
    )
  }
  return (
    <div className="min-w-0">
      <div className="grid grid-cols-[2.25rem_minmax(0,1fr)_3.25rem] items-center gap-2.5">
        <span className="truncate text-xs text-muted-foreground">{label}</span>
        <div className="h-1.5 w-full overflow-hidden rounded-[1px] bg-muted/80 ring-1 ring-border/20">
          <div
            className={cn("h-full rounded-[1px] transition-[width,background-color] duration-500 ease-out", tone.bar)}
            style={{ width: `${filled}%` }}
          />
        </div>
        <span className={cn("tnum text-right font-mono text-sm font-semibold tracking-tight", tone.text)}>
          {value}
        </span>
      </div>
      <div className="tnum mt-0.5 truncate pl-[2.875rem] font-mono text-[11px] text-muted-foreground">{foot}</div>
    </div>
  )
}

/** 无上限指标（如不限量流量）：只显示一行文字，不画空进度条 */
export function MeterText({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="grid min-w-0 grid-cols-[2.25rem_minmax(0,1fr)] items-center gap-2.5">
      <span className="truncate text-xs text-muted-foreground">{label}</span>
      <span className="tnum truncate font-mono text-xs text-foreground/85">{value}</span>
    </div>
  )
}
