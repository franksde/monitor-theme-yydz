/**
 * 节点详情监控页面高保真工控骨架屏系统 (Node Detail Industrial Skeleton System)
 * 严格按照真实组件的 DOM 层级、卡片网格、高度尺寸、padding/margin 与 title 文本像素级对齐，
 * 包含所有真实标题文本、图标、图例、度量标签与控制栏，仅对动态时序数据、数值和硬件型号进行微呼吸占位。
 * 遵循 AGENT.md 规范：采用微倒角 (2px)、全中文注释、工业仪器极简美学、零多余外部依赖。
 */

import {
  Activity,
  ArrowDown,
  ArrowUp,
  BarChart2,
  Calendar,
  Clock,
  Cpu,
  Flame,
  Grid,
  HardDrive,
  Layers,
  PieChart as PieIcon,
  Server,
  TrendingUp,
  Wifi,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * 核心遥测指标图表局部骨架屏（针对资源监控 vs 网络延迟双视图精准适配）
 */
export function DetailChartSkeleton({ tab = "resources" }: { tab?: "resources" | "latency" }) {
  if (tab === "latency") {
    return (
      <div className="space-y-4 animate-fade-in">
        {/* 顶部控制栏与视图切换（真实样式为平面下划线分隔栏，非卡片包裹） */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-2.5">
          <div className="flex items-center gap-2">
            <Wifi className="size-4 text-primary" />
            <span className="font-semibold text-foreground text-xs">网络延迟拓扑测控</span>
            <Badge className="h-4.5 rounded-[1px] px-1.5 text-[11px] font-mono text-muted-foreground border-border/60">
              4 条测试线路
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground select-none opacity-70">
              <input type="checkbox" disabled className="accent-foreground rounded-[1px]" />
              <span>智能削峰</span>
            </label>

            <div className="flex items-center gap-1 rounded-[2px] border border-border/60 bg-muted/30 p-0.5 text-xs">
              <div className="flex items-center gap-1 rounded-[1px] bg-primary px-2 py-0.5 text-primary-foreground font-medium shadow-2xs">
                <TrendingUp className="size-3" />
                <span>聚合对比</span>
              </div>
              <div className="flex items-center gap-1 rounded-[1px] px-2 py-0.5 text-muted-foreground">
                <Grid className="size-3" />
                <span>分轨矩阵</span>
              </div>
              <div className="flex items-center gap-1 rounded-[1px] px-2 py-0.5 text-muted-foreground">
                <BarChart2 className="size-3" />
                <span>延迟排行</span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. 探测线路指标卡片网格（4 格线路卡片，与真实卡片尺寸高度一致） */}
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {["探测线路 #1", "探测线路 #2", "探测线路 #3", "探测线路 #4"].map((name, i) => (
            <div
              key={i}
              className="group relative flex flex-col justify-between rounded-[2px] border border-border/80 bg-card/75 p-2.5 shadow-2xs select-none"
            >
              {/* 卡片头部：线路名与质量徽标 */}
              <div className="flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="h-2.5 w-1 rounded-[0.5px] bg-primary/70 shrink-0" />
                  <span className="truncate text-xs font-semibold text-foreground">{name}</span>
                </div>
                <Skeleton className="h-4 w-12 rounded-[1px]" />
              </div>

              {/* 卡片主体：当前延迟大字 + 迷你火花线占位（高度严格对应 my-2） */}
              <div className="my-2 flex items-baseline justify-between gap-2">
                <div className="flex items-baseline">
                  <Skeleton className="h-7 w-14 rounded-[1px]" />
                  <span className="ml-1 text-xs text-muted-foreground font-mono">ms</span>
                </div>
                <div className="h-6 w-20 flex items-center justify-center opacity-40">
                  <Skeleton className="h-2 w-full rounded-[1px]" />
                </div>
              </div>

              {/* 卡片底部：极值统计与单线聚焦按钮 */}
              <div className="flex items-center justify-between border-t border-border/30 pt-1.5 text-xs font-mono text-muted-foreground">
                <span className="font-medium">均 — · 极 —-—</span>
                <span className="rounded-[1px] px-1.5 py-0.5 text-xs text-muted-foreground">单线</span>
              </div>
            </div>
          ))}
        </div>

        {/* 3. 聚合对比视图时序主图（高度对应 mt-2.5 h-80 sm:h-96） */}
        <div className="rounded-[2px] border border-border/70 bg-card/60 p-3 shadow-2xs">
          <div className="flex items-center justify-between border-b border-border/40 pb-2 text-xs font-semibold text-foreground">
            <span className="flex items-center gap-1.5">
              <TrendingUp className="size-3.5 text-primary" />
              <span>多线路时序延迟对比（已选 4/4 线）</span>
            </span>
            <span className="text-xs font-mono font-normal text-muted-foreground">
              拖动底部滑块可缩放时间区间
            </span>
          </div>

          <div className="mt-2.5 flex h-80 w-full flex-col justify-between rounded-[2px] border border-border/30 bg-muted/10 p-4 sm:h-96">
            {/* 网格走势线条占位 */}
            <div className="flex flex-1 flex-col justify-around py-3 opacity-30">
              <div className="h-px w-full border-t border-dashed border-border" />
              <div className="h-px w-full border-t border-dashed border-border" />
              <div className="h-px w-full border-t border-dashed border-border" />
              <div className="h-px w-full border-t border-dashed border-border" />
            </div>
            {/* 底部 Brush 时间滑块占位 */}
            <div className="mt-2 flex h-7 w-full items-center justify-between rounded-[2px] border border-border/50 bg-muted/30 px-3">
              <span className="text-[11px] font-mono text-muted-foreground/60">—:—</span>
              <Skeleton className="h-3 w-32 rounded-[1px]" />
              <span className="text-[11px] font-mono text-muted-foreground/60">—:—</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* 视图模式切换胶囊（真实样式为平面下划线分隔栏，非卡片包裹） */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2.5">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Activity className="size-3.5 text-primary" />
          <span className="font-semibold text-foreground">主机资源分析测控</span>
          <span className="text-xs text-muted-foreground font-medium">
            · 遥测历史窗口
          </span>
        </div>

        <div className="flex items-center gap-1 rounded-[2px] border border-border/60 bg-muted/30 p-0.5 text-xs">
          <div className="flex items-center gap-1 rounded-[1px] px-2 py-0.5 bg-primary text-primary-foreground font-medium shadow-2xs">
            <Activity className="size-3" />
            <span>全景仪表</span>
          </div>
          <div className="flex items-center gap-1 rounded-[1px] px-2 py-0.5 text-muted-foreground">
            <TrendingUp className="size-3" />
            <span>时序曲线</span>
          </div>
          <div className="flex items-center gap-1 rounded-[1px] px-2 py-0.5 text-muted-foreground">
            <Flame className="size-3" />
            <span>负载热力</span>
          </div>
          <div className="flex items-center gap-1 rounded-[1px] px-2 py-0.5 text-muted-foreground">
            <PieIcon className="size-3" />
            <span>占比饼图</span>
          </div>
        </div>
      </div>

      {/* 2. USE 比例图：4 格工控仪表度量条矩阵（真实 Title 与 1:1 结构） */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* 卡片 A：CPU 核心负荷 */}
        <div className="rounded-[2px] border border-border/70 bg-card/70 p-3 shadow-2xs backdrop-blur-xs">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <Cpu className="size-3.5 text-primary" />
              <span>CPU 核心负荷</span>
            </span>
            <Skeleton className="h-4 w-10 rounded-[1px]" />
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-[1px] bg-muted/80">
            <div className="h-full w-1/4 rounded-[1px] bg-primary/40 animate-pulse" />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs font-mono font-medium text-muted-foreground">
            <span>窗口均值 —%</span>
            <span>窗口峰值 —%</span>
          </div>
        </div>

        {/* 卡片 B：物理内存占用 */}
        <div className="rounded-[2px] border border-border/70 bg-card/70 p-3 shadow-2xs backdrop-blur-xs">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <Layers className="size-3.5 text-primary" />
              <span>物理内存占用</span>
            </span>
            <Skeleton className="h-4 w-10 rounded-[1px]" />
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-[1px] bg-muted/80">
            <div className="h-full w-1/2 rounded-[1px] bg-foreground/30 animate-pulse" />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs font-mono font-medium text-muted-foreground">
            <span>实时 —</span>
            <span>均值 —</span>
          </div>
        </div>

        {/* 卡片 C：系统存储占用 */}
        <div className="rounded-[2px] border border-border/70 bg-card/70 p-3 shadow-2xs backdrop-blur-xs">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <HardDrive className="size-3.5 text-primary" />
              <span>系统存储占用</span>
            </span>
            <Skeleton className="h-4 w-10 rounded-[1px]" />
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-[1px] bg-muted/80">
            <div className="h-full w-1/3 rounded-[1px] bg-foreground/30 animate-pulse" />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs font-mono font-medium text-muted-foreground">
            <span>已用 —</span>
            <span>总量 —</span>
          </div>
        </div>

        {/* 卡片 D：网络带宽吞吐 */}
        <div className="rounded-[2px] border border-border/70 bg-card/70 p-3 shadow-2xs backdrop-blur-xs">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <Activity className="size-3.5 text-primary" />
              <span>网络带宽吞吐</span>
            </span>
            <Skeleton className="h-4 w-14 rounded-[1px]" />
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-[1px] bg-muted/80">
            <div className="h-full w-1/5 rounded-[1px] bg-ok/40 animate-pulse" />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs font-mono font-medium text-muted-foreground">
            <span>均值 ↓ —</span>
            <span>均值 ↑ —</span>
          </div>
        </div>
      </div>

      {/* 3. 环形饼图分布模块：3 格卡片（内存分布、磁盘分布、网络流量占比） */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {/* 内存环形饼图 */}
        <div className="relative overflow-visible flex flex-col rounded-[2px] border border-border/70 bg-card/60 p-3 shadow-2xs">
          <div className="border-b border-border/40 pb-1.5 text-xs font-medium text-foreground">
            物理内存分布比例
          </div>
          <div className="relative mt-2 flex h-36 items-center justify-center overflow-visible">
            <div className="relative flex size-28 items-center justify-center rounded-full border-4 border-muted/80 bg-muted/10 animate-pulse">
              <Skeleton className="size-16 rounded-full" />
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <Skeleton className="h-4 w-9 mb-0.5 rounded-[1px]" />
                <span className="text-xs text-muted-foreground font-medium">已用占比</span>
              </div>
            </div>
          </div>
          <div className="mt-1 flex items-center justify-around border-t border-border/30 pt-2 text-xs font-mono font-medium">
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-[0.5px] bg-primary" />
              <span className="text-muted-foreground">已用:</span>
              <Skeleton className="h-3.5 w-12 rounded-[1px]" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-[0.5px] bg-muted-foreground/30" />
              <span className="text-muted-foreground">可用:</span>
              <Skeleton className="h-3.5 w-12 rounded-[1px]" />
            </div>
          </div>
        </div>

        {/* 磁盘环形饼图 */}
        <div className="relative overflow-visible flex flex-col rounded-[2px] border border-border/70 bg-card/60 p-3 shadow-2xs">
          <div className="border-b border-border/40 pb-1.5 text-xs font-medium text-foreground">
            存储空间分布比例
          </div>
          <div className="relative mt-2 flex h-36 items-center justify-center overflow-visible">
            <div className="relative flex size-28 items-center justify-center rounded-full border-4 border-muted/80 bg-muted/10 animate-pulse">
              <Skeleton className="size-16 rounded-full" />
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <Skeleton className="h-4 w-9 mb-0.5 rounded-[1px]" />
                <span className="text-xs text-muted-foreground font-medium">占用比例</span>
              </div>
            </div>
          </div>
          <div className="mt-1 flex items-center justify-around border-t border-border/30 pt-2 text-xs font-mono font-medium">
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-[0.5px] bg-chart-2" />
              <span className="text-muted-foreground">已用:</span>
              <Skeleton className="h-3.5 w-12 rounded-[1px]" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-[0.5px] bg-muted-foreground/30" />
              <span className="text-muted-foreground">剩余:</span>
              <Skeleton className="h-3.5 w-12 rounded-[1px]" />
            </div>
          </div>
        </div>

        {/* 流量比例饼图 */}
        <div className="relative overflow-visible flex flex-col rounded-[2px] border border-border/70 bg-card/60 p-3 shadow-2xs sm:col-span-2 lg:col-span-1">
          <div className="border-b border-border/40 pb-1.5 text-xs font-medium text-foreground">
            今日/窗口流量构成
          </div>
          <div className="relative mt-2 flex h-36 items-center justify-center overflow-visible">
            <div className="relative flex size-28 items-center justify-center rounded-full border-4 border-muted/80 bg-muted/10 animate-pulse">
              <Skeleton className="size-16 rounded-full" />
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <Skeleton className="h-4 w-10 mb-0.5 rounded-[1px]" />
                <span className="text-xs text-muted-foreground font-medium">流量主导</span>
              </div>
            </div>
          </div>
          <div className="mt-1 flex items-center justify-around border-t border-border/30 pt-2 text-xs font-mono font-medium">
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-[0.5px] bg-ok" />
              <span className="text-muted-foreground">下行:</span>
              <Skeleton className="h-3.5 w-12 rounded-[1px]" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-[0.5px] bg-chart-1" />
              <span className="text-muted-foreground">上行:</span>
              <Skeleton className="h-3.5 w-12 rounded-[1px]" />
            </div>
          </div>
        </div>
      </div>

      {/* 4. 负载时段活动热力图 (Heatmap) */}
      <div className="rounded-[2px] border border-border/70 bg-card/60 p-3.5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Flame className="size-3.5 text-warn" />
            <span>24 小时 CPU 负载热力时序矩阵</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
            <span>低负荷 (0%)</span>
            <div className="flex items-center gap-0.5">
              <span className="size-2.5 rounded-[1px] bg-muted/60" />
              <span className="size-2.5 rounded-[1px] bg-emerald-500/30" />
              <span className="size-2.5 rounded-[1px] bg-sky-500/40" />
              <span className="size-2.5 rounded-[1px] bg-amber-500/50" />
              <span className="size-2.5 rounded-[1px] bg-rose-500/70" />
            </div>
            <span>过载 (100%)</span>
          </div>
        </div>

        {/* 24 小时热力网格 */}
        <div className="mt-3 grid gap-1 grid-cols-6 sm:grid-cols-12 md:grid-cols-24">
          {Array.from({ length: 24 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col items-center justify-center rounded-[1px] border border-dashed border-border/40 bg-muted/20 py-1.5 px-0.5 text-center"
            >
              <span className="text-[10px] font-mono leading-tight text-muted-foreground/70">
                {String(i).padStart(2, "0")}:00
              </span>
              <span className="text-xs font-mono font-bold leading-tight mt-0.5 text-muted-foreground/40">
                —
              </span>
            </div>
          ))}
        </div>

        {/* 悬停详情预占位提示条（保持真实 min-h-[38px]） */}
        <div className="mt-2.5 min-h-[38px] flex items-center justify-center rounded-[1px] border border-border/60 bg-muted/30 px-3 py-1.5 text-xs font-mono text-muted-foreground font-medium">
          <Activity className="size-3.5 opacity-60 mr-2" />
          <span>鼠标悬停上方任意时段热力方块，即时查看对应时段 CPU 峰值、内存使用与流量详情</span>
        </div>
      </div>

      {/* 5. 时序曲线走势图（4 张完整卡片，真实 Title 与真实 h-40 高度） */}
      <div className="space-y-4 pt-1">
        {/* CPU 曲线 */}
        <div className="rounded-[2px] border border-border/70 bg-card/60 p-3 shadow-2xs">
          <div className="flex items-center justify-between border-b border-border/40 pb-2 text-xs font-semibold text-foreground">
            <span className="flex items-center gap-1.5">
              <Cpu className="size-3.5 text-primary" />
              <span>CPU 核心使用率走势</span>
            </span>
            <span className="font-mono text-xs font-normal text-muted-foreground">
              当前: — · 均值: — · 峰值: —
            </span>
          </div>
          <div className="mt-2 flex h-40 w-full flex-col justify-between rounded-[2px] border border-border/30 bg-muted/10 p-3">
            <div className="flex flex-1 flex-col justify-around opacity-30">
              <div className="h-px w-full border-t border-dashed border-border" />
              <div className="h-px w-full border-t border-dashed border-border" />
              <div className="h-px w-full border-t border-dashed border-border" />
            </div>
          </div>
        </div>

        {/* 物理内存趋势曲线 */}
        <div className="rounded-[2px] border border-border/70 bg-card/60 p-3 shadow-2xs">
          <div className="flex items-center justify-between border-b border-border/40 pb-2 text-xs font-semibold text-foreground">
            <span className="flex items-center gap-1.5">
              <Layers className="size-3.5 text-primary" />
              <span>物理内存使用趋势</span>
            </span>
            <span className="font-mono text-xs font-normal text-muted-foreground">
              当前: —
            </span>
          </div>
          <div className="mt-2 flex h-40 w-full flex-col justify-between rounded-[2px] border border-border/30 bg-muted/10 p-3">
            <div className="flex flex-1 flex-col justify-around opacity-30">
              <div className="h-px w-full border-t border-dashed border-border" />
              <div className="h-px w-full border-t border-dashed border-border" />
              <div className="h-px w-full border-t border-dashed border-border" />
            </div>
          </div>
        </div>

        {/* 网络速率对数走势 */}
        <div className="rounded-[2px] border border-border/70 bg-card/60 p-3 shadow-2xs">
          <div className="flex items-center justify-between border-b border-border/40 pb-2 text-xs font-semibold text-foreground">
            <span className="flex items-center gap-1.5">
              <Activity className="size-3.5 text-primary" />
              <span>网络传输速率（对数刻度 · 含峰值带）</span>
            </span>
            <span className="font-mono text-xs font-normal text-muted-foreground">
              均值: —
            </span>
          </div>
          <div className="mt-2 flex h-40 w-full flex-col justify-between rounded-[2px] border border-border/30 bg-muted/10 p-3">
            <div className="flex flex-1 flex-col justify-around opacity-30">
              <div className="h-px w-full border-t border-dashed border-border" />
              <div className="h-px w-full border-t border-dashed border-border" />
              <div className="h-px w-full border-t border-dashed border-border" />
            </div>
          </div>
        </div>

        {/* 系统磁盘容量走势 */}
        <div className="rounded-[2px] border border-border/70 bg-card/60 p-3 shadow-2xs">
          <div className="flex items-center justify-between border-b border-border/40 pb-2 text-xs font-semibold text-foreground">
            <span className="flex items-center gap-1.5">
              <HardDrive className="size-3.5 text-primary" />
              <span>系统磁盘容量</span>
            </span>
            <span className="font-mono text-xs font-normal text-muted-foreground">
              当前已用: —
            </span>
          </div>
          <div className="mt-2 flex h-40 w-full flex-col justify-between rounded-[2px] border border-border/30 bg-muted/10 p-3">
            <div className="flex flex-1 flex-col justify-around opacity-30">
              <div className="h-px w-full border-t border-dashed border-border" />
              <div className="h-px w-full border-t border-dashed border-border" />
              <div className="h-px w-full border-t border-dashed border-border" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * 详情页全景完整页面骨架屏（用于初次进入详情页、直接访问链接及 Suspense 等待）
 * 包含顶部全景控制栏、4 格系统规格卡片矩阵、控制栏以及完整的 Title 文字！
 */
export function NodeDetailSkeleton() {
  return (
    <div className="space-y-4 animate-fade-in">
      {/* 1. 顶部全景控制栏（与 NodeSpecs 真实结构与高度 1:1 对齐） */}
      <div className="flex flex-col gap-3 rounded-[2px] border border-border/80 bg-card/80 p-3 shadow-2xs backdrop-blur-xs sm:p-3.5 lg:flex-row lg:items-center lg:justify-between">
        {/* 左侧：主机标识与属性徽章 */}
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-2.5">
          <Skeleton className="h-4 w-6 rounded-[2px]" />
          <Skeleton className="h-6 w-36 rounded-[2px]" />
          <Skeleton className="h-5 w-14 rounded-[2px]" />
          <Skeleton className="h-5 w-16 rounded-[2px] hidden sm:inline-block" />
          <Skeleton className="h-5 w-14 rounded-[2px] hidden sm:inline-block" />
        </div>

        {/* 右侧：实时关键遥测指标胶囊（真实呈现 '运行'、'负载'、'网速' 胶囊尺寸与图标） */}
        <div className="flex w-full min-w-0 flex-col gap-2 text-xs sm:flex-row sm:flex-wrap sm:items-center lg:w-auto">
          <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto">
            {/* 运行时间胶囊 */}
            <div className="flex h-7 min-w-0 flex-1 items-center justify-between gap-1.5 rounded-[2px] border border-border/70 bg-muted/30 px-2.5 shadow-2xs sm:flex-initial sm:min-w-[136px]">
              <div className="flex items-center gap-1.5 shrink-0 text-muted-foreground">
                <Clock className="size-3 text-muted-foreground/80 shrink-0" />
                <span>运行</span>
              </div>
              <Skeleton className="h-3.5 w-14 rounded-[1px]" />
            </div>

            {/* 系统负载胶囊 */}
            <div className="flex h-7 min-w-0 flex-[1.4] items-center justify-between gap-1.5 rounded-[2px] border border-border/70 bg-muted/30 px-2.5 shadow-2xs sm:flex-initial sm:min-w-[185px]">
              <div className="flex items-center gap-1.5 shrink-0 text-muted-foreground">
                <Activity className="size-3 text-muted-foreground/80 shrink-0" />
                <span>负载</span>
              </div>
              <Skeleton className="h-3.5 w-24 rounded-[1px]" />
            </div>
          </div>

          {/* 实时网速吞吐胶囊 */}
          <div className="flex h-7 w-full min-w-0 items-center justify-between gap-2 rounded-[2px] border border-border/70 bg-muted/30 px-2.5 shadow-2xs sm:w-auto sm:justify-start">
            <div className="flex items-center gap-1.5 shrink-0 text-muted-foreground sm:hidden">
              <span>网速</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 shrink-0">
                <ArrowDown className="size-3 text-muted-foreground/80 shrink-0" />
                <Skeleton className="h-3.5 w-12 rounded-[1px]" />
              </div>
              <span className="text-border/80 shrink-0 select-none">·</span>
              <div className="flex items-center gap-1 shrink-0">
                <ArrowUp className="size-3 text-muted-foreground/80 shrink-0" />
                <Skeleton className="h-3.5 w-12 rounded-[1px]" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. 工控规格指标卡片矩阵：4 格结构化展示，包含真实卡片 Title 与真实字段名称 */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* 卡片 1：系统与计算架构 */}
        <div className="rounded-[2px] border border-border/70 bg-card/60 p-3 shadow-2xs backdrop-blur-xs">
          <div className="flex items-center gap-2 border-b border-border/40 pb-2 text-xs font-semibold text-foreground">
            <Server className="size-3.5 text-primary" />
            <span>系统与计算架构</span>
          </div>
          <div className="divide-y divide-border/30 text-xs">
            <div className="flex items-center justify-between py-1.5">
              <span className="text-muted-foreground">操作系统</span>
              <Skeleton className="h-3.5 w-28 rounded-[1px]" />
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-muted-foreground">CPU 处理器</span>
              <Skeleton className="h-3.5 w-32 rounded-[1px]" />
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-muted-foreground">架构 / 虚拟化</span>
              <Skeleton className="h-3.5 w-24 rounded-[1px]" />
            </div>
          </div>
        </div>

        {/* 卡片 2：内存与存储容量 */}
        <div className="rounded-[2px] border border-border/70 bg-card/60 p-3 shadow-2xs backdrop-blur-xs">
          <div className="flex items-center gap-2 border-b border-border/40 pb-2 text-xs font-semibold text-foreground">
            <Cpu className="size-3.5 text-primary" />
            <span>内存与存储容量</span>
          </div>
          <div className="divide-y divide-border/30 text-xs">
            <div className="py-1.5">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">物理内存</span>
                <Skeleton className="h-3.5 w-24 rounded-[1px]" />
              </div>
              <div className="mt-1 h-1 w-full overflow-hidden rounded-[1px] bg-muted/80">
                <div className="h-full w-2/5 rounded-[1px] bg-primary/40 animate-pulse" />
              </div>
            </div>
            <div className="py-1.5">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">交换分区 Swap</span>
                <Skeleton className="h-3.5 w-20 rounded-[1px]" />
              </div>
              <div className="mt-1 h-1 w-full overflow-hidden rounded-[1px] bg-muted/80">
                <div className="h-full w-1/5 rounded-[1px] bg-chart-3/40 animate-pulse" />
              </div>
            </div>
            <div className="py-1.5">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">磁盘空间</span>
                <Skeleton className="h-3.5 w-24 rounded-[1px]" />
              </div>
              <div className="mt-1 h-1 w-full overflow-hidden rounded-[1px] bg-muted/80">
                <div className="h-full w-1/3 rounded-[1px] bg-primary/40 animate-pulse" />
              </div>
            </div>
          </div>
        </div>

        {/* 卡片 3：网络吞吐与流量 */}
        <div className="rounded-[2px] border border-border/70 bg-card/60 p-3 shadow-2xs backdrop-blur-xs">
          <div className="flex items-center gap-2 border-b border-border/40 pb-2 text-xs font-semibold text-foreground">
            <Activity className="size-3.5 text-primary" />
            <span>网络吞吐与流量</span>
          </div>
          <div className="divide-y divide-border/30 text-xs">
            <div className="flex items-center justify-between py-1.5">
              <span className="text-muted-foreground">实时速率</span>
              <Skeleton className="h-3.5 w-28 rounded-[1px]" />
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-muted-foreground">今日流量</span>
              <Skeleton className="h-3.5 w-24 rounded-[1px]" />
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-muted-foreground">本月用量</span>
              <Skeleton className="h-3.5 w-28 rounded-[1px]" />
            </div>
          </div>
        </div>

        {/* 卡片 4：服务周期与连接 */}
        <div className="rounded-[2px] border border-border/70 bg-card/60 p-3 shadow-2xs backdrop-blur-xs">
          <div className="flex items-center gap-2 border-b border-border/40 pb-2 text-xs font-semibold text-foreground">
            <Calendar className="size-3.5 text-primary" />
            <span>服务周期与连接</span>
          </div>
          <div className="divide-y divide-border/30 text-xs">
            <div className="flex items-center justify-between py-1.5">
              <span className="text-muted-foreground">资费周期</span>
              <Skeleton className="h-3.5 w-20 rounded-[1px]" />
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-muted-foreground">到期时间</span>
              <Skeleton className="h-3.5 w-24 rounded-[1px]" />
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-muted-foreground">连接追踪</span>
              <Skeleton className="h-3.5 w-20 rounded-[1px]" />
            </div>
          </div>
        </div>
      </div>

      {/* 3. 详情监控主视图控制栏（与 NodeDetail 控制栏 1:1 对齐） */}
      <div className="space-y-2.5 border-t border-border/70 pt-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* 标签页选择器 */}
          <div className="flex items-center gap-1 rounded-[2px] border border-border/70 bg-muted/40 p-0.5">
            <div className="rounded-[1px] px-3 py-1 text-xs font-semibold bg-primary text-primary-foreground shadow-2xs">
              系统资源监控
            </div>
            <div className="rounded-[1px] px-3 py-1 text-xs font-medium text-muted-foreground">
              网络延迟质量
            </div>
          </div>

          {/* 时间跨度窗口选择器 */}
          <div className="flex flex-wrap items-center gap-1">
            {["1 小时", "6 小时", "24 小时", "3 天", "7 天"].map((label, idx) => (
              <div
                key={label}
                className={`rounded-[2px] py-1 text-xs font-medium px-1.5 sm:px-2.5 ${
                  idx === 1
                    ? "bg-primary text-primary-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground"
                }`}
              >
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. 默认呈现对应真实的资源图表高保真骨架 */}
      <DetailChartSkeleton tab="resources" />
    </div>
  )
}
