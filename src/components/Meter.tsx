import type { ReactNode } from "react"

type Props = { label: ReactNode; pct: number | null; foot: ReactNode; empty?: ReactNode }

/**
 * 仪表指示条组件（CPU、内存、硬盘、流量等资源占用度量）
 * 遵循 AGENT.md 规范：采用微倒角 rounded-[1px] 替代 rounded-full，打造精密工业仪表风格；
 * 指示条宽度变化带有平滑缓动过渡。
 */
export function Meter({ label, pct, foot, empty = "—" }: Props) {
  // pct 为 null 表示当前指标无上限或无指标（如未上报），进度条置空而非显示 0%
  const filled = pct === null ? 0 : Math.min(100, Math.max(0, pct))
  return (
    <div className="min-w-0">
      {/* 顶部标签与数值 */}
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-xs font-normal text-muted-foreground">{label}</span>
        <span className="tnum text-xs font-semibold tracking-tight text-foreground">
          {pct === null ? empty : `${pct < 10 ? pct.toFixed(1) : pct.toFixed(0)}%`}
        </span>
      </div>
      {/* 进度条轨道：采用微倒角 rounded-[1px] */}
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-[1px] bg-muted/80 ring-1 ring-border/20">
        <div
          className="h-full rounded-[1px] bg-foreground transition-[width] duration-500 ease-out"
          style={{ width: `${filled}%` }}
        />
      </div>
      {/* 底部详细数值 */}
      <div className="tnum mt-1.5 truncate text-xs text-muted-foreground font-mono">{foot}</div>
    </div>
  )
}

