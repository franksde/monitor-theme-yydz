import {
  Activity,
  ArrowDown,
  ArrowDownUp,
  ArrowUp,
  Boxes,
  CalendarClock,
  Coins,
  Cpu,
  Database,
  Gauge,
  HardDrive,
  Server,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Country } from "@/components/NodeCard"
import { speedHistory, type Node } from "@/lib/api"
import { bytes, money, rate } from "@/lib/format"
import { calculateCosts, calculateExpiryRank, calculateNodeTypes } from "@/lib/summary"
import { cn } from "@/lib/utils"

/**
 * 汇总微卡片单项容器
 * 遵循 AGENT.md 规范：采用微倒角 rounded-[2px]，微边框与 hover 平滑过渡
 */
function Tile({
  icon: Icon,
  label,
  badge,
  className,
  children,
}: {
  icon: typeof Server
  label: string
  badge?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <Card
      className={cn(
        "group flex flex-col gap-0 rounded-[2px] border border-border/80 bg-card p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/30 hover:shadow-xs",
        className,
      )}
    >
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-[1px] border border-border/40 bg-muted/40 transition-colors group-hover:border-foreground/20">
            <Icon className="size-3 text-foreground/80" />
          </span>
          <span className="font-medium tracking-tight text-muted-foreground truncate">{label}</span>
        </div>
        {badge}
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
 * 首页全局/分组状态汇总看板
 * 整合：
 * 1. 实时监控态势（节点数、最高负载、今日流量、实时网速）
 * 2. 硬件资源与网络容量（CPU核数、内存总量、硬盘总量、节点带宽）
 * 3. 资产成本与服务周期（所有费用累计、到期时间排行榜）
 */
export function Summary({
  nodes,
  group,
  onOpen,
}: {
  nodes: Node[]
  group: string | null
  onOpen?: (id: number) => void
}) {
  const online = nodes.filter((n) => n.online)
  const sum = (pick: (n: Node) => number) => nodes.reduce((total, n) => total + pick(n), 0)

  // 1. 实时遥测指标计算
  const busiest = online.reduce<Node | null>(
    (top, n) => (n.metrics && (!top || n.metrics.cpu > top.metrics!.cpu) ? n : top),
    null,
  )
  const cpu = busiest?.metrics?.cpu ?? 0

  const history = speedHistory.get(group) ?? []
  const now = history.at(-1) ?? { rx: 0, tx: 0 }

  // 2. 硬件资源与网络统计
  const totalCores = sum((n) => n.cpu_cores || 0)
  const totalCpuNodes = nodes.filter((n) => n.cpu_cores > 0).length
  const onlineWithMetrics = nodes.filter((n) => n.online && n.metrics)
  const avgCpu =
    onlineWithMetrics.length > 0
      ? onlineWithMetrics.reduce((total, n) => total + n.metrics!.cpu, 0) / onlineWithMetrics.length
      : 0

  // 内存容量与全局使用率
  const totalMem = sum((n) => n.mem_total || 0)
  const usedMem = sum((n) => n.metrics?.mem_used || 0)
  const memPct = totalMem > 0 ? (usedMem / totalMem) * 100 : 0

  // 硬盘容量与全局使用率
  const totalDisk = sum((n) => n.disk_total || 0)
  const usedDisk = sum((n) => n.metrics?.disk_used || 0)
  const diskPct = totalDisk > 0 ? (usedDisk / totalDisk) * 100 : 0

  // 节点虚拟化类型与架构统计
  const nodeTypes = calculateNodeTypes(nodes)

  // 3. 财务与服务周期计算
  const costs = calculateCosts(nodes)
  const expiry = calculateExpiryRank(nodes)

  return (
    <div className="space-y-3">
      {/* 行 1：集群态势与算力规模 (Cluster & Compute) */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* 1. 节点总览 */}
        <Tile
          icon={Server}
          label="节点总览"
          badge={
            nodes.length > 0 ? (
              <span className="font-mono text-[11px] text-muted-foreground">
                {Math.round((online.length / nodes.length) * 100)}% 在线
              </span>
            ) : null
          }
        >
          <div className="tnum mt-1.5 text-xl font-bold tracking-tight">
            {online.length} <span className="text-sm font-normal text-muted-foreground">/ {nodes.length}</span>
          </div>
          <div className="mt-auto pt-1 text-xs text-muted-foreground">
            {nodes.length - online.length > 0 ? (
              <span className="font-medium text-warn">{nodes.length - online.length} 台离线停机</span>
            ) : (
              <span className="font-medium text-online">全部节点在线运行</span>
            )}
          </div>
        </Tile>

        {/* 2. 类型与架构 */}
        <Tile
          icon={Boxes}
          label="类型与架构"
          badge={
            nodes.length > 0 ? (
              <span className="rounded-[1px] bg-muted/60 px-1.5 py-0.5 text-[11px] font-mono text-muted-foreground">
                共 {nodes.length} 台
              </span>
            ) : null
          }
        >
          {nodes.length > 0 ? (
            <div className="mt-auto space-y-1.5 pt-1 text-xs">
              {/* 虚拟化分布 */}
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-[11px] font-medium text-muted-foreground shrink-0">虚拟化</span>
                <div className="flex flex-wrap items-center justify-end gap-1 overflow-hidden">
                  {nodeTypes.virtList.map((item) => (
                    <span
                      key={item.name}
                      title={`${item.name}: ${item.count} 台节点`}
                      className="inline-flex items-center gap-1 rounded-[1px] border border-border/70 bg-muted/40 px-1.5 py-0.5 font-mono text-[11px] font-medium text-foreground transition-colors hover:border-foreground/30"
                    >
                      <span>{item.name}</span>
                      <strong className="text-primary font-semibold">{item.count}</strong>
                    </span>
                  ))}
                </div>
              </div>

              {/* 架构分布 */}
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-[11px] font-medium text-muted-foreground shrink-0">系统架构</span>
                <div className="flex flex-wrap items-center justify-end gap-1 overflow-hidden">
                  {nodeTypes.archList.map((item) => (
                    <span
                      key={item.name}
                      title={`${item.name}: ${item.count} 台节点`}
                      className="inline-flex items-center gap-1 rounded-[1px] border border-border/70 bg-muted/40 px-1.5 py-0.5 font-mono text-[11px] font-medium text-foreground transition-colors hover:border-foreground/30"
                    >
                      <span>{item.name}</span>
                      <strong className="text-primary font-semibold">{item.count}</strong>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-auto pt-1 text-xs text-muted-foreground">
              暂无节点数据
            </div>
          )}
        </Tile>

        {/* 3. CPU 算力规模 */}
        <Tile icon={Cpu} label="CPU 核心">
          <div className="tnum mt-1.5 text-xl font-bold tracking-tight">
            {totalCores} <span className="text-sm font-normal text-muted-foreground">核</span>
          </div>
          <div className="mt-auto truncate pt-1 text-xs text-muted-foreground" title={`覆盖 ${totalCpuNodes} 台节点`}>
            {onlineWithMetrics.length > 0 ? (
              <span>
                在线均载 <strong className="font-semibold text-foreground">{avgCpu.toFixed(1)}%</strong> · {totalCpuNodes} 台机器
              </span>
            ) : (
              <span>共覆盖 {totalCpuNodes} 台节点</span>
            )}
          </div>
        </Tile>

        {/* 4. 最忙节点与最高负载 */}
        <Tile icon={Activity} label="最高负载">
          <div className="tnum mt-1.5 text-xl font-bold tracking-tight">{busiest ? `${cpu.toFixed(1)}%` : "—"}</div>
          <div
            className={cn(
              "mt-auto truncate pt-1 text-xs",
              cpu >= 85 ? "font-semibold text-destructive" : "text-muted-foreground",
            )}
            title={busiest ? `${busiest.name} (CPU: ${cpu.toFixed(1)}%)` : undefined}
          >
            {busiest ? busiest.name : "暂无在线节点"}
          </div>
        </Tile>
      </div>

      {/* 行 2：存储容量与网络吞吐 (Capacity & Throughput) */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* 5. 物理内存容量 */}
        <Tile icon={Database} label="物理内存">
          <div className="tnum mt-1.5 text-xl font-bold tracking-tight">
            {bytes(totalMem)}
          </div>
          <div className="mt-auto space-y-1 pt-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>已用 {bytes(usedMem)}</span>
              <span className="tnum font-mono text-[11px] font-medium">{memPct.toFixed(0)}%</span>
            </div>
            {/* 工控微倒角使用率指示条 */}
            <div className="h-1 w-full overflow-hidden rounded-[1px] bg-muted/60">
              <div
                className={cn(
                  "h-full rounded-[1px] transition-all duration-300",
                  memPct >= 90 ? "bg-destructive" : memPct >= 75 ? "bg-warn" : "bg-primary",
                )}
                style={{ width: `${Math.min(100, Math.max(0, memPct))}%` }}
              />
            </div>
          </div>
        </Tile>

        {/* 6. 系统存储容量 */}
        <Tile icon={HardDrive} label="系统存储">
          <div className="tnum mt-1.5 text-xl font-bold tracking-tight">
            {bytes(totalDisk)}
          </div>
          <div className="mt-auto space-y-1 pt-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>已用 {bytes(usedDisk)}</span>
              <span className="tnum font-mono text-[11px] font-medium">{diskPct.toFixed(0)}%</span>
            </div>
            {/* 工控微倒角使用率指示条 */}
            <div className="h-1 w-full overflow-hidden rounded-[1px] bg-muted/60">
              <div
                className={cn(
                  "h-full rounded-[1px] transition-all duration-300",
                  diskPct >= 90 ? "bg-destructive" : diskPct >= 75 ? "bg-warn" : "bg-primary",
                )}
                style={{ width: `${Math.min(100, Math.max(0, diskPct))}%` }}
              />
            </div>
          </div>
        </Tile>

        {/* 7. 实时网速与微走势 */}
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

        {/* 8. 今日与累计流量 */}
        <Tile icon={ArrowDownUp} label="今日与累计流量">
          <Flow
            down={bytes(sum((n) => n.day_rx))}
            up={bytes(sum((n) => n.day_tx))}
            className="mt-1 text-xs font-semibold tracking-tight"
          />
          <div className="mt-1.5 text-xs font-medium text-muted-foreground">总计累计</div>
          <Flow
            down={bytes(sum((n) => n.total_rx))}
            up={bytes(sum((n) => n.total_tx))}
            className="mt-0.5 text-xs text-muted-foreground"
          />
        </Tile>
      </div>

      {/* 行 3：资产财务与服务周期排行榜 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* 5. 所有费用累计（占 2 列） */}
        <Tile
          icon={Coins}
          label="所有费用累计"
          className="lg:col-span-2"
          badge={
            costs.billableCount > 0 ? (
              <span className="rounded-[1px] bg-muted/60 px-1.5 py-0.5 text-[11px] font-mono text-muted-foreground">
                {costs.billableCount} 台计费
              </span>
            ) : (
              <span className="text-[11px] text-muted-foreground">免费集群</span>
            )
          }
        >
          {costs.billableCount > 0 ? (
            <div className="mt-1.5 flex flex-col justify-between gap-2 sm:flex-row sm:items-baseline">
              <div>
                <div className="tnum text-xl font-bold tracking-tight text-foreground">
                  {money(costs.totalMonthly, costs.primaryCurrency)}{" "}
                  <span className="text-xs font-normal text-muted-foreground">/ 月</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  折合 {money(costs.totalAnnual, costs.primaryCurrency)} / 年
                  {costs.totalOnce > 0 && ` · 买断 ${money(costs.totalOnce, costs.primaryCurrency)}`}
                </div>
              </div>

              {/* 多币种或明细展示 */}
              {costs.breakdown.length > 1 && (
                <div className="flex flex-wrap items-center gap-1 pt-1 text-[11px] sm:pt-0">
                  {costs.breakdown.map((item) => (
                    <span
                      key={item.currency}
                      className="rounded-[1px] border border-border/60 bg-muted/30 px-1.5 py-0.5 font-mono text-muted-foreground"
                    >
                      {item.currency}: {money(item.monthly, item.currency)}/月 ({item.count}台)
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="mt-1.5">
              <div className="tnum text-xl font-bold tracking-tight text-foreground">
                ¥0.00 <span className="text-xs font-normal text-muted-foreground">/ 月</span>
              </div>
              <div className="text-xs text-muted-foreground">
                当前所有节点均为免费机器或未录入账单
              </div>
            </div>
          )}
        </Tile>

        {/* 6. 到期时间排行榜（占 2 列） */}
        <Tile
          icon={CalendarClock}
          label="到期时间排行榜"
          className="lg:col-span-2"
          badge={
            expiry.expiredCount > 0 ? (
              <span className="rounded-[1px] bg-destructive/15 px-1.5 py-0.5 text-[11px] font-medium text-destructive">
                {expiry.expiredCount} 台已过期
              </span>
            ) : expiry.nearExpiryCount > 0 ? (
              <span className="rounded-[1px] bg-warn/15 px-1.5 py-0.5 text-[11px] font-medium text-warn">
                {expiry.nearExpiryCount} 台临期预警
              </span>
            ) : expiry.list.length > 0 ? (
              <span className="text-[11px] text-muted-foreground">
                共 {expiry.list.length} 台设置到期日
              </span>
            ) : (
              <span className="text-[11px] text-muted-foreground">永久有效</span>
            )
          }
        >
          {expiry.list.length > 0 ? (
            <div className="mt-1 divide-y divide-border/30">
              {expiry.list.slice(0, 4).map(({ node: n, days }, idx) => (
                <div key={n.id} className="flex items-center justify-between gap-2 py-1 text-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="flex size-4 shrink-0 items-center justify-center rounded-[1px] bg-muted/70 text-[10px] font-mono font-semibold text-muted-foreground">
                      {idx + 1}
                    </span>
                    <Country node={n} />
                    <button
                      type="button"
                      onClick={() => onOpen?.(n.id)}
                      className="truncate font-medium text-foreground hover:underline text-left transition-colors"
                      title={`查看 ${n.name} 详情`}
                    >
                      {n.name}
                    </button>
                  </div>
                  <div className="shrink-0">
                    <Badge
                      className={cn(
                        "h-4.5 px-1.5 text-[11px] font-mono font-medium rounded-[1px]",
                        days < 0
                          ? "border-destructive/40 bg-destructive/15 text-destructive font-semibold"
                          : days <= 3
                            ? "border-destructive/40 bg-destructive/10 text-destructive font-semibold"
                            : days <= 7
                              ? "border-warn/40 bg-warn/15 text-warn font-semibold"
                              : "border-border/60 bg-muted/50 text-muted-foreground",
                      )}
                    >
                      {days < 0 ? `已过期 ${-days} 天` : days === 0 ? "今日到期" : `剩 ${days} 天`}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-2 py-1 text-xs text-muted-foreground">
              所有节点均为永久有效或未设置到期日
            </div>
          )}
        </Tile>
      </div>
    </div>
  )
}
