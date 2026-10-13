import type { Node } from "./api.ts"
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
  const primary = breakdown[0] ?? { currency: "CNY", monthly: 0, once: 0, count: 0 }

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
