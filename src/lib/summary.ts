import type { Node } from "./api.ts"
import { observedSeconds } from "./telemetry.ts"
import { daysUntil } from "./format.ts"

/**
 * 计费周期映射表（周期名称转换为月数）
 */
export const NAMED_CYCLES: Record<string, number> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  yearly: 12,
  biennial: 24,
  triennial: 36,
}

/**
 * 获取计费周期对应的月数
 * 一次性套餐返回 0
 */
export function getCycleMonths(billing: string): number {
  if (billing === "once") return 0
  const months = NAMED_CYCLES[billing] ?? Number(/^(\d+)m$/.exec(billing)?.[1])
  return months && months > 0 ? months : 1
}

/**
 * 费用明细数据结构
 */
export type CostSummary = {
  primaryCurrency: string
  totalMonthly: number
  totalAnnual: number
  totalOnce: number
  billableCount: number
  breakdown: Array<{
    currency: string
    monthly: number
    once: number
    count: number
  }>
}

/**
 * 汇总计算所有节点的费用支出（折算等效月付、年付与一次性买断）
 */
export function calculateCosts(nodes: Node[]): CostSummary {
  const map = new Map<string, { monthly: number; once: number; count: number }>()
  let billableCount = 0

  for (const n of nodes) {
    if (typeof n.price === "number" && n.price > 0) {
      billableCount++
      const currency = (n.currency || "CNY").toUpperCase().trim()
      const curr = map.get(currency) ?? { monthly: 0, once: 0, count: 0 }

      if (n.billing_cycle === "once") {
        curr.once += n.price
      } else {
        const m = getCycleMonths(n.billing_cycle)
        curr.monthly += n.price / m
      }
      curr.count++
      map.set(currency, curr)
    }
  }

  const breakdown = Array.from(map.entries()).map(([currency, data]) => ({
    currency,
    monthly: data.monthly,
    once: data.once,
    count: data.count,
  }))

  // 按月付总额降序排列，主货币排第一
  breakdown.sort((a, b) => b.monthly - a.monthly || b.count - a.count)
  const primary = breakdown[0] ?? {
    currency: "CNY",
    monthly: 0,
    once: 0,
    count: 0,
  }

  return {
    primaryCurrency: primary.currency,
    totalMonthly: primary.monthly,
    totalAnnual: primary.monthly * 12,
    totalOnce: primary.once,
    billableCount,
    breakdown,
  }
}

/**
 * 到期排行项数据结构
 */
export type ExpiryItem = {
  node: Node
  days: number
}

/**
 * 到期排行汇总数据结构
 */
export type ExpirySummary = {
  list: ExpiryItem[]
  expiredCount: number
  nearExpiryCount: number
}

/**
 * 汇总计算节点到期时间排行榜（按紧迫程度升序排序）
 */
export function calculateExpiryRank(nodes: Node[]): ExpirySummary {
  const withExpiry = nodes
    .map((node) => {
      const days = node.expires_in !== undefined ? node.expires_in : daysUntil(node.expires_at)
      return { node, days }
    })
    .filter((item): item is ExpiryItem => item.days !== null)

  // 升序排列：负数（已过期）最前，接着是最近到期节点
  withExpiry.sort((a, b) => a.days - b.days)

  const expiredCount = withExpiry.filter((item) => item.days < 0).length
  const nearExpiryCount = withExpiry.filter((item) => item.days >= 0 && item.days <= 7).length

  return {
    list: withExpiry,
    expiredCount,
    nearExpiryCount,
  }
}

/**
 * 标准化虚拟化/节点类型名称
 */
export function formatVirt(virt?: string): string {
  if (!virt || virt === "none" || virt === "baremetal") return "物理机"
  const upper = virt.toUpperCase()
  if (upper === "KVM") return "KVM"
  if (upper === "LXC") return "LXC"
  if (upper === "OPENVZ") return "OpenVZ"
  if (upper === "VMWARE") return "VMware"
  if (upper === "HYPERV") return "Hyper-V"
  if (upper === "XEN") return "Xen"
  if (upper === "QEMU") return "QEMU"
  if (upper === "DOCKER") return "Docker"
  return upper
}

/**
 * 标准化 CPU 架构名称
 */
export function formatArch(arch?: string): string {
  if (!arch) return "未知"
  const lower = arch.toLowerCase()
  if (lower === "x86_64" || lower === "amd64") return "x86_64"
  if (lower === "aarch64" || lower === "arm64") return "arm64"
  if (lower === "i386" || lower === "i686" || lower === "x86") return "x86"
  if (lower.startsWith("arm")) return "arm"
  if (lower === "riscv64") return "riscv64"
  if (lower === "s390x") return "s390x"
  return arch
}

export type StatItem = {
  name: string
  count: number
}

export type NodeTypesSummary = {
  virtList: StatItem[]
  archList: StatItem[]
}

/**
 * 汇总统计节点的虚拟化类型与架构分布
 */
export function calculateNodeTypes(nodes: Node[]): NodeTypesSummary {
  const virtMap = new Map<string, number>()
  const archMap = new Map<string, number>()

  for (const n of nodes) {
    const virt = formatVirt(n.virt)
    virtMap.set(virt, (virtMap.get(virt) ?? 0) + 1)

    const arch = formatArch(n.arch)
    archMap.set(arch, (archMap.get(arch) ?? 0) + 1)
  }

  // 按数量从多到少排序，相同则按名称排序
  const virtList = Array.from(virtMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))

  const archList = Array.from(archMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))

  return { virtList, archList }
}

export type SortMode =
  "default" | "cpu_desc" | "mem_desc" | "net_desc" | "expires_asc" | "traffic_desc"

export type FilterStatus = "all" | "online" | "offline"

/**
 * 多维节点过滤与动态排序算法
 */
export function filterAndSortNodes(
  nodes: Node[],
  search: string,
  status: FilterStatus,
  sort: SortMode,
  offlinePlacement = "default",
): Node[] {
  // 1. 在线状态过滤
  let result = nodes
  if (status === "online") {
    result = result.filter((n) => n.online)
  } else if (status === "offline") {
    result = result.filter((n) => !n.online)
  }

  // 2. 关键字全文检索
  const q = search.trim().toLowerCase()
  if (q) {
    result = result.filter((n) => {
      const matchName = n.name.toLowerCase().includes(q)
      const matchGroup = n.group ? n.group.toLowerCase().includes(q) : false
      const matchCountry = n.country ? n.country.toLowerCase().includes(q) : false
      const matchArch = n.arch ? n.arch.toLowerCase().includes(q) : false
      const matchVirt = n.virt ? n.virt.toLowerCase().includes(q) : false
      const matchCpu = n.cpu_name ? n.cpu_name.toLowerCase().includes(q) : false
      const matchRemark = n.remark ? n.remark.toLowerCase().includes(q) : false
      const matchPublicRemark = (n as Node & { public_remark?: string }).public_remark
        ? (n as Node & { public_remark?: string }).public_remark!.toLowerCase().includes(q)
        : false
      const matchIp = n.ip ? n.ip.toLowerCase().includes(q) : false
      const matchOs = n.os ? n.os.toLowerCase().includes(q) : false

      return (
        matchName ||
        matchGroup ||
        matchCountry ||
        matchArch ||
        matchVirt ||
        matchCpu ||
        matchRemark ||
        matchPublicRemark ||
        matchIp ||
        matchOs
      )
    })
  }

  // 3. 指标多维排序（默认使用节点 name 字符自然排序）
  if (sort === "default") {
    const compareByName = (a: Node, b: Node) =>
      a.name.localeCompare(b.name, undefined, { numeric: true }) || a.id - b.id

    if (offlinePlacement === "bottom") {
      const online = result.filter((n) => n.online).sort(compareByName)
      const offline = result.filter((n) => !n.online).sort(compareByName)
      result = [...online, ...offline]
    } else {
      result = [...result].sort(compareByName)
    }
  } else {
    result = [...result].sort((a, b) => {
      // 离线节点始终沉底
      if (a.online !== b.online) {
        return a.online ? -1 : 1
      }
      switch (sort) {
        case "cpu_desc":
          return (b.metrics?.cpu ?? -1) - (a.metrics?.cpu ?? -1)
        case "mem_desc": {
          const aMem = a.metrics && a.mem_total > 0 ? a.metrics.mem_used / a.mem_total : -1
          const bMem = b.metrics && b.mem_total > 0 ? b.metrics.mem_used / b.mem_total : -1
          return bMem - aMem
        }
        case "net_desc": {
          const aNet = (a.metrics?.net_rx ?? 0) + (a.metrics?.net_tx ?? 0)
          const bNet = (b.metrics?.net_rx ?? 0) + (b.metrics?.net_tx ?? 0)
          return bNet - aNet
        }
        case "expires_asc": {
          const aDays = a.expires_in !== undefined ? a.expires_in : daysUntil(a.expires_at)
          const bDays = b.expires_in !== undefined ? b.expires_in : daysUntil(b.expires_at)
          if (aDays === null && bDays === null) return 0
          if (aDays === null) return 1
          if (bDays === null) return -1
          return aDays - bDays
        }
        case "traffic_desc": {
          const aTraffic = a.month_rx + a.month_tx
          const bTraffic = b.month_rx + b.month_tx
          return bTraffic - aTraffic
        }
        default:
          return 0
      }
    })
  }

  return result
}

export type UptimeSlaSegment = {
  ts: number
  startTs: number
  endTs: number
  minutes: number
  expected: number
  status: "up" | "degraded" | "down"
  pct: number
}

export type UptimeSlaSummary = {
  slaPct: number
  totalMinutes: number
  expectedMinutes: number
  segments: UptimeSlaSegment[]
}

/**
 * 估算遥测覆盖率：按桶与分段的交集分配在线分钟，共享分母并去重。
 * 小时聚合仅保存覆盖分钟总量，无法恢复桶内准确的失联时刻，因此分段为均匀分配估算。
 */
export function calculateUptimeSla(
  metrics: Array<{ ts: number; minutes?: number }>,
  step = 60,
  hours = 24,
  segmentCount = 48,
  nowTs = Math.floor(Date.now() / 1000),
): UptimeSlaSummary {
  if (
    !Number.isFinite(hours) ||
    hours <= 0 ||
    !Number.isFinite(step) ||
    step <= 0 ||
    !Number.isInteger(segmentCount) ||
    segmentCount <= 0
  ) {
    return { slaPct: 0, totalMinutes: 0, expectedMinutes: 0, segments: [] }
  }
  const start = nowTs - hours * 3600
  const rows = [
    ...new Map(metrics.filter((p) => Number.isFinite(p.ts)).map((p) => [p.ts, p])).values(),
  ].sort((a, b) => a.ts - b.ts)
  const duration = (hours * 3600) / segmentCount
  const segments: UptimeSlaSegment[] = Array.from({ length: segmentCount }, (_, i) => {
    const from = start + i * duration
    const to = from + duration
    let minutes = 0
    for (let j = 0; j < rows.length; j++) {
      const p = rows[j]
      // 重叠桶截断到下一桶起点，避免异常返回导致同一时间重复计时。
      const bucketEnd = Math.min(p.ts + step, rows[j + 1]?.ts ?? Infinity)
      minutes += observedSeconds(p, step, from, Math.min(to, bucketEnd, nowTs), nowTs) / 60
    }
    const expected = duration / 60
    minutes = Math.min(expected, minutes)
    const pct = (minutes / expected) * 100
    return {
      ts: from,
      startTs: from,
      endTs: to,
      minutes,
      expected,
      pct,
      status: pct === 0 ? "down" : pct < 85 ? "degraded" : "up",
    }
  })
  const totalMinutes = segments.reduce((sum, seg) => sum + seg.minutes, 0)
  const expectedMinutes = hours * 60
  return {
    slaPct: Number(((totalMinutes / expectedMinutes) * 100).toFixed(2)),
    totalMinutes,
    expectedMinutes,
    segments,
  }
}
