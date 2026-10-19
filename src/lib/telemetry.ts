import type { Node } from "./api.ts"

/** 后端历史桶以起始秒为时间戳，minutes 表示桶内实际有报告的分钟数。 */
export type MetricPoint = {
  ts: number
  cpu: number
  cpu_max?: number
  mem_used: number
  disk_used: number
  swap_used?: number
  net_rx: number
  net_tx: number
  net_rx_max?: number
  net_tx_max?: number
  tcp?: number
  udp?: number
  procs?: number
  minutes?: number
}

/** 按服务端桶时间去重、排序并限制到请求窗口；重复桶不重复累计。 */
export function windowMetrics(metrics: MetricPoint[], start: number, end: number, step: number) {
  const unique = new Map<number, MetricPoint>()
  for (const point of metrics) {
    if (!point || !Number.isFinite(point.ts) || point.ts >= end || point.ts + step <= start)
      continue
    // 图表与统计共用有效值，字符串、负数或非有限值不能进入坐标轴，也不能冒充零值。
    const cleaned = Object.fromEntries(
      Object.entries(point).filter(
        ([key, value]) =>
          key === "minutes" || (typeof value === "number" && Number.isFinite(value) && value >= 0),
      ),
    ) as MetricPoint
    if (
      cleaned.minutes !== undefined &&
      (!Number.isFinite(cleaned.minutes) || cleaned.minutes <= 0)
    )
      continue
    unique.set(point.ts, cleaned)
  }
  return [...unique.values()].sort((a, b) => a.ts - b.ts)
}

/** 仅计入桶与窗口重叠的观测时长；部分聚合桶只能按覆盖比例估算。 */
export function observedSeconds(
  point: { ts: number; minutes?: number },
  step: number,
  start: number,
  end: number,
  observationEnd = end,
) {
  const span = Math.max(0, Math.min(point.ts + step, end) - Math.max(point.ts, start))
  // 当前桶尚未结束，minutes 的分母应为已流逝时长，避免把正在采集误判为缺测。
  const elapsed = Math.max(0, Math.min(step, observationEnd - point.ts))
  const coverage =
    point.minutes === undefined
      ? 1
      : Number.isFinite(point.minutes) && elapsed > 0
        ? Math.min(1, Math.max(0, (point.minutes * 60) / elapsed))
        : 0
  return span * coverage
}

/** 各指标共用有效值筛选和时长权重，缺失值不视作零。 */
export function metricStats(
  rows: MetricPoint[],
  key: keyof MetricPoint,
  step: number,
  start: number,
  end: number,
  peakKey?: keyof MetricPoint,
  observationEnd = end,
) {
  let weighted = 0
  let seconds = 0
  let peak: number | null = null
  for (const row of rows) {
    const value = row[key]
    const weight = observedSeconds(row, step, start, end, observationEnd)
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || weight <= 0) continue
    weighted += value * weight
    seconds += weight
    const maximum = peakKey ? row[peakKey] : undefined
    peak = Math.max(
      peak ?? 0,
      value,
      typeof maximum === "number" && Number.isFinite(maximum) ? maximum : value,
    )
  }
  return {
    avg: seconds ? weighted / seconds : null,
    peak,
    seconds,
    integral: weighted,
  }
}

/** 套餐计量统一遵从服务端已用量，旧服务端按配置方向回退。 */
export function monthUsage(node: Node): number {
  if (typeof node.month_used === "number" && Number.isFinite(node.month_used))
    return node.month_used
  switch (node.traffic_mode) {
    case "up":
      return node.month_tx
    case "down":
      return node.month_rx
    case "max":
      return Math.max(node.month_rx, node.month_tx)
    default:
      return node.month_rx + node.month_tx
  }
}

/** 所有详情区域共享同一个滚动窗口，分桶覆盖整个窗口且不延伸至未来。 */
export function activityBuckets(rows: MetricPoint[], step: number, start: number, end: number) {
  const hours = (end - start) / 3600
  const count = hours <= 1 ? 12 : hours <= 24 ? 24 : Math.min(90, Math.ceil(hours / 24))
  const duration = (end - start) / count
  return Array.from({ length: count }, (_, index) => {
    const from = start + index * duration
    const to = from + duration
    const cpu = metricStats(rows, "cpu", step, from, to, "cpu_max", end)
    const rx = metricStats(rows, "net_rx", step, from, to, undefined, end)
    const tx = metricStats(rows, "net_tx", step, from, to, undefined, end)
    const fields = ["mem_used", "disk_used", "swap_used", "tcp", "udp", "procs"] as const
    const averages = Object.fromEntries(
      fields.map((key) => [key, metricStats(rows, key, step, from, to, undefined, end).avg]),
    ) as Record<(typeof fields)[number], number | null>
    return {
      ...averages,
      start: from,
      end: to,
      cpu: cpu.avg,
      peak: cpu.peak,
      rx: rx.avg,
      tx: tx.avg,
      rxBytes: rx.avg === null ? null : rx.integral,
      txBytes: tx.avg === null ? null : tx.integral,
      coverage: Math.min(
        100,
        (rows.reduce((sum, row) => sum + observedSeconds(row, step, from, to, end), 0) / duration) *
          100,
      ),
    }
  })
}

/** 分位数按已观测时长加权；描述历史桶均值的分布，不冒充原始瞬时采样分位数。 */
export function metricQuantile(
  rows: MetricPoint[],
  key: keyof MetricPoint,
  step: number,
  start: number,
  end: number,
  quantile: number,
): number | null {
  const values = rows
    .flatMap((row) => {
      const value = row[key]
      const weight = observedSeconds(row, step, start, end)
      return typeof value === "number" && Number.isFinite(value) && value >= 0 && weight > 0
        ? [{ value, weight }]
        : []
    })
    .sort((a, b) => a.value - b.value)
  const total = values.reduce((sum, point) => sum + point.weight, 0)
  if (!total) return null
  const target = total * Math.min(1, Math.max(0, quantile))
  let cumulative = 0
  for (const point of values) {
    cumulative += point.weight
    if (cumulative >= target) return point.value
  }
  return values.at(-1)!.value
}
