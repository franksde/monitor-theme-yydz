import type { Node } from "./api.ts"
import {
  calculateCosts,
  calculateExpiryRank,
  calculateNodeTypes,
  calculateUptimeSla,
  filterAndSortNodes,
  formatArch,
  formatVirt,
  getCycleMonths,
} from "./summary.ts"

let failed = 0
function eq(got: unknown, want: unknown, what: string) {
  const [a, b] = [JSON.stringify(got), JSON.stringify(want)]
  if (a !== b) {
    failed++
    console.error(`✗ ${what}\n    得到 ${a}\n    期望 ${b}`)
  }
}

// 基础节点构造辅助函数
function mockNode(overrides: Partial<Node> = {}): Node {
  return {
    id: 1,
    name: "test-node",
    sort: 0,
    public: true,
    online: true,
    country: "CN",
    last_seen: Date.now(),
    metrics: null,
    os: "Linux",
    kernel: "6.1.0",
    arch: "x86_64",
    virt: "kvm",
    cpu_name: "AMD EPYC",
    cpu_cores: 4,
    mem_total: 8 * 1024 ** 3,
    swap_total: 0,
    disk_total: 100 * 1024 ** 3,
    agent_version: "1.0.0",
    price: 0,
    currency: "CNY",
    billing_cycle: "monthly",
    expires_at: null,
    traffic_limit: 0,
    traffic_mode: "sum",
    traffic_reset_day: 1,
    total_rx: 0,
    total_tx: 0,
    month_rx: 0,
    month_tx: 0,
    month_start: "2026-10-01",
    day_rx: 0,
    day_tx: 0,
    ...overrides,
  }
}

// 1. 周期转换测试
eq(getCycleMonths("monthly"), 1, "monthly 为 1 个月")
eq(getCycleMonths("quarterly"), 3, "quarterly 为 3 个月")
eq(getCycleMonths("semiannual"), 6, "semiannual 为 6 个月")
eq(getCycleMonths("yearly"), 12, "yearly 为 12 个月")
eq(getCycleMonths("once"), 0, "once 为一次性 0")
eq(getCycleMonths("24m"), 24, "24m 为 24 个月")
eq(getCycleMonths("unknown"), 1, "未知周期兜底为 1 个月")

// 2. 费用汇总测试
const emptyCosts = calculateCosts([])
eq(emptyCosts.billableCount, 0, "空节点列表 0 台计费")
eq(emptyCosts.totalMonthly, 0, "空节点列表月付 0")

const freeCosts = calculateCosts([mockNode({ price: 0 })])
eq(freeCosts.billableCount, 0, "0 元节点不计入账单")

const mixedCosts = calculateCosts([
  mockNode({ id: 1, price: 10, currency: "CNY", billing_cycle: "monthly" }), // 10/月
  mockNode({ id: 2, price: 120, currency: "CNY", billing_cycle: "yearly" }), // 10/月
  mockNode({ id: 3, price: 30, currency: "CNY", billing_cycle: "quarterly" }), // 10/月
  mockNode({ id: 4, price: 200, currency: "CNY", billing_cycle: "once" }), // 买断 200
  mockNode({ id: 5, price: 5, currency: "USD", billing_cycle: "monthly" }), // 5 USD/月
])

eq(mixedCosts.billableCount, 5, "5 台计费节点")
eq(mixedCosts.primaryCurrency, "CNY", "主货币为 CNY")
eq(mixedCosts.totalMonthly, 30, "CNY 月付等效支出为 30")
eq(mixedCosts.totalAnnual, 360, "CNY 年付等效支出为 360")
eq(mixedCosts.totalOnce, 200, "CNY 一次性支出为 200")
eq(mixedCosts.breakdown.length, 2, "包含 CNY 和 USD 两个币种")
eq(mixedCosts.breakdown.find((b) => b.currency === "USD")?.monthly, 5, "USD 月付为 5")

// 3. 到期时间排行榜测试
const emptyExpiry = calculateExpiryRank([])
eq(emptyExpiry.list.length, 0, "空节点列表排行空")

const noDateExpiry = calculateExpiryRank([mockNode({ expires_at: null, expires_in: null })])
eq(noDateExpiry.list.length, 0, "未设到期日的不进入到期排行")

const rankedNodes = calculateExpiryRank([
  mockNode({ id: 1, name: "node-normal", expires_in: 30 }),
  mockNode({ id: 2, name: "node-expired", expires_in: -3 }),
  mockNode({ id: 3, name: "node-urgent", expires_in: 2 }),
  mockNode({ id: 4, name: "node-warn", expires_in: 6 }),
  mockNode({ id: 5, name: "node-forever", expires_in: null }),
])

eq(rankedNodes.list.length, 4, "4 台设置到期日的节点进入排行")
eq(rankedNodes.list[0].node.name, "node-expired", "最先过期排在第一")
eq(rankedNodes.list[1].node.name, "node-urgent", "剩2天排第二")
eq(rankedNodes.list[2].node.name, "node-warn", "剩6天排第三")
eq(rankedNodes.list[3].node.name, "node-normal", "剩30天排第四")
eq(rankedNodes.expiredCount, 1, "1 台已过期")
eq(rankedNodes.nearExpiryCount, 2, "2 台临期（2天和6天）")

// 4. 节点类型与架构测试
eq(formatVirt("kvm"), "KVM", "kvm -> KVM")
eq(formatVirt("lxc"), "LXC", "lxc -> LXC")
eq(formatVirt("none"), "物理机", "none -> 物理机")
eq(formatVirt(""), "物理机", "空串 -> 物理机")
eq(formatVirt("baremetal"), "物理机", "baremetal -> 物理机")

eq(formatArch("x86_64"), "x86_64", "x86_64 保持")
eq(formatArch("amd64"), "x86_64", "amd64 -> x86_64")
eq(formatArch("aarch64"), "arm64", "aarch64 -> arm64")
eq(formatArch("arm64"), "arm64", "arm64 保持")
eq(formatArch(""), "未知", "空架构 -> 未知")

const emptyTypes = calculateNodeTypes([])
eq(emptyTypes.virtList.length, 0, "空节点列表类型为空")
eq(emptyTypes.archList.length, 0, "空节点列表架构为空")

const nodeTypes = calculateNodeTypes([
  mockNode({ virt: "kvm", arch: "x86_64" }),
  mockNode({ virt: "kvm", arch: "aarch64" }),
  mockNode({ virt: "none", arch: "x86_64" }),
  mockNode({ virt: "lxc", arch: "amd64" }),
  mockNode({ virt: "lxc", arch: "arm64" }),
  mockNode({ virt: "lxc", arch: "arm64" }),
])

eq(nodeTypes.virtList[0], { name: "LXC", count: 3 }, "LXC 数量最多排第一 (3台)")
eq(nodeTypes.virtList[1], { name: "KVM", count: 2 }, "KVM 排第二 (2台)")
eq(nodeTypes.virtList[2], { name: "物理机", count: 1 }, "物理机排第三 (1台)")

eq(nodeTypes.archList[0], { name: "arm64", count: 3 }, "arm64 3台排第一")
eq(nodeTypes.archList[1], { name: "x86_64", count: 3 }, "x86_64 3台排第二")

// 5. 过滤与排序测试
const sampleNodes = [
  mockNode({ id: 1, name: "tokyo-kvm", online: true, metrics: { ...mockNode().metrics!, cpu: 20 } as any }),
  mockNode({ id: 2, name: "osaka-lxc", online: true, metrics: { ...mockNode().metrics!, cpu: 85 } as any }),
  mockNode({ id: 3, name: "us-offline", online: false, metrics: null }),
]

eq(filterAndSortNodes(sampleNodes, "", "online", "default").length, 2, "仅看在线过滤出 2 台")
eq(filterAndSortNodes(sampleNodes, "", "offline", "default").length, 1, "仅看离线过滤出 1 台")
eq(filterAndSortNodes(sampleNodes, "tokyo", "all", "default").length, 1, "搜索 tokyo 过滤出 1 台")
eq(filterAndSortNodes(sampleNodes, "none", "all", "default").length, 0, "不存在关键字返回 0 台")

const defaultSorted = filterAndSortNodes(sampleNodes, "", "all", "default")
eq(defaultSorted[0].name, "osaka-lxc", "默认排序按 name 字母排序，osaka-lxc 排第一")
eq(defaultSorted[1].name, "tokyo-kvm", "默认排序按 name 字母排序，tokyo-kvm 排第二")
eq(defaultSorted[2].name, "us-offline", "默认排序按 name 字母排序，us-offline 排第三")

const sortedByCpu = filterAndSortNodes(sampleNodes, "", "all", "cpu_desc")
eq(sortedByCpu[0].name, "osaka-lxc", "CPU 占用最高 85% 排最前")
eq(sortedByCpu[1].name, "tokyo-kvm", "CPU 占用 20% 排第二")
eq(sortedByCpu[2].name, "us-offline", "离线节点沉底排最后")

// 6. 在线率 SLA 测试
const emptySla = calculateUptimeSla([], 60, 6)
eq(emptySla.slaPct, 100, "空明细默认 100% SLA")

// 连续在线测试 (6小时，360个点全勤)
const fullMetrics = Array.from({ length: 360 }, (_, i) => ({
  ts: 1000000 + i * 60,
  minutes: 1,
}))
const perfectSla = calculateUptimeSla(fullMetrics, 60, 6, 48)
eq(perfectSla.slaPct, 100, "满额在线 100% SLA")
eq(perfectSla.segments.length, 48, "生成 48 个分段")
eq(perfectSla.segments.every((s) => s.status === "up"), true, "全部为健康 up")

// 离线断档测试 (6小时离线1小时，300分钟在线，60分钟空洞)
const gapMetrics: Array<{ ts: number; minutes: number }> = []
for (let i = 0; i < 360; i++) {
  if (i >= 60 && i < 120) continue // 模拟掉线 1 小时
  gapMetrics.push({ ts: 1000000 + i * 60, minutes: 1 })
}
const gapSla = calculateUptimeSla(gapMetrics, 60, 6, 48)
eq(gapSla.slaPct, 83.33, "6小时离线1小时计算出 83.33% SLA")
eq(gapSla.totalMinutes, 300, "实际在线分钟数 300")
eq(gapSla.expectedMinutes, 360, "期望总分钟数 360")
eq(gapSla.segments.some((s) => s.status === "down"), true, "离线断档时间段存在 down 标记")

if (failed) {
  console.error(`\nsummary 校验失败：${failed} 项不通过`)
  process.exit(1)
} else {
  console.log("summary 模块单元测试全部通过")
}

