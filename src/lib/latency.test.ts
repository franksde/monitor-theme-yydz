/**
 * 网络延迟与线路匹配单元测试
 * 遵循 Node.js 原生 assert 原则，不引入重型外部测试框架
 */

import assert from "node:assert/strict"
import {
  evaluateLatency,
  normalizePingData,
  pickPingRows,
  type ProbeLine,
} from "./latency.ts"

// 1. 延迟评级测试
assert.equal(evaluateLatency(25, 0), "ok")
assert.equal(evaluateLatency(120, 0), "warn")
assert.equal(evaluateLatency(50, 1.2), "warn")
assert.equal(evaluateLatency(240, 0), "bad")
assert.equal(evaluateLatency(30, 6.0), "bad")
assert.equal(evaluateLatency(null, 100), "down")

// 2. 归一化解析测试
const mockRaw = {
  ping: [
    { task_id: 1, ts: 1000, latency: 20 },
    { task_id: 1, ts: 2000, latency: 25 },
    { task_id: 2, ts: 1000, latency: 80 },
    { task_id: 2, ts: 2000, latency: null },
  ],
  probes: {
    "1": "上海电信",
    "2": "广州移动",
  },
  loss: {
    "1": 0,
    "2": 50,
  },
}

const parsed = normalizePingData(mockRaw)
assert.equal(parsed.length, 2)
assert.equal(parsed[0].name, "上海电信")
assert.equal(parsed[0].latestMs, 25)
assert.equal(parsed[0].loss, 0)
assert.equal(parsed[1].name, "广州移动")
assert.equal(parsed[1].latestMs, 80)
assert.equal(parsed[1].loss, 50)

// 3. 站长配置线路匹配测试
const allProbes: ProbeLine[] = [
  { id: 1, name: "上海电信", latestMs: 25, points: [], loss: 0 },
  { id: 2, name: "北京联通", latestMs: 35, points: [], loss: 0 },
  { id: 3, name: "广州移动", latestMs: 45, points: [], loss: 0 },
  { id: 4, name: "香港BGP", latestMs: 15, points: [], loss: 0 },
]

// 3.1 留空时默认取前 3 条
const defaultPick = pickPingRows(allProbes, "")
assert.equal(defaultPick.length, 3)
assert.equal(defaultPick[0].name, "上海电信")
assert.equal(defaultPick[1].name, "北京联通")
assert.equal(defaultPick[2].name, "广州移动")

// 3.2 换行指定条目与顺序
const customLines = pickPingRows(allProbes, "香港BGP\n上海电信")
assert.equal(customLines.length, 2)
assert.equal(customLines[0].name, "香港BGP")
assert.equal(customLines[1].name, "上海电信")

// 3.3 逗号/分号分隔与模糊匹配
const commaLines = pickPingRows(allProbes, "移动, 联通")
assert.equal(commaLines.length, 2)
assert.equal(commaLines[0].name, "广州移动")
assert.equal(commaLines[1].name, "北京联通")

// 3.4 不存在的条目被过滤
const missingLines = pickPingRows(allProbes, "不存在的线路\n上海电信")
assert.equal(missingLines.length, 1)
assert.equal(missingLines[0].name, "上海电信")

console.log("latency 模块单元测试全部通过")
