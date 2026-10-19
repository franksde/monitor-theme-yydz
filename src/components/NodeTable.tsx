/**
 * 节点表格列表视图（一行一台）
 * 同一指标在同一列，节点多时纵向一眼比出异常；作为卡片视图之外的「列表」切换。
 * 遵循 AGENT.md 规范：微倒角 rounded-[2px]、等宽数字、中文注释。
 */

import { useMemo } from "react"
import { ArrowDown, ArrowUp } from "lucide-react"

import { meterTone } from "@/components/Meter"
import { Country, deployed, expiryDays, expiryTone, trafficFoot } from "@/components/NodeCard"
import { LatencySparkline, latencyTone } from "@/components/LatencySection"
import type { Node } from "@/lib/api"
import { bytes, osName, pair, percent, rate, sinceSeen, uptime } from "@/lib/format"
import { pickPingRows, useNodeLatency } from "@/lib/latency"
import { cn } from "@/lib/utils"

// 节点 | 状态 | CPU | 内存 | 硬盘 | 网速 | 本月流量 | 延迟 | 到期
const COLUMNS =
  "grid grid-cols-[minmax(10rem,1.6fr)_6.5rem_repeat(3,minmax(5.5rem,1fr))_7.5rem_7.5rem_minmax(12rem,1.4fr)_4.5rem] gap-x-5"

/** 一格资源占用：百分比 | 细条 | 细节 */
function UsageCell({ pct, foot }: { pct: number | null; foot: string }) {
  const tone = meterTone(pct)
  const filled = pct === null ? 0 : Math.min(100, Math.max(0, pct))
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className={cn("tnum font-mono text-[13px] font-semibold", tone.text)}>
        {pct === null ? "—" : `${pct < 10 ? pct.toFixed(1) : pct.toFixed(0)}%`}
      </span>
      <div className="h-1 w-full overflow-hidden rounded-[1px] bg-muted/80">
        <div className={cn("h-full rounded-[1px] transition-[width] duration-500", tone.bar)} style={{ width: `${filled}%` }} />
      </div>
      <span className="tnum truncate whitespace-nowrap font-mono text-[10.5px] text-muted-foreground" title={foot}>
        {foot}
      </span>
    </div>
  )
}

/** 第一条延迟线路：数值 | 1 小时走势 | 丢包，下方线路名 */
function LatencyCell({ node, pingLines, enabled }: { node: Node; pingLines: string; enabled: boolean }) {
  const { lines } = useNodeLatency(node, enabled)
  const probe = useMemo(() => pickPingRows(lines || [], pingLines, 1)[0], [lines, pingLines])
  if (!enabled || !node.online || !probe) return <span className="text-xs text-muted-foreground">—</span>
  const { grade, msClass, lossClass } = latencyTone(probe.latestMs, probe.loss)
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <div className="grid grid-cols-[3.25rem_minmax(0,1fr)_2.5rem] items-center gap-2 font-mono text-xs">
        <span className={cn("tnum whitespace-nowrap", msClass)}>{probe.latestMs === null ? "超时" : `${probe.latestMs} ms`}</span>
        <LatencySparkline points={probe.points} grade={grade} />
        <span className={cn("tnum text-right", lossClass)}>{probe.loss.toFixed(1)}%</span>
      </div>
      <span className="truncate text-[10.5px] text-muted-foreground" title={probe.name}>
        {probe.name}
      </span>
    </div>
  )
}

/** 状态：指示灯 + 在线时长，离线显示离线多久 */
function StatusCell({ node }: { node: Node }) {
  const down = sinceSeen(node)
  const text = node.online
    ? node.metrics
      ? uptime(node.metrics.uptime)
      : "在线"
    : deployed(node)
      ? `离线 ${down >= 60 ? uptime(down) : ""}`.trim()
      : "未接入"
  return (
    <span
      className={cn(
        "tnum flex items-center gap-1.5 whitespace-nowrap font-mono text-xs",
        node.online ? "text-online" : "text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "size-1.5 shrink-0 rounded-[1px]",
          node.online ? "bg-online pulse-online" : deployed(node) ? "bg-offline" : "bg-muted-foreground/40",
        )}
      />
      {text}
    </span>
  )
}

function ExpiryCell({ node }: { node: Node }) {
  const days = expiryDays(node)
  if (days === null) return <span className="text-right text-xs text-muted-foreground">永久</span>
  return (
    <span className={cn("tnum whitespace-nowrap text-right text-xs", expiryTone(days))}>
      {days < 0 ? `过期 ${-days} 天` : days === 0 ? "今日" : `${days} 天`}
    </span>
  )
}

function Row({
  node,
  showLatency,
  pingLines,
  onOpen,
}: {
  node: Node
  showLatency: boolean
  pingLines: string
  onOpen: () => void
}) {
  const m = node.metrics
  const ready = deployed(node)
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen())}
      className={cn(
        COLUMNS,
        "cursor-pointer items-center border-b border-border/40 px-4 py-3 transition-colors last:border-b-0 hover:bg-muted/40",
        !node.online && "opacity-60 hover:opacity-90",
      )}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-2">
          <Country node={node} />
          <span className="truncate text-sm font-semibold tracking-tight" title={node.name}>
            {node.name}
          </span>
        </div>
        <span className="truncate text-[11px] text-muted-foreground">
          {node.os
            ? [osName(node.os), node.virt !== "none" && node.virt, node.arch].filter(Boolean).join(" · ")
            : "等待首次上报"}
        </span>
      </div>
      <StatusCell node={node} />
      <UsageCell pct={m ? m.cpu : null} foot={ready ? `${node.cpu_cores} 核` : "—"} />
      <UsageCell
        pct={m ? percent(m.mem_used, m.mem_total) : null}
        foot={m ? pair(m.mem_used, m.mem_total) : ready ? bytes(node.mem_total) : "—"}
      />
      <UsageCell
        pct={m ? percent(m.disk_used, m.disk_total) : null}
        foot={m ? pair(m.disk_used, m.disk_total) : ready ? bytes(node.disk_total) : "—"}
      />
      <div className="tnum flex flex-col gap-0.5 whitespace-nowrap font-mono text-xs">
        <span className="inline-flex items-center gap-1">
          <ArrowDown className="size-3 text-muted-foreground" />
          {m ? rate(m.net_rx) : "—"}
        </span>
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <ArrowUp className="size-3" />
          {m ? rate(m.net_tx) : "—"}
        </span>
      </div>
      <span className="tnum truncate whitespace-nowrap font-mono text-xs text-foreground/85" title={trafficFoot(node)}>
        {ready ? trafficFoot(node) : "—"}
      </span>
      <LatencyCell node={node} pingLines={pingLines} enabled={showLatency} />
      <ExpiryCell node={node} />
    </div>
  )
}

export function NodeTable({
  nodes,
  showLatency,
  pingLines,
  onOpen,
}: {
  nodes: Node[]
  showLatency: boolean
  pingLines: string
  onOpen: (id: number) => void
}) {
  return (
    // 窄屏横向滚动，不压扁列
    <div className="overflow-x-auto rounded-[2px] border border-border/80 bg-card shadow-2xs">
      <div className="min-w-[68rem]">
        <div
          className={cn(
            COLUMNS,
            "border-b border-border/70 bg-muted/30 px-4 py-2.5 text-[11px] font-medium text-muted-foreground",
          )}
        >
          <span>节点</span>
          <span>状态</span>
          <span>CPU</span>
          <span>内存</span>
          <span>硬盘</span>
          <span>网速 ↓ / ↑</span>
          <span>本月流量</span>
          <span>{showLatency ? "延迟 · 1H" : ""}</span>
          <span className="text-right">到期</span>
        </div>
        {nodes.map((n) => (
          <Row key={n.id} node={n} showLatency={showLatency} pingLines={pingLines} onOpen={() => onOpen(n.id)} />
        ))}
      </div>
    </div>
  )
}
