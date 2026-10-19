/**
 * 节点硬件规格与系统环境展示组件 (Node Specifications & Overview)
 * 具备：顶部全景控制栏、工控微倒角四格规格矩阵（计算系统/内存存储/网络流量/服务周期）、
 * 优雅的内嵌微进度条与清晰的层次过渡。
 * 遵循 AGENT.md 规范：采用微倒角 (2px)、全中文注释、工业仪器极简美学、零多余外部依赖。
 */

import {
  Activity,
  Calendar,
  Cpu,
  Info,
  Server,
  Shield,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Country, Status } from "@/components/NodeCard"
import type { Node } from "@/lib/api"
import { cn } from "@/lib/utils"
import {
  bytes,
  cpuName,
  cycle,
  daysUntil,
  FOREVER,
  money,
  osName,
} from "@/lib/format"
import { resolveNodeGeo } from "@/lib/geo"

export type NodeSpecsProps = {
  node: Node
}

export function NodeSpecs({ node }: NodeSpecsProps) {
  const geo = resolveNodeGeo(node)

  // 到期天数计算
  const daysLeft = node.expires_in !== undefined ? node.expires_in : daysUntil(node.expires_at)

  return (
    <div className="space-y-3.5">
      {/* 1. 顶部全景控制栏：国旗、节点名称、在线指示灯、Agent 版本、地理坐标与实时遥测指标胶囊 */}
      <div className="flex flex-col gap-3 rounded-[2px] border border-border/80 bg-card/80 p-3 shadow-2xs backdrop-blur-xs sm:p-3.5 lg:flex-row lg:items-center lg:justify-between">
        {/* 左侧：主机标识与属性徽章 */}
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-2.5">
          <Country node={node} />
          <h2 className="truncate text-lg font-bold tracking-tight text-foreground" title={node.name}>
            {node.name}
          </h2>
          <Status node={node} />

          {node.group && (
            <Badge className="rounded-[2px] text-xs font-medium bg-secondary text-secondary-foreground border-transparent">
              {node.group}
            </Badge>
          )}

          {node.agent_version && (
            <Badge className="rounded-[2px] font-mono text-xs text-foreground/80 border-border/70 bg-transparent">
              v{node.agent_version}
            </Badge>
          )}

          {geo && (
            <span className="hidden items-center text-xs text-muted-foreground font-mono sm:inline-flex">
              {geo.city}, {geo.country}
            </span>
          )}
        </div>

        {/* 右侧：节点核心网络标识与规格概括 */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-muted-foreground">
          {node.ip && (
            <div className="flex items-center gap-1 rounded-[1px] border border-border/60 bg-muted/30 px-2 py-0.5">
              <span className="text-muted-foreground/70">IP:</span>
              <span className="text-foreground font-medium">{node.ip}</span>
            </div>
          )}
          <div className="flex items-center gap-1 rounded-[1px] border border-border/60 bg-muted/30 px-2 py-0.5">
            <span className="text-muted-foreground/70">规格:</span>
            <span className="text-foreground font-medium">
              {node.cpu_cores}C · {bytes(node.mem_total)} · {bytes(node.disk_total)}
            </span>
          </div>
        </div>
      </div>

      {/* 2. 工控资产规格卡片矩阵：4 格结构化展示静态配置与服务档案 */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* 卡片 A：系统与计算架构 */}
        <div className="rounded-[2px] border border-border/70 bg-card/60 p-3 shadow-2xs backdrop-blur-xs transition-colors hover:border-border">
          <div className="flex items-center gap-2 border-b border-border/40 pb-2 text-xs font-semibold text-foreground">
            <Server className="size-3.5 text-primary" />
            <span>系统与计算架构</span>
          </div>
          <div className="divide-y divide-border/30 text-xs">
            <div className="flex items-center justify-between py-1.5">
              <span className="text-muted-foreground">操作系统</span>
              <span className="truncate font-mono font-medium text-foreground max-w-[150px]" title={[osName(node.os), node.kernel].filter(Boolean).join(" ")}>
                {osName(node.os)} {node.kernel ? `(${node.kernel})` : ""}
              </span>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-muted-foreground">CPU 处理器</span>
              <span className="truncate font-mono font-medium text-foreground max-w-[150px]" title={node.cpu_name ? cpuName(node.cpu_name) : "CPU"}>
                {node.cpu_name ? `${cpuName(node.cpu_name)}` : "CPU"} × {node.cpu_cores} 核
              </span>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-muted-foreground">架构 / 虚拟化</span>
              <span className="font-mono font-medium text-foreground">
                {node.arch} · {node.virt !== "none" ? node.virt : "物理机"}
              </span>
            </div>
          </div>
        </div>

        {/* 卡片 B：硬件物理总容量 */}
        <div className="rounded-[2px] border border-border/70 bg-card/60 p-3 shadow-2xs backdrop-blur-xs transition-colors hover:border-border">
          <div className="flex items-center gap-2 border-b border-border/40 pb-2 text-xs font-semibold text-foreground">
            <Cpu className="size-3.5 text-primary" />
            <span>硬件物理总容量</span>
          </div>
          <div className="divide-y divide-border/30 text-xs">
            <div className="flex items-center justify-between py-1.5">
              <span className="text-muted-foreground">物理内存上限</span>
              <span className="font-mono font-medium text-foreground">
                {bytes(node.mem_total)}
              </span>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-muted-foreground">交换空间 Swap</span>
              <span className="font-mono font-medium text-foreground">
                {node.swap_total > 0 ? bytes(node.swap_total) : "未配置"}
              </span>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-muted-foreground">存储主盘容量</span>
              <span className="font-mono font-medium text-foreground">
                {bytes(node.disk_total)}
              </span>
            </div>
          </div>
        </div>

        {/* 卡片 C：网络服务与配额 */}
        <div className="rounded-[2px] border border-border/70 bg-card/60 p-3 shadow-2xs backdrop-blur-xs transition-colors hover:border-border">
          <div className="flex items-center gap-2 border-b border-border/40 pb-2 text-xs font-semibold text-foreground">
            <Activity className="size-3.5 text-primary" />
            <span>网络计划与配额</span>
          </div>
          <div className="divide-y divide-border/30 text-xs">
            <div className="flex items-center justify-between py-1.5">
              <span className="text-muted-foreground">月度计划配额</span>
              <span className="tnum font-mono font-medium text-foreground">
                {node.traffic_limit > 0 ? bytes(node.traffic_limit) : FOREVER}
              </span>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-muted-foreground">重置结算日</span>
              <span className="font-mono font-medium text-foreground">
                {node.traffic_reset_day ? `每月 ${node.traffic_reset_day} 日` : "自然月首日"}
              </span>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-muted-foreground">计量模式</span>
              <span className="font-mono font-medium text-foreground">
                {node.traffic_mode === "down"
                  ? "仅计算下行入网"
                  : node.traffic_mode === "up"
                    ? "仅计算上行出网"
                    : node.traffic_mode === "max" ? "双向取较大值" : "双向出入网累计"}
              </span>
            </div>
          </div>
        </div>

        {/* 卡片 D：服务周期与资费 */}
        <div className="rounded-[2px] border border-border/70 bg-card/60 p-3 shadow-2xs backdrop-blur-xs transition-colors hover:border-border">
          <div className="flex items-center gap-2 border-b border-border/40 pb-2 text-xs font-semibold text-foreground">
            <Calendar className="size-3.5 text-primary" />
            <span>服务周期与资费</span>
          </div>
          <div className="divide-y divide-border/30 text-xs">
            <div className="flex items-center justify-between py-1.5">
              <span className="text-muted-foreground">资费周期</span>
              <span className="font-mono font-medium text-foreground">
                {node.price > 0
                  ? `${money(node.price, node.currency)} / ${cycle(node.billing_cycle)}`
                  : "免费 / 赞助"}
              </span>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-muted-foreground">到期时间</span>
              <div className="flex items-center gap-1 font-mono font-medium text-foreground">
                <span>{node.expires_at ? `${node.expires_at}` : FOREVER}</span>
                {daysLeft !== null && daysLeft <= 15 && (
                  <Badge
                    className={cn(
                      "h-4.5 px-1.5 text-[11px] font-medium rounded-[1px]",
                      daysLeft <= 3
                        ? "border-destructive/40 bg-destructive/15 text-destructive font-semibold"
                        : "border-border/60 bg-muted/60 text-muted-foreground"
                    )}
                  >
                    {daysLeft <= 0 ? "已过期" : `剩${daysLeft}天`}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-muted-foreground">计费周期</span>
              <span className="font-mono font-medium text-foreground">
                {cycle(node.billing_cycle) || "长期有效"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. 节点公开介绍与机房说明（公开可见） */}
      {node.public_remark && (
        <div className="flex items-start gap-2.5 rounded-[2px] border border-border/70 bg-card/60 p-3 text-xs text-muted-foreground shadow-2xs backdrop-blur-xs">
          <Info className="mt-0.5 size-3.5 shrink-0 text-primary opacity-80" />
          <div className="space-y-0.5">
            <span className="font-semibold text-foreground">节点说明与机房公告</span>
            <p className="leading-relaxed whitespace-pre-wrap text-foreground/90">{node.public_remark}</p>
          </div>
        </div>
      )}

      {/* 4. 管理员私有备忘信息（仅管理员登录时存在） */}
      {node.remark && (
        <div className="flex items-start gap-2 rounded-[2px] border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <Shield className="mt-0.5 size-3.5 shrink-0 opacity-70" />
          <p className="leading-relaxed whitespace-pre-wrap">{node.remark}</p>
        </div>
      )}
    </div>
  )
}
