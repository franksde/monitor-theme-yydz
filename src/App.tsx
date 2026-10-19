import { lazy, Suspense, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react"
import { Moon, Sun, Wrench } from "lucide-react"

import { Globe } from "@/components/Globe"
import { NodeCard } from "@/components/NodeCard"
import { NodeFilterBar } from "@/components/NodeFilterBar"
import { Summary } from "@/components/Summary"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { NodeDetailSkeleton } from "@/components/NodeDetailSkeleton"
import { api, groupsOf, useNodes, type Node } from "@/lib/api"
import { loadConfig } from "@/lib/config"
import { resolveNodeGeo } from "@/lib/geo"
import { filterAndSortNodes, type FilterStatus, type SortMode } from "@/lib/summary"


// 站点信息接口类型定义（history_days 在早于按小时归档分档的 hub 版本中不存在）
type Me = { authed: boolean; github: boolean; site_name: string; public_page: boolean; history_days?: number }

// 动态懒加载详情页组件：由于 recharts 库体积较大，单独拆包可使首屏体积减少一半以上
const loadDetail = () => import("@/components/NodeDetail").then((m) => ({ default: m.NodeDetail }))
const NodeDetail = lazy(loadDetail)

/**
 * 客户端轻量路由 Hook：基于 popstate 监听与 pushState 实现 /node/{id} 导航
 * 任何未知路径 hub 均回落至 index.html，无需服务端路由介入
 */
function useNodeRoute() {
  const read = () => {
    const match = location.pathname.match(/^\/node\/(\d+)/)
    return match ? Number(match[1]) : null
  }
  const [id, setId] = useState(read)
  useEffect(() => {
    const sync = () => setId(read())
    addEventListener("popstate", sync)
    return () => removeEventListener("popstate", sync)
  }, [])
  return [
    id,
    (next: number | null) => {
      const path = next === null ? "/" : `/node/${next}`
      if (location.pathname !== path) history.pushState({}, "", path)
      setId(next)
      scrollTo({ top: 0, behavior: "smooth" })
    },
  ] as const
}

const DARK_MEDIA = matchMedia("(prefers-color-scheme: dark)")

/**
 * 深色/浅色主题管理 Hook
 * 监听系统偏好与 localStorage，在切换瞬间临时禁用全局过渡以防止颜色错位混杂
 */
function useTheme() {
  const [saved, setSaved] = useState(() => localStorage.getItem("theme"))
  const system = useSyncExternalStore(
    (notify) => {
      DARK_MEDIA.addEventListener("change", notify)
      return () => DARK_MEDIA.removeEventListener("change", notify)
    },
    () => DARK_MEDIA.matches,
  )
  const dark = saved ? saved === "dark" : system

  useEffect(() => {
    // 切换模式时临时锁定过渡，防止渐变期间卡片背景与前景色产生闪白
    const hold = document.createElement("style")
    hold.textContent = "*,*::before,*::after{transition:none!important}"
    document.head.append(hold)
    document.documentElement.classList.toggle("dark", dark)
    void document.body.offsetWidth
    hold.remove()
  }, [dark])

  return [
    dark,
    () => {
      const next = dark ? "light" : "dark"
      localStorage.setItem("theme", next)
      setSaved(next)
    },
  ] as const
}

/**
 * 主应用组件
 */
export default function App() {
  const [dark, toggleTheme] = useTheme()
  const [me, setMe] = useState<Me | null>(null)
  const [meError, setMeError] = useState("")
  const [config, setConfig] = useState<Record<string, unknown> | null>(null)
  const { nodes, error, closed } = useNodes()
  const [open, go] = useNodeRoute()
  // 当前选中的分组 Tab
  const [group, setGroup] = useState<string | null>(null)

  const loadMe = useCallback(() => {
    return api<Me>("/me")
      .then((next) => { setMe(next); setMeError("") })
      .catch((e: Error) => setMeError(e.message))
  }, [])

  useEffect(() => {
    loadMe()
    // 站点设置与 /me 并行加载
    void loadConfig().then(setConfig)
    // 静默预热加载详情页 chunk，提升首次点击响应速度
    void loadDetail()
  }, [loadMe])

  // 公开页关闭且非管理员登录时，自动跳转到内置后台
  useEffect(() => {
    if (closed) void loadMe()
  }, [closed, loadMe])

  useEffect(() => {
    if (me && !me.public_page && !me.authed) location.href = "/admin/"
  }, [me])

  // 首页节点卡片默认使用节点 name 字符自然排序，同名时按 id 兜底
  const sorted = [...(nodes ?? [])].sort(
    (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }) || a.id - b.id
  )
  const selected = sorted.find((n) => n.id === open)

  // 动态同步网页 Title
  useEffect(() => {
    document.title = [selected?.name, me?.site_name || "Monitor"].filter(Boolean).join(" · ")
  }, [selected?.name, me?.site_name])

  // 首屏未加载完成时的占位骨架
  if (!me) return (
    <div className="grid min-h-svh place-items-center p-6 text-sm text-muted-foreground">
      {meError ? (
        <div className="space-y-3 text-center">
          <p role="alert" className="text-destructive font-medium">加载失败：{meError}</p>
          <Button onClick={loadMe}>重试</Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-[1px] bg-foreground/60 pulse-online" />
          <span>正在连接监控节点…</span>
        </div>
      )}
    </div>
  )

  if (!me.public_page && !me.authed) return null

  return (
    <div className="min-h-svh">
      {/* 顶部导航栏：精细微倒角磨砂玻璃质感 */}
      <header className="sticky top-0 z-30 h-13 border-b border-border/80 bg-background/85 backdrop-blur-md transition-colors">
        <div className="mx-auto flex h-full max-w-[1400px] items-center gap-3 px-4 sm:px-6">
          {/* 点击站点名返回主列表 */}
          <button
            className="flex items-center gap-2 font-bold tracking-tight text-foreground transition-opacity hover:opacity-75 active:scale-[0.99]"
            onClick={() => go(null)}
          >
            <img src="/favicon.svg" alt="Logo" className="size-4.5 shrink-0" />
            <span>{me.site_name || "Monitor"}</span>
          </button>
          <div className="flex-1" />
          {/* 管理后台入口：仅在已登录状态时展示 */}
          {me.authed && (
            <Button variant="ghost" size="sm" asChild className="text-xs">
              <a href="/admin/">
                <Wrench className="size-3.5" />
                <span>进入后台</span>
              </a>
            </Button>
          )}
          {/* 深浅色模式切换按钮 */}
          <Button variant="ghost" size="icon" onClick={toggleTheme} title="切换主题" className="size-8">
            {dark ? <Sun className="size-4 text-warn" /> : <Moon className="size-4" />}
          </Button>
        </div>
      </header>

      {/* 主视图区域：包含平滑动效与响应式栅格 */}
      <main className="mx-auto max-w-[1400px] space-y-5 px-4 py-5 sm:px-6">
        {/* 全局连接异常警示卡片 */}
        {error && (
          <div className="animate-fade-in flex items-center justify-between rounded-[2px] border border-destructive/30 bg-destructive/10 px-3.5 py-2 text-xs font-medium text-destructive">
            <span>{error}</span>
          </div>
        )}

        {/* 详情页路由视图 vs 节点主列表视图 */}
        {open !== null ? (
          !nodes ? (
            <NodeDetailSkeleton />
          ) : selected ? (
            <Suspense fallback={<NodeDetailSkeleton />}>
              <NodeDetail key={selected.id} node={selected} historyDays={me.history_days ?? 7} />
            </Suspense>
          ) : (
            <div className="animate-fade-in py-20 text-center text-xs text-muted-foreground">
              <p>节点不存在或未公开。</p>
              <Button variant="secondary" size="sm" className="mt-3" onClick={() => go(null)}>
                返回列表
              </Button>
            </div>
          )
        ) : !nodes || !config ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-72" />
            ))}
          </div>
        ) : (
          <div className="animate-fade-in space-y-4">
            <NodeList
              nodes={sorted}
              group={group}
              summary={config.show_summary === true}
              showGlobe={config.show_globe !== false}
              showLatency={config.show_latency !== false}
              pingLines={typeof config.ping_lines === "string" ? config.ping_lines : ""}
              offlinePlacement={typeof config.offline_placement === "string" ? config.offline_placement : "default"}
              onGroup={setGroup}
              onOpen={go}
            />
          </div>
        )}
      </main>
    </div>
  )
}

/**
 * 节点列表展示组件（包含分组切换 Tab、三维地球仪、数据汇总卡片与卡片网格）
 */
function NodeList({
  nodes,
  group,
  summary,
  showGlobe,
  showLatency,
  pingLines,
  offlinePlacement = "default",
  onGroup,
  onOpen,
}: {
  nodes: Node[]
  group: string | null
  summary: boolean
  showGlobe: boolean
  showLatency: boolean
  pingLines: string
  offlinePlacement?: string
  onGroup: (group: string | null) => void
  onOpen: (id: number) => void
}) {
  const groups = groupsOf(nodes)
  const ungrouped = nodes.filter((n) => !n.group).length

  // 地球仪折叠控制与地区筛选状态
  const [globeOpen, setGlobeOpen] = useState(showGlobe)
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)

  // 分组有效性回退保护
  const current = group === null || (group === "" ? ungrouped > 0 : groups.includes(group)) ? group : null
  useEffect(() => {
    if (current !== group) onGroup(current)
  }, [current, group, onGroup])

  // 按分组初筛节点
  const groupNodes = current === null ? nodes : nodes.filter((n) => (n.group ?? "") === current)

  // 当在地球上选定特定地区时，进一步联动过滤节点卡片列表
  const shown = useMemo<Node[]>(() => {
    if (!selectedRegion) return groupNodes
    return groupNodes.filter((n: Node) => {
      const geo = resolveNodeGeo(n, 0)
      return geo?.regionKey === selectedRegion
    })
  }, [groupNodes, selectedRegion])


  // 关键字搜索、状态过滤与多维指标排序状态
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<SortMode>("default")
  const [status, setStatus] = useState<FilterStatus>("all")

  // 经多维搜索、在线状态与指标排序后的最终渲染列表
  const finalNodes = useMemo(() => {
    return filterAndSortNodes(shown, search, status, sort, offlinePlacement)
  }, [shown, search, status, sort, offlinePlacement])

  const offlineCount = useMemo(() => shown.filter((n) => !n.online).length, [shown])

  const tabs = [
    [null, "全部", nodes.length] as const,
    ...groups.map((g) => [g, g, nodes.filter((n) => n.group === g).length] as const),
    ...(ungrouped ? [["", "未分组", ungrouped] as const] : []),
  ]

  return (
    <>
      {/* 顶部操作行：分组切换选项卡与地球仪展开/折叠按钮（粘性置顶展示，页面向下滚动时常驻可见） */}
      <div className="sticky top-13 z-20 -mt-5 -mx-4 px-4 sm:-mx-6 sm:px-6 py-2 bg-background/85 backdrop-blur-md border-b border-border/60 transition-colors">
        <div className="flex items-center justify-between gap-2">
          {groups.length > 0 && (
            <div role="group" aria-label="分组" className="-mx-1 flex flex-1 min-w-0 gap-1.5 overflow-x-auto px-1 py-0.5 no-scrollbar">
              {tabs.map(([value, label, count]) => (
                <Button
                  key={value === null ? "*" : `=${value}`}
                  aria-pressed={current === value}
                  size="sm"
                  variant={current === value ? "secondary" : "ghost"}
                  className={`shrink-0 rounded-[2px] transition-all duration-150 ${
                    current === value
                      ? "border-border/80 font-semibold shadow-2xs"
                      : "opacity-75 hover:opacity-100"
                  }`}
                  onClick={() => {
                    onGroup(value)
                    setSelectedRegion(null) // 切换分组时重置地区筛选
                  }}
                >
                  <span>{label}</span>
                  <span className="tnum ml-1 rounded-[1px] bg-muted/60 px-1.5 py-0.5 text-xs font-mono text-muted-foreground font-medium">
                    {count}
                  </span>
                </Button>
              ))}
            </div>
          )}

          {/* 地球仪视图显隐切换按钮（固定不折行） */}
          <div className="shrink-0 ml-auto">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 rounded-[2px] px-2.5 text-xs text-muted-foreground hover:text-foreground border border-border/40"
              onClick={() => setGlobeOpen((v) => !v)}
            >
              <span>{globeOpen ? "收起地球" : "展开地球"}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* 专属三维正射投影地球仪 */}
      {globeOpen && (
        <Globe
          nodes={groupNodes}
          selectedRegion={selectedRegion}
          onSelectRegion={setSelectedRegion}
          onOpenNode={onOpen}
        />
      )}

      {/* 全局与分组关键指标看板（包含硬件规格、网络带宽、费用累计与到期时间排行榜） */}
      {summary && <Summary nodes={shown} group={current} onOpen={onOpen} />}

      {/* 地区过滤状态提示条 */}
      {selectedRegion && (
        <div className="flex items-center justify-between rounded-[2px] border border-border/80 bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground animate-fade-in">
          <span>
            已按地区筛选：<strong className="text-foreground">{selectedRegion}</strong>（共 {shown.length} 台节点）
          </span>
          <button
            onClick={() => setSelectedRegion(null)}
            className="rounded-[1px] px-1.5 py-0.5 text-xs font-medium text-foreground underline hover:opacity-80"
          >
            清除地区筛选
          </button>
        </div>
      )}

      {/* 节点搜索、状态快筛与多维指标排序控制条 */}
      {shown.length > 0 && (
        <NodeFilterBar
          search={search}
          onSearchChange={setSearch}
          sort={sort}
          onSortChange={setSort}
          status={status}
          onStatusChange={setStatus}
          totalCount={shown.length}
          filteredCount={finalNodes.length}
          offlineCount={offlineCount}
        />
      )}

      {/* 节点卡片列表网格：支持默认混排、全部置后与分区分隔三种排版策略 */}
      <div className="min-h-[360px]">
        {finalNodes.length === 0 ? (
          <div className="py-20 text-center text-xs text-muted-foreground animate-fade-in">
            {search || status !== "all"
              ? "没有找到符合搜索条件的节点"
              : selectedRegion
                ? "该地区暂无符合条件的节点"
                : "还没有接入任何节点"}
          </div>
        ) : offlinePlacement === "separate" && sort === "default" ? (
          <SeparateNodeGrids
            nodes={finalNodes}
            showLatency={showLatency}
            pingLines={pingLines}
            onOpen={onOpen}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {finalNodes.map((n) => (
              <NodeCard
                key={n.id}
                node={n}
                showLatency={showLatency}
                pingLines={pingLines}
                onOpen={() => onOpen(n.id)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}

/**
 * 离线与在线节点分区分隔渲染网格
 */
function SeparateNodeGrids({
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
  const online = nodes.filter((n) => n.online)
  const offline = nodes.filter((n) => !n.online)

  return (
    <div className="space-y-6">
      {/* 1. 在线节点网格 */}
      {online.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {online.map((n) => (
            <NodeCard
              key={n.id}
              node={n}
              showLatency={showLatency}
              pingLines={pingLines}
              onOpen={() => onOpen(n.id)}
            />
          ))}
        </div>
      )}

      {/* 2. 离线节点分隔栏与网格 */}
      {offline.length > 0 && (
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between rounded-[2px] border border-border/70 bg-card/60 px-3.5 py-2.5 text-xs shadow-2xs backdrop-blur-xs">
            <div className="flex items-center gap-2">
              <span className="size-1.5 rounded-[1px] bg-offline" />
              <span className="font-semibold tracking-tight text-foreground">
                离线节点
              </span>
              <span className="tnum rounded-[1px] bg-muted/80 px-1.5 py-0.5 text-xs font-mono font-medium text-muted-foreground">
                {offline.length} 台
              </span>
            </div>
            <span className="text-xs font-mono text-muted-foreground">
              暂时断开通信或待部署
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {offline.map((n) => (
              <NodeCard
                key={n.id}
                node={n}
                showLatency={showLatency}
                pingLines={pingLines}
                onOpen={() => onOpen(n.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}


