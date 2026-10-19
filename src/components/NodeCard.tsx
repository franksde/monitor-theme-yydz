import type { CSSProperties } from "react"
import { ArrowDown, ArrowUp } from "lucide-react"
import {
  siAlmalinux, siAlpinelinux, siArchlinux, siCentos, siDebian, siFedora, siLinux, siOpensuse, siRedhat,
  siRockylinux, siUbuntu, type SimpleIcon,
} from "simple-icons"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Meter, MeterText } from "@/components/Meter"
import { LatencySection } from "@/components/LatencySection"
import type { Node } from "@/lib/api"
import { bytes, daysUntil, FOREVER, osName, pair, percent, rate, sinceSeen, uptime } from "@/lib/format"
import { cn } from "@/lib/utils"
import { monthUsage } from "@/lib/telemetry"

import { FLAGS } from "@/lib/flags"

// Matched against the whole release name, since "Red Hat Enterprise Linux" and
// "Raspbian GNU/Linux" do not lead with one word to key on. The distributions a
// VPS ships with; the rest take the penguin. Each logo costs 1-6 KB of entry
// bundle, so the list stays at what hosts offer.
const DISTROS: [string, SimpleIcon][] = [
  ["debian", siDebian], ["raspbian", siDebian], ["ubuntu", siUbuntu], ["alpine", siAlpinelinux],
  ["centos", siCentos], ["rocky", siRockylinux], ["almalinux", siAlmalinux], ["red hat", siRedhat],
  ["fedora", siFedora], ["arch", siArchlinux], ["opensuse", siOpensuse],
]

// A node that has reported once has told the hub its shape -- cores, memory,
// disk -- and the hub retains its traffic totals whether connected or not. A node
// that never connected is the only case with nothing to show.
function deployed(node: Node) {
  return node.cpu_cores > 0 || node.mem_total > 0
}

/**
 * The dot plus how long the machine has been up, or once it is gone, how long it
 * has been absent -- the first question asked of an offline node. Both are
 * durations, so the badge keeps its shape either way.
 */
/**
 * 节点在线状态徽标
 * 遵循 AGENT.md 规范：指示灯采用微倒角 rounded-[1px]，在线时呈现呼吸辉光，离线时呈现沉稳微暗色
 */
export function Status({ node }: { node: Node }) {
  const down = sinceSeen(node)
  const label = node.online
    ? `在线 ${node.metrics ? uptime(node.metrics.uptime) : ""}`
    : deployed(node)
      ? `离线 ${down >= 60 ? uptime(down) : ""}`
      : "未接入"
  return (
    <Badge
      className={cn(
        "tnum shrink-0 gap-1.5 whitespace-nowrap font-normal tracking-tight transition-all duration-150",
        !node.online && "text-muted-foreground opacity-80"
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-[1px] transition-all",
          node.online
            ? "bg-online pulse-online"
            : deployed(node)
              ? "bg-offline"
              : "bg-muted-foreground/40",
        )}
      />
      {label.trim()}
    </Badge>
  )
}

/** 节点所在地国家/地区旗帜（微倒角 rounded-[2px]） */
export function Country({ node }: { node: Node }) {
  if (!node.country) return null
  const src = FLAGS[node.country]
  if (!src) {
    return (
      <Badge className="shrink-0 font-normal text-muted-foreground">
        {node.country}
      </Badge>
    )
  }
  return (
    <img
      src={src}
      alt={node.country}
      title={node.country}
      className="h-3 w-4.5 shrink-0 rounded-[2px] shadow-2xs ring-1 ring-foreground/10"
    />
  )
}

/** 操作系统发行版图标 */
function OsIcon({ os }: { os: string }) {
  const name = os.toLowerCase()
  const icon = DISTROS.find(([key]) => name.includes(key))?.[1] ?? siLinux
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      style={{ "--brand": `#${icon.hex}` } as CSSProperties}
      className="size-3 shrink-0 fill-(--brand) dark:fill-[color-mix(in_oklab,var(--brand)_60%,white)]"
    >
      <title>{osName(os)}</title>
      <path d={icon.path} />
    </svg>
  )
}

// 流量使用计算与格式化
function trafficFoot(node: Node) {
  return node.traffic_limit > 0
    ? pair(monthUsage(node), node.traffic_limit)
    : `${bytes(monthUsage(node))} / ${FOREVER}`
}

/** 到期日指示器：过期标红，临期预警，永久显示无限符号 */
function Expiry({ node }: { node: Node }) {
  const days = node.expires_in !== undefined ? node.expires_in : daysUntil(node.expires_at)
  if (days === null) return <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground" title="永不到期">{FOREVER}</span>
  const tone = days <= 3 ? "text-destructive font-semibold" : days <= 7 ? "text-warn font-semibold" : "text-muted-foreground"
  return (
    <span className={cn("tnum shrink-0 whitespace-nowrap text-xs transition-colors", tone)}>
      {days < 0 ? `已过期 ${-days} 天` : days === 0 ? "今日到期" : `${days} 天后到期`}
    </span>
  )
}

/**
 * 节点卡片组件
 * 遵循 AGENT.md 规范：采用微倒角 rounded-[2px]，具备微提升发光 Hover 动效与平滑过渡
 */
export function NodeCard({
  node,
  showLatency = true,
  pingLines = "",
  onOpen,
}: {
  node: Node
  showLatency?: boolean
  pingLines?: string
  onOpen: () => void
}) {
  const m = node.metrics

  return (
    <Card
      onClick={onOpen}
      className={cn(
        "group flex h-full flex-col justify-between min-w-0 cursor-pointer gap-0 rounded-[2px] border border-border/80 bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/40 hover:shadow-md active:translate-y-0",
        !node.online && "opacity-60 hover:opacity-90",
      )}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen())}
    >
      <div>
        {/* 头部：节点名称、国家与状态 */}
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-1.5">
              <Country node={node} />
              <h3 className="truncate font-semibold tracking-tight transition-colors group-hover:text-foreground" title={node.name}>
                {node.name}
              </h3>
            </div>
            <Status node={node} />
          </div>
          {/* 系统信息与到期时间同一行 */}
          <div className="flex min-w-0 items-center justify-between gap-3 text-xs text-muted-foreground">
            <p className="flex min-w-0 items-center gap-1.5">
              {node.os && <OsIcon os={node.os} />}
              <span className="truncate">
                {node.os
                  ? [node.virt !== "none" && node.virt, node.arch].filter(Boolean).join(" · ")
                  : "等待首次上报"}
              </span>
            </p>
            <Expiry node={node} />
          </div>
        </div>

        {/* 资源指标度量网格：不论已部署还是待接入，均保持对齐网格结构 */}
        {deployed(node) ? (
          <div className="mt-4 flex flex-col gap-2.5">
            <Meter
              label="CPU"
              pct={m ? m.cpu : null}
              foot={`${node.cpu_cores} 核 · 负载 ${m ? m.load.map((n) => n.toFixed(2)).join(" ") : "—"}`}
            />
            <Meter
              label="内存"
              pct={m ? percent(m.mem_used, m.mem_total) : null}
              foot={m ? pair(m.mem_used, m.mem_total) : bytes(node.mem_total)}
            />
            <Meter
              label="硬盘"
              pct={m ? percent(m.disk_used, m.disk_total) : null}
              foot={m ? pair(m.disk_used, m.disk_total) : bytes(node.disk_total)}
            />
            {node.traffic_limit > 0 ? (
              <Meter label="流量" pct={percent(monthUsage(node), node.traffic_limit)} foot={trafficFoot(node)} />
            ) : (
              <MeterText label="流量" value={trafficFoot(node)} />
            )}
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-2.5">
            <Meter label="CPU" pct={null} foot="未就绪" />
            <Meter label="内存" pct={null} foot="未就绪" />
            <Meter label="硬盘" pct={null} foot="未就绪" />
            <MeterText label="流量" value="未就绪" />
          </div>
        )}

        {/* 实时网速（主）与累计流量（次） */}
        <div className="mt-4 grid grid-cols-2 gap-x-4 border-t border-border/60 pt-3">
          {([
            ["下行", ArrowDown, m ? rate(m.net_rx) : "—", node.total_rx],
            ["上行", ArrowUp, m ? rate(m.net_tx) : "—", node.total_tx],
          ] as const).map(([label, Icon, now, total]) => (
            <div key={label} className="flex min-w-0 flex-col gap-0.5">
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <Icon className="size-3" />
                {label}
              </span>
              <span className="tnum truncate whitespace-nowrap font-mono text-sm font-semibold text-foreground">{now}</span>
              <span className="tnum truncate whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                累计 {deployed(node) ? bytes(total) : "—"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 底部功能区：网络延迟测试条目或接入指引（高度严格对齐） */}
      {deployed(node) ? (
        <LatencySection node={node} pingLines={pingLines} enabled={showLatency} />
      ) : showLatency ? (
        <div className="mt-3.5 space-y-1.5 border-t border-border/60 pt-2.5">
          <div className="flex items-center justify-between text-xs font-mono font-medium text-muted-foreground pb-0.5">
            <span>接入状态</span>
            <span>配置指引</span>
          </div>
          <div className="flex h-[76px] items-center justify-center rounded-[2px] border border-dashed border-border/60 bg-muted/15 px-3 text-center text-xs leading-relaxed text-muted-foreground">
            <span>主机尚未接入 · 请在后台获取命令并在主机执行</span>
          </div>
        </div>
      ) : (
        <div className="mt-3 border-t border-border/50 pt-2 text-xs leading-relaxed text-muted-foreground">
          <span>主机尚未接入 · 请在后台获取命令并在主机执行</span>
        </div>
      )}
    </Card>
  )
}
