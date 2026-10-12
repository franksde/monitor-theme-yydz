/**
 * 网络延迟测试数据调度与行匹配模块 (Network Latency & Ping Service)
 * 具备：并发限流队列（防 Hub 503 限流）、一小时延迟样本轻量缓存、
 * 自定义线路匹配过滤、丢包率与延迟分级评估。
 * 遵循 AGENT.md 规范：采用中文注释、微倒角设计系统、零外部重型依赖。
 */

import { useEffect, useState } from "react"
import { api, type Node } from "./api.ts"

/** 原始 Ping 历史点定义（同 Hub /nodes/{id}/metrics 返回结构） */
export type PingPoint = {
  task_id: number
  ts: number
  latency: number | null
  band?: [number, number]
  loss?: number
}

/** 探测任务名称字典定义 */
export type ProbesMap = Record<string, string>

/** 丢包率字典定义 */
export type LossMap = Record<string, number>

/** 归一化后的单个线路探测数据模型 */
export type ProbeLine = {
  id: number
  name: string
  latestMs: number | null
  points: PingPoint[]
  loss: number
}

/**
 * 限制向 Hub 请求历史指标的全局并发度。
 * 多个卡片挂载时若同时发起几十条指标请求会触发 Hub 503 限流，因此采用排队调度。
 */
const MAX_CONCURRENT = 3
let activeRequests = 0
const queue: Array<() => void> = []

function acquireSlot(): Promise<void> {
  if (activeRequests < MAX_CONCURRENT) {
    activeRequests++
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    queue.push(() => {
      activeRequests++
      resolve()
    })
  })
}

function releaseSlot() {
  activeRequests--
  const next = queue.shift()
  if (next) next()
}

/** 内存缓存字典，key 为 nodeId，TTL 为 60 秒 */
const CACHE_TTL = 60_000
const cache = new Map<number, { data: ProbeLine[]; fetchedAt: number }>()

/**
 * 归一化解析 Hub 返回的 ping 指标结构
 */
export function normalizePingData(res: {
  ping?: PingPoint[]
  probes?: ProbesMap
  loss?: LossMap
}): ProbeLine[] {
  const ping = res.ping ?? []
  const names = res.probes ?? {}
  const loss = res.loss ?? {}

  const taskIds = [...new Set(ping.map((p) => p.task_id))]

  return taskIds
    .map((id) => {
      const taskPoints = ping
        .filter((p) => p.task_id === id)
        .sort((a, b) => a.ts - b.ts)

      // 提取最新一个有效延迟值
      const lastAnswered = [...taskPoints].reverse().find((p) => p.latency !== null)
      const latestMs = lastAnswered?.latency ?? null

      return {
        id,
        name: names[String(id)] || `任务 ${id}`,
        latestMs,
        points: taskPoints,
        loss: Number(loss[String(id)] ?? 0),
      }
    })
    .filter((line) => line.points.length > 0)
}

/**
 * 根据后台主题设置的 lines 规则，挑选并排序要展示的延迟测试条目
 * 支持换行、逗号、分号分隔；支持精确与子串模糊匹配；留空默认取前 3 项
 */
export function pickPingRows(allProbes: ProbeLine[], linesConfig: string, maxItems: number = 3): ProbeLine[] {
  if (!allProbes || allProbes.length === 0) return []

  // 解析站长配置的线路条目列表
  const rawEntries = linesConfig
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)

  const wanted = [...new Set(rawEntries)]

  // 1. 若站长未做任何配置，默认按后台顺序取前 maxItems 条
  if (wanted.length === 0) {
    return allProbes.slice(0, maxItems)
  }

  // 2. 按站长指定的条目顺序依次查找匹配的探测任务
  const matched: ProbeLine[] = []
  const usedIds = new Set<number>()

  for (const query of wanted) {
    const qLower = query.toLowerCase()

    // 优先完全匹配，其次子串包含匹配
    const exact = allProbes.find((p) => !usedIds.has(p.id) && p.name.toLowerCase() === qLower)
    const fuzzy = !exact
      ? allProbes.find(
          (p) =>
            !usedIds.has(p.id) &&
            (p.name.toLowerCase().includes(qLower) || qLower.includes(p.name.toLowerCase()))
        )
      : null

    const found = exact || fuzzy
    if (found) {
      matched.push(found)
      usedIds.add(found.id)
    }

    if (matched.length >= maxItems) break
  }

  return matched
}

/**
 * 延迟状态质量分档：
 * - ok: 延迟 < 100ms 且无丢包
 * - warn: 延迟 100~200ms 或丢包率 > 0
 * - bad: 延迟 >= 200ms 或丢包率 >= 5%
 * - down: 全部超时 (null)
 */
export type LatencyGrade = "ok" | "warn" | "bad" | "down"

export function evaluateLatency(ms: number | null, loss: number): LatencyGrade {
  if (ms === null) return "down"
  if (loss >= 5 || ms >= 200) return "bad"
  if (loss > 0 || ms >= 100) return "warn"
  return "ok"
}

/**
 * 节点网络延迟数据获取 Hook（带防抖缓存与并发控制）
 */
export function useNodeLatency(node: Node, enabled: boolean = true) {
  const [lines, setLines] = useState<ProbeLine[] | null>(() => {
    const cached = cache.get(node.id)
    return cached ? cached.data : null
  })
  const [loading, setLoading] = useState<boolean>(() => !lines && enabled && node.online)

  useEffect(() => {
    // 节点离线或未启用延迟显示时无需请求
    if (!enabled || !node.online) {
      return
    }

    let active = true

    const fetchLatency = async () => {
      const now = Date.now()
      const existing = cache.get(node.id)
      if (existing && now - existing.fetchedAt < CACHE_TTL) {
        if (active) {
          setLines(existing.data)
        }
        return
      }

      await acquireSlot()
      if (!active) {
        releaseSlot()
        return
      }

      try {
        setLoading(true)
        // 请求最近 1 小时、30 个采样点的 ping 序列
        const res = await api<{ ping?: PingPoint[]; probes?: ProbesMap; loss?: LossMap }>(
          `/nodes/${node.id}/metrics?hours=1&points=30&series=ping`
        )
        const parsed = normalizePingData(res)
        cache.set(node.id, { data: parsed, fetchedAt: Date.now() })

        if (active) {
          setLines(parsed)
        }
      } catch {
        if (active) {
          setLines([])
        }
      } finally {
        if (active) {
          setLoading(false)
        }
        releaseSlot()
      }
    }

    void fetchLatency()

    // 页面可见时按 60s 刷新
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        void fetchLatency()
      }
    }, CACHE_TTL)

    return () => {
      active = false
      clearInterval(interval)
    }
  }, [node.id, node.online, enabled])

  return { lines, loading }
}
