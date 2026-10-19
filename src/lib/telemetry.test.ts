import assert from "node:assert/strict"
import {
  activityBuckets,
  metricStats,
  metricQuantile,
  monthUsage,
  observedSeconds,
  windowMetrics,
  type MetricPoint,
} from "./telemetry.ts"
import type { Node } from "./api.ts"

/** 非均匀覆盖时长、窗口裁剪、重复桶及缺失指标的统计回归。 */
const rows: MetricPoint[] = [
  {
    ts: 1000,
    cpu: 10,
    cpu_max: 90,
    mem_used: 20,
    disk_used: 30,
    net_rx: 0,
    net_tx: 20,
    minutes: 1,
    tcp: 0,
  },
  {
    ts: 4600,
    cpu: 50,
    cpu_max: 70,
    mem_used: 40,
    disk_used: 35,
    net_rx: 100,
    net_tx: 40,
    minutes: 3,
  },
]
const cpu = metricStats(rows, "cpu", 3600, 1000, 8200, "cpu_max")
assert.equal(cpu.avg, 40)
assert.equal(cpu.peak, 90)
assert.equal(cpu.seconds, 240)
assert.equal(metricStats(rows, "tcp", 3600, 1000, 8200).avg, 0)
assert.equal(metricStats(rows, "udp", 3600, 1000, 8200).avg, null)
assert.equal(metricStats(rows, "net_rx", 3600, 1000, 8200).integral, 18000)
assert.equal(observedSeconds(rows[0], 3600, 2800, 4600), 30)
assert.equal(windowMetrics([rows[1], rows[0], rows[0]], 1000, 8200, 3600).length, 2)
assert.equal(windowMetrics(rows, 1000, 2000, 3600)[0].ts, 1000)

/** 分桶严格覆盖请求边界，适配任意天数与部分小时桶。 */
for (const hours of [1, 6, 24, 168, 336, 720, 2160]) {
  const end = 1800000000
  const buckets = activityBuckets([], 60, end - hours * 3600, end)
  assert.equal(buckets[0].start, end - hours * 3600)
  assert.equal(buckets[buckets.length - 1].end, end)
  assert.equal(
    buckets.every((bucket) => bucket.cpu === null && bucket.rx === null),
    true,
  )
}
const buckets = activityBuckets(rows, 3600, 1000, 8200)
assert.equal(buckets.filter((bucket) => bucket.cpu !== null).length, 24)
assert.equal(
  buckets.reduce((sum, bucket) => sum + (bucket.coverage / 100) * (bucket.end - bucket.start), 0),
  240,
)

/** 计费优先采用服务端结算值，旧服务端按套餐方向回退。 */
const node = { month_rx: 100, month_tx: 60 } as Node
for (const [mode, expected] of [
  ["up", 60],
  ["down", 100],
  ["max", 100],
  ["sum", 160],
] as const) {
  assert.equal(monthUsage({ ...node, traffic_mode: mode }), expected)
}
assert.equal(monthUsage({ ...node, month_used: 0, traffic_mode: "sum" }), 0)
assert.equal(monthUsage({ ...node, month_used: 42, traffic_mode: "sum" }), 42)
/** 当前尚未结束的桶按已流逝时长分配，分时积分应与总积分一致。 */
const liveBucket = { ...rows[0], ts: 1000, minutes: 1 }
assert.equal(observedSeconds(liveBucket, 3600, 1000, 1030), 30)
assert.equal(observedSeconds(liveBucket, 3600, 1015, 1030, 1030), 15)
const liveBuckets = activityBuckets([liveBucket], 3600, 970, 1030)
assert.equal(
  liveBuckets.reduce(
    (sum, bucket) => sum + (bucket.coverage / 100) * (bucket.end - bucket.start),
    0,
  ),
  30,
)
assert.equal(
  liveBuckets.reduce((sum, bucket) => sum + (bucket.txBytes ?? 0), 0),
  600,
)
assert.equal(metricQuantile(rows, "cpu", 3600, 1000, 8200, 0.5), 50)
assert.equal(metricQuantile(rows, "cpu", 3600, 1000, 8200, 0.1), 10)
assert.equal(metricQuantile([], "cpu", 60, 1000, 8200, 0.95), null)
assert.equal(metricQuantile(rows, "udp", 3600, 1000, 8200, 0.95), null)
const invalid = { ...rows[0], cpu: NaN, tcp: -1, mem_used: "bad" } as unknown as MetricPoint
const cleaned = windowMetrics([invalid], 1000, 8200, 3600)[0]
assert.equal(cleaned.cpu, undefined)
assert.equal(cleaned.tcp, undefined)
assert.equal(cleaned.mem_used, undefined)
assert.equal(windowMetrics([{ ...rows[0], minutes: 0 }], 1000, 8200, 3600).length, 0)
console.log("telemetry 统计回归校验通过")
