/**
 * 全球节点平面世界地图测控组件 (Flat World Topology Map)
 * 具备：全量节点 100% 同屏一览无余、真实世界各大洲陆地板块与海岸线、
 * 工控经纬网格与边缘标尺、在线节点呼吸灯标、地区筛选高亮联动。
 * 遵循 AGENT.md 规范：采用中文注释、无缝平滑动画、微倒角 (2px) 工控极简风格、零多余外部依赖。
 */

import { useMemo, useState } from "react"
import {
  Globe as GlobeIcon,
  Maximize2,
  ExternalLink,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { Node } from "@/lib/api"
import { FLAGS } from "@/lib/flags"
import {
  FLAT_MAP_VIEW,
  generateFlatGraticules,
  generateFlatLandGeometry,
  projectNodesWithClustering,
  resolveNodeGeo,
  summarizeRegions,
  type GeoNode,
} from "@/lib/geo"
import { cn } from "@/lib/utils"

export type GlobeProps = {
  nodes: Node[]
  selectedRegion: string | null
  onSelectRegion: (regionKey: string | null) => void
  onOpenNode: (nodeId: number) => void
}

export function Globe({
  nodes,
  selectedRegion,
  onSelectRegion,
  onOpenNode,
}: GlobeProps) {
  // 1. 悬停节点状态与 Tooltip 坐标
  const [hoveredNodeId, setHoveredNodeId] = useState<number | null>(null)
  const [tooltipData, setTooltipData] = useState<{
    geo: GeoNode
    x: number
    y: number
    clusterTotal: number
    clusterIndex: number
  } | null>(null)

  // 2. 解析全量节点的地理落点（基准地理定位）
  const geoNodes = useMemo(() => {
    const list: GeoNode[] = []
    nodes.forEach((node) => {
      const geo = resolveNodeGeo(node, 0)
      if (geo) list.push(geo)
    })
    return list
  }, [nodes])

  // 3. 地区聚合统计
  const regions = useMemo(() => summarizeRegions(geoNodes), [geoNodes])

  // 4. 平面世界陆地与经纬几何生成
  const land = useMemo(
    () => generateFlatLandGeometry(FLAT_MAP_VIEW.width, FLAT_MAP_VIEW.height),
    []
  )
  const graticules = useMemo(
    () => generateFlatGraticules(FLAT_MAP_VIEW.width, FLAT_MAP_VIEW.height),
    []
  )

  // 5. 计算全量节点在平面地图上的投影点（同地区多节点紧凑工控矩阵离散排布，彻底杜绝重合遮挡）
  const projectedNodes = useMemo(() => {
    const clusterList = projectNodesWithClustering(
      geoNodes,
      FLAT_MAP_VIEW.width,
      FLAT_MAP_VIEW.height,
      7.5
    )
    return clusterList.map((item) => {
      const isSelected = selectedRegion ? item.geo.regionKey === selectedRegion : true
      return {
        ...item,
        isSelected,
      }
    })
  }, [geoNodes, selectedRegion])

  const totalPlaced = geoNodes.length
  const onlineCount = geoNodes.filter((g) => g.node.online).length

  // 地图边缘刻度尺标签（与严谨对称投影 100% 几何对齐）
  const lngLabels = [
    { text: "180°W", x: 14 },
    { text: "120°W", x: FLAT_MAP_VIEW.width * (60 / 360) },
    { text: "60°W", x: FLAT_MAP_VIEW.width * (120 / 360) },
    { text: "0° (UTC)", x: FLAT_MAP_VIEW.width * 0.5 },
    { text: "60°E", x: FLAT_MAP_VIEW.width * (240 / 360) },
    { text: "120°E", x: FLAT_MAP_VIEW.width * (300 / 360) },
    { text: "180°E", x: FLAT_MAP_VIEW.width - 20 },
  ]

  const latLabels = [
    { text: "60°N", y: 53 },
    { text: "0°", y: 203 },
    { text: "60°S", y: 353 },
  ]

  return (
    <Card className="animate-fade-in gap-0 rounded-[2px] border border-border/80 bg-card p-4 shadow-xs">
      {/* 头部标题与控制栏 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-6 items-center justify-center rounded-[2px] border border-border/60 bg-muted/60 text-foreground">
            <GlobeIcon className="size-3.5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold tracking-tight text-foreground">
                全球节点平面拓扑分布
              </h3>
              <Badge className="h-4 rounded-[2px] border border-border/70 bg-muted/30 px-1 text-[9px] uppercase tracking-wider text-muted-foreground">
                FLAT MATRIX
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">
              全球视野一览无余 · 接入 {totalPlaced} 台 · 在线 {onlineCount} 台 · 覆盖 {regions.length} 个地区
            </p>
          </div>
        </div>

        {/* 快捷动作 */}
        {selectedRegion && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 rounded-[2px] px-2 text-xs"
            onClick={() => onSelectRegion(null)}
          >
            <Maximize2 className="size-3" />
            <span>恢复全球视图</span>
          </Button>
        )}
      </div>

      {/* 核心展示区：左侧平面地图大屏，右侧地区控制台 */}
      <div className="mt-3.5 grid gap-4 lg:grid-cols-12 lg:items-center">
        {/* 平面地图视口 */}
        <div className="relative col-span-12 flex items-center justify-center overflow-hidden rounded-[2px] border border-border/40 bg-muted/15 p-2 select-none lg:col-span-8">
          <svg
            viewBox={`0 0 ${FLAT_MAP_VIEW.width} ${FLAT_MAP_VIEW.height}`}
            className="w-full h-auto aspect-[2/1]"
            aria-label="平面世界节点拓扑地图"
          >
            <defs>
              {/* 大洋底色网格背景渐变 */}
              <linearGradient id="mapOceanGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="var(--color-card)" stopOpacity="0.9" />
                <stop offset="50%" stopColor="var(--color-muted)" stopOpacity="0.35" />
                <stop offset="100%" stopColor="var(--color-card)" stopOpacity="0.9" />
              </linearGradient>

              {/* 节点选区微发光渐变 */}
              <radialGradient id="highlightGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.4" />
                <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* 1. 地图背景底盘 */}
            <rect
              x="0"
              y="0"
              width={FLAT_MAP_VIEW.width}
              height={FLAT_MAP_VIEW.height}
              fill="url(#mapOceanGrad)"
              stroke="var(--color-border)"
              strokeWidth="0.8"
              rx="2"
            />

            {/* 2. 工控经纬网格 */}
            <g stroke="var(--color-border)" strokeWidth="0.5" opacity="0.4" fill="none">
              {graticules.meridians.map((m, i) => (
                <path key={`mer-${i}`} d={m.d} />
              ))}
              {graticules.parallels.map((p, i) => (
                <path key={`par-${i}`} d={p.d} />
              ))}
            </g>

            {/* 赤道与本初子午线基准强调线 */}
            <g stroke="var(--color-border)" strokeWidth="0.85" opacity="0.65" fill="none">
              <path d={graticules.equator} strokeDasharray="4 2" />
              <path d={graticules.primeMeridian} strokeDasharray="4 2" />
            </g>

            {/* 3. 真实世界各大洲陆地板块（填充 + 海岸线描边） */}
            <g>
              {/* 3.1 陆地多边形填充 */}
              {land.fill && (
                <path
                  d={land.fill}
                  className="fill-foreground/[0.08] dark:fill-foreground/[0.13] transition-colors"
                />
              )}

              {/* 3.2 海岸线微描边 */}
              {land.stroke && (
                <path
                  d={land.stroke}
                  stroke="var(--color-foreground)"
                  strokeWidth="0.75"
                  opacity="0.38"
                  fill="none"
                />
              )}
            </g>

            {/* 4. 地图四周边框刻度与经纬标尺文本 */}
            <g className="fill-muted-foreground text-[8px] font-mono select-none opacity-60">
              {lngLabels.map((lbl, i) => (
                <text key={`lng-${i}`} x={lbl.x} y="11" textAnchor="middle">
                  {lbl.text}
                </text>
              ))}
              {latLabels.map((lbl, i) => (
                <text key={`lat-${i}`} x="8" y={lbl.y} textAnchor="start">
                  {lbl.text}
                </text>
              ))}
            </g>

            {/* 5. 全球所有节点落点针标（同地区多节点矩阵微离散展开，100% 独立可见、独立交互） */}
            {projectedNodes.map(({ geo, pt, isSelected, clusterTotal, indexInCluster }) => {
              const isOnline = geo.node.online
              const isHovered = hoveredNodeId === geo.node.id

              return (
                <g
                  key={`pin-${geo.node.id}`}
                  className="cursor-pointer"
                  opacity={isSelected ? 1 : 0.25}
                  style={{ transition: "opacity 200ms ease" }}
                  onClick={(e) => {
                    e.stopPropagation()
                    onOpenNode(geo.node.id)
                  }}
                  onMouseEnter={(e) => {
                    setHoveredNodeId(geo.node.id)
                    const svgRect = e.currentTarget.closest("svg")?.getBoundingClientRect()
                    const containerRect = e.currentTarget.closest("div")?.getBoundingClientRect()
                    if (svgRect && containerRect) {
                      const scaleX = svgRect.width / FLAT_MAP_VIEW.width
                      const scaleY = svgRect.height / FLAT_MAP_VIEW.height
                      const screenX = svgRect.left - containerRect.left + pt.x * scaleX
                      const screenY = svgRect.top - containerRect.top + pt.y * scaleY
                      setTooltipData({
                        geo,
                        x: screenX,
                        y: screenY,
                        clusterTotal,
                        clusterIndex: indexInCluster,
                      })
                    }
                  }}
                  onMouseLeave={() => {
                    setHoveredNodeId(null)
                    setTooltipData(null)
                  }}
                >
                  {/* 在线节点呼吸光环 */}
                  {isOnline && isSelected && (
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="5.5"
                      fill="none"
                      stroke="var(--color-online)"
                      className="pulse-globe-beacon"
                    />
                  )}

                  {/* 悬停高亮大光晕 */}
                  {isHovered && (
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="12"
                      fill="url(#highlightGlow)"
                    />
                  )}

                  {/* 节点微倒角方块落点标 */}
                  <rect
                    x={pt.x - (isHovered ? 3.5 : 2.5)}
                    y={pt.y - (isHovered ? 3.5 : 2.5)}
                    width={isHovered ? 7 : 5}
                    height={isHovered ? 7 : 5}
                    rx="1"
                    className={cn(
                      "transition-all duration-150",
                      isOnline
                        ? isSelected
                          ? "fill-online stroke-background stroke-1"
                          : "fill-online opacity-40"
                        : "fill-muted-foreground/60"
                    )}
                  />

                  {/* 悬停时外圈工控准星 */}
                  {isHovered && (
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="7.5"
                      fill="none"
                      stroke="var(--color-foreground)"
                      strokeWidth="1.2"
                    />
                  )}
                </g>
              )
            })}
          </svg>

          {/* 交互提示微标签 */}
          <div className="pointer-events-none absolute bottom-3 left-4 text-[10px] font-mono text-muted-foreground opacity-60">
            悬停节点查看测控详情 · 点击节点打开指标监控
          </div>

          {/* 节点悬浮卡片微弹层（智能依节点视口自适应贴靠，彻底杜绝横屏错位） */}
          {tooltipData && (
            <div
              className="pointer-events-none absolute z-20 rounded-[2px] border border-border/80 bg-card/95 px-2.5 py-1.5 text-xs shadow-md backdrop-blur-xs transition-transform duration-75"
              style={{
                left: `${tooltipData.x}px`,
                top: `${tooltipData.y}px`,
                transform: `translate(${tooltipData.x > 320 ? "calc(-100% - 10px)" : "12px"}, -50%)`,
              }}
            >
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                {FLAGS[tooltipData.geo.country] && (
                  <img
                    src={FLAGS[tooltipData.geo.country]}
                    alt={tooltipData.geo.country}
                    className="h-3 w-4 rounded-[1px] object-cover"
                  />
                )}
                <span>{tooltipData.geo.node.name}</span>
                <span
                  className={cn(
                    "size-1.5 rounded-[0.5px]",
                    tooltipData.geo.node.online ? "bg-online" : "bg-muted-foreground"
                  )}
                />
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
                <span>
                  {tooltipData.geo.city}, {tooltipData.geo.country}
                </span>
                <span>·</span>
                <span>
                  LAT {tooltipData.geo.lat.toFixed(1)}° · LON {tooltipData.geo.lng.toFixed(1)}°
                </span>
                {tooltipData.clusterTotal > 1 && (
                  <>
                    <span>·</span>
                    <span className="text-foreground/90 font-medium">
                      同地区 {tooltipData.clusterIndex + 1}/{tooltipData.clusterTotal}
                    </span>
                  </>
                )}
                <span>·</span>
                <span>{tooltipData.geo.node.online ? "在线运行" : "离线告警"}</span>
              </div>
            </div>
          )}
        </div>

        {/* 右侧：地区测控控制台与统计面板 */}
        <div className="col-span-12 flex flex-col gap-2.5 lg:col-span-4">
          <div className="flex items-center justify-between border-b border-border/50 pb-1.5">
            <span className="text-xs font-medium text-foreground">地区测控列表</span>
            {selectedRegion ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-5 rounded-[2px] px-1 text-[11px] text-muted-foreground hover:text-foreground"
                onClick={() => onSelectRegion(null)}
              >
                清除筛选
              </Button>
            ) : (
              <span className="text-[10px] text-muted-foreground font-mono">
                共 {regions.length} 个区域
              </span>
            )}
          </div>

          {/* 地区列表滚动区（微倒角工业风格） */}
          <div className="flex max-h-72 flex-col gap-1 overflow-y-auto pr-1">
            {regions.map((reg) => {
              const isSelected = selectedRegion === reg.key
              const flagUrl = FLAGS[reg.country]
              const percentOnline = Math.round((reg.online / reg.total) * 100)

              return (
                <button
                  key={reg.key}
                  type="button"
                  onClick={() => onSelectRegion(isSelected ? null : reg.key)}
                  className={cn(
                    "flex flex-col gap-1 rounded-[2px] border px-2 py-1.5 text-left transition-colors",
                    isSelected
                      ? "border-primary/80 bg-primary/10 text-foreground ring-1 ring-primary/30"
                      : "border-border/40 bg-muted/20 text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground"
                  )}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 truncate">
                      {flagUrl && (
                        <img
                          src={flagUrl}
                          alt={reg.country}
                          className="h-3 w-4 rounded-[1px] object-cover shrink-0"
                        />
                      )}
                      <span className="truncate text-xs font-medium text-foreground">
                        {reg.city}
                      </span>
                      <span className="text-[10px] opacity-75 font-mono">
                        ({reg.country})
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] font-mono shrink-0">
                      <span className={cn(reg.online === reg.total ? "text-online" : "text-warn")}>
                        {reg.online}/{reg.total}
                      </span>
                      <ExternalLink className="size-2.5 opacity-40" />
                    </div>
                  </div>

                  {/* 在线率微进度条 */}
                  <div className="h-0.5 w-full rounded-[1px] bg-border/40 overflow-hidden">
                    <div
                      className={cn(
                        "h-full transition-all duration-300",
                        reg.online === reg.total ? "bg-online" : "bg-warn"
                      )}
                      style={{ width: `${percentOnline}%` }}
                    />
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </Card>
  )
}
