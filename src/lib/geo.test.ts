/**
 * 地理投影与节点拓扑单元测试
 * 遵循无需额外测试框架的原则，直接使用 Node.js 原生 assert
 */

import assert from "node:assert/strict"
import {
  clampLat,
  normalizeLng,
  projectOrthographic,
  resolveNodeGeo,
  summarizeRegions,
  generateContinentPaths,
  generateGraticulePaths,
  projectFlat,
  generateFlatLandGeometry,
  generateFlatGraticules,
  getClusterOffsets,
  projectNodesWithClustering,
  getBeaconBrightness,
  projectRegionBeacons,
} from "./geo.ts"
import type { Node } from "./api.ts"

// 1. 经纬度折叠与限制测试
assert.equal(normalizeLng(0), 0)
assert.equal(normalizeLng(180), 180)
assert.equal(normalizeLng(-180), -180)
assert.equal(normalizeLng(190), -170)
assert.equal(normalizeLng(-190), 170)
assert.equal(normalizeLng(360), 0)

assert.equal(clampLat(0), 0)
assert.equal(clampLat(90), 80)
assert.equal(clampLat(-95), -80)

// 2. 正射投影计算测试
// 球心正对 (0, 0) 时，(0, 0) 应投影在中心 (cx=250, cy=140)，且深度 z ≈ 1
const centerPt = projectOrthographic(0, 0, 0, 0, 100, 250, 140)
assert.equal(centerPt.visible, true)
assert.ok(Math.abs(centerPt.x - 250) < 0.001)
assert.ok(Math.abs(centerPt.y - 140) < 0.001)
assert.ok(centerPt.z > 0.99)

// 球心 (0, 0) 时，背面 (180, 0) 应该不可见
const backPt = projectOrthographic(180, 0, 0, 0, 100, 250, 140)
assert.equal(backPt.visible, false)
assert.ok(backPt.z < 0)

// 3. 节点地理识别与城市线索测试
const mockNodeA: Node = {
  id: 1,
  name: "Tokyo-Edge-01",
  country: "JP",
  sort: 1,
  public: true,
  online: true,
  last_seen: 1000,
  metrics: null,
  os: "linux",
  kernel: "6.1",
  arch: "x86_64",
  virt: "kvm",
  cpu_name: "AMD",
  cpu_cores: 4,
  mem_total: 8000,
  swap_total: 0,
  disk_total: 100000,
  agent_version: "1.0",
  price: 0,
  currency: "USD",
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
}

const geoA = resolveNodeGeo(mockNodeA, 0)
assert.ok(geoA !== null)
assert.equal(geoA.city, "Tokyo")
assert.equal(geoA.country, "JP")

// 无城市名，国家兜底
const mockNodeB: Node = { ...mockNodeA, id: 2, name: "Node-DE", country: "DE" }
const geoB = resolveNodeGeo(mockNodeB, 0)
assert.ok(geoB !== null)
assert.equal(geoB.country, "DE")

// 4. 地区汇总测试
const summary = summarizeRegions([mockNodeA, mockNodeB])
assert.equal(summary.length, 2)
assert.ok(summary.some((s) => s.country === "JP"))
assert.ok(summary.some((s) => s.country === "DE"))

// 5. 经纬网与大陆轮廓生成
const graticules = generateGraticulePaths(0, 0)
assert.ok(graticules.length > 0)
assert.ok(graticules[0].startsWith("M"))

const continents = generateContinentPaths(0, 0)
assert.ok(continents.length > 0)
assert.ok(continents[0].startsWith("M"))

// 6. 平面世界地图投影与几何测试
const flatCenter = projectFlat(0, 0, 800, 400)
assert.ok(Math.abs(flatCenter.x - 400) < 0.001)
assert.ok(Math.abs(flatCenter.y - 200) < 0.001)

const flatEastEdge = projectFlat(180, 0, 800, 400)
assert.ok(Math.abs(flatEastEdge.x - 800) < 0.001)

const flatWestEdge = projectFlat(-180, 0, 800, 400)
assert.ok(Math.abs(flatWestEdge.x - 0) < 0.001)

const flatLand = generateFlatLandGeometry(800, 400)
assert.ok(flatLand.fill.length > 0)
assert.ok(flatLand.stroke.length > 0)

const flatGrat = generateFlatGraticules(800, 400)
assert.ok(flatGrat.meridians.length > 0)
assert.ok(flatGrat.parallels.length > 0)
assert.ok(flatGrat.equator.startsWith("M"))

// 7. 同地区多节点集群离散矩阵排布测试（杜绝单点重叠遮挡）
const offsets1 = getClusterOffsets(1, 8)
assert.equal(offsets1.length, 1)
assert.equal(offsets1[0].dx, 0)

const offsets3 = getClusterOffsets(3, 8)
assert.equal(offsets3.length, 3)
assert.notEqual(offsets3[0].dx, offsets3[1].dx)
assert.notEqual(offsets3[1].dx, offsets3[2].dx)

const nodeTyo1: Node = { ...mockNodeA, id: 101, name: "Tokyo-01" }
const nodeTyo2: Node = { ...mockNodeA, id: 102, name: "Tokyo-02" }
const nodeTyo3: Node = { ...mockNodeA, id: 103, name: "Tokyo-03" }

const geoTyo1 = resolveNodeGeo(nodeTyo1, 0)!
const geoTyo2 = resolveNodeGeo(nodeTyo2, 1)!
const geoTyo3 = resolveNodeGeo(nodeTyo3, 2)!

const clustered = projectNodesWithClustering([geoTyo1, geoTyo2, geoTyo3], 800, 400, 7.5)
assert.equal(clustered.length, 3)
// 确保每个节点的屏幕落点各不相同，间距大于 5px
assert.ok(Math.abs(clustered[0].pt.x - clustered[1].pt.x) >= 6)
assert.ok(Math.abs(clustered[1].pt.x - clustered[2].pt.x) >= 6)
assert.equal(clustered[0].clusterTotal, 3)

// 8. 地区单一亮点（亮度随节点数动态增长）与地区投影测试
const b1 = getBeaconBrightness(1)
const b3 = getBeaconBrightness(3)
const b10 = getBeaconBrightness(10)

// 节点数更多时，光核半径更大、光晕半径更广、综合亮度指标更高
assert.ok(b3.coreRadius > b1.coreRadius)
assert.ok(b3.haloRadius > b1.haloRadius)
assert.ok(b3.intensity > b1.intensity)

assert.ok(b10.coreRadius >= b3.coreRadius)
assert.ok(b10.haloRadius >= b3.haloRadius)
assert.ok(b10.intensity >= b3.intensity)

// 1个地区仅生成1个独立亮点，且坐标与地区经纬度对齐
const regionBeacons = projectRegionBeacons(summary, 800, 400)
assert.equal(regionBeacons.length, summary.length)
assert.equal(regionBeacons[0].region.key, summary[0].key)
assert.ok(regionBeacons[0].pt.x > 0 && regionBeacons[0].pt.x < 800)
assert.ok(regionBeacons[0].pt.y > 0 && regionBeacons[0].pt.y < 400)

console.log("geo 模块单元测试全部通过")
