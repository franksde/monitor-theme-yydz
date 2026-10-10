import { Activity, ArrowDown, ArrowDownUp, ArrowUp, Gauge, Server } from "lucide-react"

import { Card } from "@/components/ui/card"
import { speedHistory, type Node } from "@/lib/api"
import { bytes, rate } from "@/lib/format"
import { cn } from "@/lib/utils"

/**
 * 汇总微卡片单项
 * 遵循 AGENT.md 规范：采用微倒角 rounded-[2px]，微边框与 hover 平滑过渡
 */
function Tile({ icon: Icon, label, children }: {
  icon: typeof Server; label: string; children: React.ReactNode
}) {
  return (
    <Card className="group gap-0 rounded-[2px] border border-border/80 bg-card p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/30 hover:shadow-xs">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="flex size-5 items-center justify-center rounded-[1px] border border-border/40 bg-muted/40 transition-colors group-hover:border-foreground/20">
          <Icon className="size-3 text-foreground/80" />
        </span>
        <span className="font-medium tracking-tight text-muted-foreground">{label}</span>
      </div>
      {children}
    </Card>
  )
}

/**
 * 上行与下行双向指标流速/流量展示
 * 在小屏幕上自动并排或紧凑排列
 */
function Flow({ down, up, className }: { down: string; up: string; className?: string }) {
  return (
    <div className={cn("tnum grid grid-cols-1 gap-x-2 sm:grid-cols-2", className)}>
      <span className="inline-flex items-center gap-1">
        <ArrowDown className="size-3 shrink-0 text-muted-foreground opacity-80" />
        <span className="truncate">{down}</span>
      </span>
      <span className="inline-flex items-center gap-1">
        <ArrowUp className="size-3 shrink-0 text-muted-foreground opacity-80" />
        <span className="truncate">{up}</span>
      </span>
    </div>
  )
}

/**
 * 极轻量 SVG 趋势线（无重型图表库依赖）
 * 遵循 AGENT.md 规范：保持精简轻量，采用微倒角 rounded-[1px] 容器包裹
 */
function Spark({ series }: { series: { values: number[]; className: string }[] }) {
  const top = Math.max(...series.flatMap((s) => s.values), 1)
  const width = Math.max(...series.map((s) => s.values.length), 2) - 1
  return (
    <div className="overflow-hidden rounded-[1px] border border-border/30 bg-muted/20 px-1 py-0.5">
      <svg viewBox="0 0 100 24" preserveAspectRatio="none" className="h-6 w-full" aria-hidden>
        {series.map((s, i) => (
          <polyline
            key={i}
            className={s.className}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            points={s.values.map((v, x) => `${(x / width) * 100},${23 - (v / top) * 22}`).join(" ")}
          />
        ))}
      </svg>
    </div>
  )
}

/**
 * 顶部全局/分组状态汇总指示面板
 * `group` 决定当前展示的分组吞吐量曲线：null 为全部节点，否则为当前选中的分组
 */
export function Summary({ nodes, group }: { nodes: Node[]; group: string | null }) {
  const online = nodes.filter((n) => n.online)
  const sum = (pick: (n: Node) => number) => nodes.reduce((total, n) => total + pick(n), 0)

  // 统计 CPU 最忙节点（相比平均值更能反映瓶颈机器）
  const busiest = online.reduce<Node | null>(
    (top, n) => (n.metrics && (!top || n.metrics.cpu > top.metrics!.cpu) ? n : top),
    null,
  )
  const cpu = busiest?.metrics?.cpu ?? 0

  // 实时网速历史缓存序列
  const history = speedHistory.get(group) ?? []
  const now = history.at(-1) ?? { rx: 0, tx: 0 }

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {/* 节点总览 */}
      <Tile icon={Server} label="节点">
        <div className="tnum mt-1.5 text-xl font-bold tracking-tight">
          {online.length} <span className="text-sm font-normal text-muted-foreground">/ {nodes.length}</span>
        </div>
        <div className="mt-auto pt-1 text-xs text-muted-foreground">
          {nodes.length - online.length > 0 ? (
            <span className="font-medium text-warn">{nodes.length - online.length} 台离线</span>
          ) : (
            <span className="font-medium text-online">全部节点在线</span>
          )}
        </div>
      </Tile>

      {/* 最忙节点 */}
      <Tile icon={Activity} label="最高负载">
        <div className="tnum mt-1.5 text-xl font-bold tracking-tight">{busiest ? `${cpu.toFixed(1)}%` : "—"}</div>
        <div className={cn("mt-auto truncate pt-1 text-xs", cpu >= 85 ? "font-semibold text-destructive" : "text-muted-foreground")}>
          {busiest ? busiest.name : "暂无在线节点"}
        </div>
      </Tile>

      {/* 流量统计 */}
      <Tile icon={ArrowDownUp} label="今日流量">
        <Flow
          down={bytes(sum((n) => n.day_rx))}
          up={bytes(sum((n) => n.day_tx))}
          className="mt-1 text-xs font-semibold tracking-tight"
        />
        <div className="mt-1.5 text-[11px] font-medium text-muted-foreground">总计累计</div>
        <Flow down={bytes(sum((n) => n.total_rx))} up={bytes(sum((n) => n.total_tx))} className="mt-0.5 text-xs text-muted-foreground" />
      </Tile>

      {/* 实时速率与微走势 */}
      <Tile icon={Gauge} label="实时网速">
        <Flow down={rate(now.rx)} up={rate(now.tx)} className="mt-1 text-xs font-semibold tracking-tight" />
        <div className="mt-auto pt-1.5">
          <Spark
            series={[
              { values: history.map((s) => s.rx), className: "text-foreground" },
              { values: history.map((s) => s.tx), className: "text-muted-foreground/60" },
            ]}
          />
        </div>
      </Tile>
    </div>
  )
}

