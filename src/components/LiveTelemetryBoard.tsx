/**
 * 实时遥测动态测控驾驶舱组件 (Live Telemetry Dashboard)
 * 具备：
 * 1. 显性 LIVE 状态指示（绿色呼吸脉冲灯、实时上报状态、最后心跳上报时间）
 * 2. 4 格工控实时动态仪表矩阵：
 *    - 实时 CPU 负荷与系统 1/5/15m 平均负载 (Load Average)
 *    - 实时物理内存占用与 Swap 交换空间使用状态
 *    - 实时网络瞬时吞吐 (↓ 下行 / ↑ 上行) 与实时 TCP/UDP 连接数
 *    - 实时磁盘占用容量、系统进程总数与今日累计流量
 * 遵循 AGENT.md 规范：微倒角 (rounded-[2px])、工控精密仪器质感、全中文注释。
 */

import { Activity, ArrowDown, ArrowUp, Clock, Cpu, HardDrive, Layers, Radio } from "lucide-react"

import type { Node } from "@/lib/api"
import { bytes, percent, rate, uptime } from "@/lib/format"
import { cn } from "@/lib/utils"

export type LiveTelemetryBoardProps = {
  node: Node
}

export function LiveTelemetryBoard({ node }: LiveTelemetryBoardProps) {
  const m = node.online ? node.metrics : null

  // 瞬时使用百分比计算
  const cpuPct = m ? m.cpu : null
  const memPct = m ? percent(m.mem_used, node.mem_total) : null
  const swapPct = m && node.swap_total > 0 ? percent(m.swap_used, node.swap_total) : null
  const diskPct = m ? percent(m.disk_used, node.disk_total) : null

  // 心跳更新状态文案计算
  const lastSeenText =
    node.last_seen_ago !== undefined && node.last_seen_ago !== null
      ? node.last_seen_ago <= 3
        ? "刚刚"
        : `${node.last_seen_ago} 秒前`
      : node.online
        ? "正常活跃"
        : "离线"

  return (
    <div className="space-y-2.5 rounded-[2px] border border-border/80 bg-card/70 p-3 shadow-2xs backdrop-blur-xs transition-colors sm:p-3.5">
      {/* 顶部标题栏：显性 LIVE 标识、长连接刷新提示与心跳状态 */}
      <div className="flex flex-col gap-2 border-b border-border/50 pb-2.5 sm:flex-row sm:items-center sm:justify-between">
        {/* 左侧：实时状态主标识 */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Radio className="size-3.5 text-online" />
            <span>实时遥测驾驶舱</span>
            <span className="font-mono text-[11px] font-normal text-muted-foreground">
              · Live Telemetry
            </span>
          </div>

          <div className="flex items-center gap-1.5 rounded-[2px] border border-border/60 bg-muted/30 px-2 py-0.5 text-[11px] font-mono font-medium text-muted-foreground shadow-2xs">
            <span
              className={cn(
                "size-1.5 rounded-[0.5px]",
                node.online ? "bg-online pulse-online" : "bg-offline",
              )}
            />
            <span>{node.online ? "LIVE · 实时上报" : "OFFLINE · 节点离线"}</span>
          </div>
        </div>

        {/* 右侧：心跳上报频率与系统连续运行时长 */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-muted-foreground sm:justify-end">
          <div className="flex items-center gap-1 rounded-[1px] border border-border/60 bg-muted/40 px-2 py-0.5">
            <Clock className="size-3 text-muted-foreground/70 shrink-0" />
            <span>运行:</span>
            <span className="tnum font-medium text-foreground">
              {m && m.uptime > 0 ? uptime(m.uptime) : "—"}
            </span>
          </div>

          <div className="flex items-center gap-1 rounded-[1px] border border-border/60 bg-muted/40 px-2 py-0.5">
            <span>心跳:</span>
            <span className={cn("font-medium", node.online ? "text-online" : "text-destructive")}>
              {lastSeenText}
            </span>
          </div>
        </div>
      </div>

      {/* 4 格工控实时动态仪表矩阵 */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* 卡片 1：实时 CPU 负荷与系统负载 */}
        <div className="flex flex-col justify-between rounded-[2px] border border-border/70 bg-card/60 p-3 shadow-2xs transition-colors hover:border-border">
          <div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <Cpu className="size-3.5 text-primary" />
                <span>CPU 实时负荷</span>
              </span>
              <span
                className={cn(
                  "font-mono text-sm font-bold tnum",
                  cpuPct === null
                    ? "text-muted-foreground"
                    : cpuPct > 80
                      ? "text-destructive"
                      : cpuPct > 60
                        ? "text-warn"
                        : "text-foreground",
                )}
              >
                {cpuPct !== null ? `${cpuPct.toFixed(1)}%` : "—"}
              </span>
            </div>

            {/* 动态微进度条 */}
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-[1px] bg-muted/80">
              <div
                className={cn(
                  "h-full transition-all duration-300",
                  cpuPct !== null && cpuPct > 80
                    ? "bg-destructive"
                    : cpuPct !== null && cpuPct > 60
                      ? "bg-warn"
                      : "bg-primary",
                )}
                style={{ width: `${Math.min(100, Math.max(0, cpuPct ?? 0))}%` }}
              />
            </div>
          </div>

          <div className="mt-3 border-t border-border/30 pt-2 text-[11px] font-mono text-muted-foreground flex items-center justify-between">
            <span className="text-muted-foreground/80">系统负载:</span>
            <span className="tnum font-medium text-foreground">
              {m?.load ? m.load.map((l) => l.toFixed(2)).join(" / ") : "— / — / —"}
            </span>
          </div>
        </div>

        {/* 卡片 2：实时物理内存与 Swap */}
        <div className="flex flex-col justify-between rounded-[2px] border border-border/70 bg-card/60 p-3 shadow-2xs transition-colors hover:border-border">
          <div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <Layers className="size-3.5 text-primary" />
                <span>物理内存占用</span>
              </span>
              <div className="text-right">
                <span className="font-mono text-sm font-bold text-foreground tnum">
                  {memPct !== null ? `${memPct.toFixed(1)}%` : "—"}
                </span>
                <span className="ml-1 text-[11px] font-mono text-muted-foreground">
                  ({m ? bytes(m.mem_used) : "—"} / {bytes(node.mem_total)})
                </span>
              </div>
            </div>

            {/* 动态微进度条 */}
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-[1px] bg-muted/80">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(0, memPct ?? 0))}%` }}
              />
            </div>
          </div>

          <div className="mt-3 border-t border-border/30 pt-2 text-[11px] font-mono text-muted-foreground flex items-center justify-between">
            <span className="text-muted-foreground/80">交换空间:</span>
            <span className="tnum font-medium text-foreground">
              {node.swap_total > 0
                ? `${m ? bytes(m.swap_used) : "—"} / ${bytes(node.swap_total)}${swapPct !== null ? ` (${swapPct.toFixed(0)}%)` : ""}`
                : "未启用"}
            </span>
          </div>
        </div>

        {/* 卡片 3：实时瞬时带宽与在线连接 */}
        <div className="flex flex-col justify-between rounded-[2px] border border-border/70 bg-card/60 p-3 shadow-2xs transition-colors hover:border-border">
          <div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <Activity className="size-3.5 text-primary" />
                <span>实时网络速率</span>
              </span>
              <div className="flex items-center gap-1.5 font-mono text-xs font-semibold tnum text-foreground">
                <span className="flex items-center gap-0.5 text-primary">
                  <ArrowDown className="size-3" />
                  {m ? rate(m.net_rx) : "—"}
                </span>
                <span className="text-border select-none">·</span>
                <span className="flex items-center gap-0.5 text-foreground/90">
                  <ArrowUp className="size-3" />
                  {m ? rate(m.net_tx) : "—"}
                </span>
              </div>
            </div>

            {/* 上下行速率相对占比；无采样或总速率为零时不填充 */}
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-[1px] bg-muted/80 flex gap-0.5">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{
                  width: `${m && m.net_rx + m.net_tx > 0 ? (m.net_rx / (m.net_rx + m.net_tx)) * 100 : 0}%`,
                }}
              />
              <div
                className="h-full bg-foreground/60 transition-all duration-300"
                style={{
                  width: `${m && m.net_rx + m.net_tx > 0 ? (m.net_tx / (m.net_rx + m.net_tx)) * 100 : 0}%`,
                }}
              />
            </div>
          </div>

          <div className="mt-3 border-t border-border/30 pt-2 text-[11px] font-mono text-muted-foreground flex items-center justify-between">
            <span className="text-muted-foreground/80">通信连接:</span>
            <span className="tnum font-medium text-foreground">
              {m ? `TCP ${m.tcp} · UDP ${m.udp}` : "—"}
            </span>
          </div>
        </div>

        {/* 卡片 4：实时磁盘存储与运行进程 */}
        <div className="flex flex-col justify-between rounded-[2px] border border-border/70 bg-card/60 p-3 shadow-2xs transition-colors hover:border-border">
          <div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <HardDrive className="size-3.5 text-primary" />
                <span>存储空间占用</span>
              </span>
              <div className="text-right">
                <span className="font-mono text-sm font-bold text-foreground tnum">
                  {diskPct !== null ? `${diskPct.toFixed(1)}%` : "—"}
                </span>
                <span className="ml-1 text-[11px] font-mono text-muted-foreground">
                  ({m ? bytes(m.disk_used) : "—"} / {bytes(node.disk_total)})
                </span>
              </div>
            </div>

            {/* 动态微进度条 */}
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-[1px] bg-muted/80">
              <div
                className={cn(
                  "h-full transition-all duration-300",
                  diskPct !== null && diskPct > 85 ? "bg-warn" : "bg-primary",
                )}
                style={{ width: `${Math.min(100, Math.max(0, diskPct ?? 0))}%` }}
              />
            </div>
          </div>

          <div className="mt-3 border-t border-border/30 pt-2 text-[11px] font-mono text-muted-foreground flex items-center justify-between">
            <span className="text-muted-foreground/80">系统进程 / 今日吞吐:</span>
            <span className="tnum font-medium text-foreground">
              {m ? `${m.procs} 进程` : "—"} · {bytes(node.day_rx + node.day_tx)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
