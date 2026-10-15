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
  Network,
  PieChart as PieIcon,
  Radio,
  Server,
  TrendingUp,
  Wifi,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { UptimeSlaBarSkeleton } from "@/components/UptimeSlaBar"

/**
 * 核心遥测指标图表局部骨架屏（针对资源监控 vs 网络延迟双视图精准适配）
 */
export function DetailChartSkeleton({
  tab = "resources",
  hours = 24,
}: {
  tab?: "resources" | "latency"
  hours?: number
}) {
  if (tab === "latency") {
    return (
      <div className="space-y-4 animate-fade-in">
        {/* 顶部控制栏与视图切换（移动端响应式分行与防文字折行） */}
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 pb-2.5">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <Wifi className="size-4 text-primary shrink-0" />
            <span className="font-semibold text-foreground text-xs whitespace-nowrap">网络延迟拓扑测控</span>
            <Badge className="h-4.5 rounded-[1px] px-1.5 text-[11px] font-mono text-muted-foreground border-border/60 shrink-0">
              x 条测试线路
            </Badge>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3 flex-wrap">
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground select-none opacity-70 shrink-0">
              <input type="checkbox" disabled className="accent-foreground rounded-[1px]" />
              <span className="whitespace-nowrap">智能削峰</span>
            </label>

            <div className="flex items-center gap-1 rounded-[2px] border border-border/60 bg-muted/30 p-0.5 text-xs overflow-x-auto no-scrollbar shrink-0">
              <div className="flex items-center gap-1 rounded-[1px] bg-primary px-2 py-0.5 text-primary-foreground font-medium shadow-2xs whitespace-nowrap shrink-0">
                <TrendingUp className="size-3 shrink-0" />
                <span className="whitespace-nowrap">聚合对比</span>
              </div>
              <div className="flex items-center gap-1 rounded-[1px] px-2 py-0.5 text-muted-foreground whitespace-nowrap shrink-0">
                <Grid className="size-3 shrink-0" />
                <span className="whitespace-nowrap">分轨矩阵</span>
              </div>
              <div className="flex items-center gap-1 rounded-[1px] px-2 py-0.5 text-muted-foreground whitespace-nowrap shrink-0">
                <BarChart2 className="size-3 shrink-0" />
                <span className="whitespace-nowrap">延迟排行</span>
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
      {/* 视图模式切换胶囊与历史归档显性标识 */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 pb-2.5">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Activity className="size-3.5 text-primary shrink-0" />
            <span className="whitespace-nowrap">历史时序分析测控</span>
            <span className="font-mono text-[11px] font-normal text-muted-foreground">
              · Historical Analytics
            </span>
          </div>
          <span className="rounded-[2px] border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-mono font-medium text-primary shadow-2xs">
            ARCHIVE · 采样窗口：近 {hours} 小时
          </span>
        </div>

        <div className="flex items-center gap-1 rounded-[2px] border border-border/60 bg-muted/30 p-0.5 text-xs overflow-x-auto no-scrollbar max-w-full shrink-0">
          <div className="flex items-center justify-center gap-1 rounded-[1px] px-2 py-0.5 bg-primary text-primary-foreground font-medium shadow-2xs whitespace-nowrap shrink-0">
            <Activity className="size-3 shrink-0" />
            <span className="whitespace-nowrap">全景仪表</span>
          </div>
          <div className="flex items-center justify-center gap-1 rounded-[1px] px-2 py-0.5 text-muted-foreground whitespace-nowrap shrink-0">
            <TrendingUp className="size-3 shrink-0" />
            <span className="whitespace-nowrap">时序曲线</span>
          </div>
          <div className="flex items-center justify-center gap-1 rounded-[1px] px-2 py-0.5 text-muted-foreground whitespace-nowrap shrink-0">
            <Flame className="size-3 shrink-0" />
            <span className="whitespace-nowrap">负载热力</span>
          </div>
          <div className="flex items-center justify-center gap-1 rounded-[1px] px-2 py-0.5 text-muted-foreground whitespace-nowrap shrink-0">
            <PieIcon className="size-3 shrink-0" />
            <span className="whitespace-nowrap">占比饼图</span>
          </div>
          <div className="flex items-center justify-center gap-1 rounded-[1px] px-2 py-0.5 text-muted-foreground whitespace-nowrap shrink-0">
            <Network className="size-3 shrink-0" />
            <span className="whitespace-nowrap">连接进程</span>
          </div>
        </div>
      </div>

      {/* 1. 时间窗口聚合统计指标骨架：与真实 ResourceCharts 窗口均值/峰值 1:1 对齐 */}
      <div className="space-y-3">
        {/* 基础资源 4 格度量卡片骨架 */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* 卡片 A：CPU 窗口负荷 */}
          <div className="rounded-[2px] border border-border/70 bg-card/60 p-3 shadow-2xs backdrop-blur-xs">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <Cpu className="size-3.5 text-primary" />
                <span>CPU 窗口负荷</span>
              </span>
              <div className="text-right">
                <Skeleton className="h-4 w-10 rounded-[1px]" />
              </div>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-[1px] bg-muted/80">
              <div className="h-full w-1/4 rounded-[1px] bg-primary/40 animate-pulse" />
            </div>
            <div className="mt-3 border-t border-border/30 pt-2 text-[11px] font-mono text-muted-foreground flex items-center justify-between">
              <span>窗口均值 —%</span>
              <span className="font-semibold text-foreground">峰值 —%</span>
            </div>
          </div>

          {/* 卡片 B：物理内存统计 */}
          <div className="rounded-[2px] border border-border/70 bg-card/60 p-3 shadow-2xs backdrop-blur-xs">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <Layers className="size-3.5 text-primary" />
                <span>物理内存统计</span>
              </span>
              <div className="text-right">
                <Skeleton className="h-4 w-14 rounded-[1px]" />
              </div>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-[1px] bg-muted/80">
              <div className="h-full w-1/2 rounded-[1px] bg-foreground/30 animate-pulse" />
            </div>
            <div className="mt-3 border-t border-border/30 pt-2 text-[11px] font-mono text-muted-foreground flex items-center justify-between">
              <span>上限 —</span>
              <span className="font-medium text-foreground">窗口最高 —</span>
            </div>
          </div>

          {/* 卡片 C：网络吞吐均值 */}
          <div className="rounded-[2px] border border-border/70 bg-card/60 p-3 shadow-2xs backdrop-blur-xs">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <Activity className="size-3.5 text-primary" />
                <span>网络吞吐均值</span>
              </span>
              <Skeleton className="h-4 w-20 rounded-[1px]" />
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-[1px] bg-muted/80">
              <div className="h-full w-1/3 rounded-[1px] bg-primary/40 animate-pulse" />
            </div>
            <div className="mt-3 border-t border-border/30 pt-2 text-[11px] font-mono text-muted-foreground flex items-center justify-between">
              <span>吞吐峰值 (Peak):</span>
              <span className="font-semibold text-foreground">↓ — · ↑ —</span>
            </div>
          </div>

          {/* 卡片 D：存储与计划用量 */}
          <div className="rounded-[2px] border border-border/70 bg-card/60 p-3 shadow-2xs backdrop-blur-xs">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <HardDrive className="size-3.5 text-primary" />
                <span>存储与计划用量</span>
              </span>
              <Skeleton className="h-4 w-12 rounded-[1px]" />
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-[1px] bg-muted/80">
              <div className="h-full w-2/5 rounded-[1px] bg-foreground/30 animate-pulse" />
            </div>
            <div className="mt-3 border-t border-border/30 pt-2 text-[11px] font-mono text-muted-foreground flex items-center justify-between">
              <span>已用 — / —</span>
              <span className="font-medium text-foreground">月耗 —%</span>
            </div>
          </div>
        </div>

        {/* 套接字连接与系统进程 3 格度量卡片骨架 */}
        <div className="grid gap-3 sm:grid-cols-3">
          {/* TCP 活跃连接 */}
          <div className="rounded-[2px] border border-border/70 bg-card/60 p-3 shadow-2xs backdrop-blur-xs">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <Network className="size-3.5 text-primary" />
                <span>TCP 活跃连接数</span>
              </span>
              <Skeleton className="h-4 w-10 rounded-[1px]" />
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-[1px] bg-muted/80">
              <div className="h-full w-1/3 rounded-[1px] bg-primary/40 animate-pulse" />
            </div>
            <div className="mt-3 border-t border-border/30 pt-2 text-[11px] font-mono text-muted-foreground flex items-center justify-between">
              <span>窗口均值 —</span>
              <span className="font-semibold text-foreground">峰值 —</span>
            </div>
          </div>

          {/* UDP 监听套接字 */}
          <div className="rounded-[2px] border border-border/70 bg-card/60 p-3 shadow-2xs backdrop-blur-xs">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <Activity className="size-3.5 text-chart-2" />
                <span>UDP 监听套接字</span>
              </span>
              <Skeleton className="h-4 w-10 rounded-[1px]" />
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-[1px] bg-muted/80">
              <div className="h-full w-1/4 rounded-[1px] bg-chart-2/40 animate-pulse" />
            </div>
            <div className="mt-3 border-t border-border/30 pt-2 text-[11px] font-mono text-muted-foreground flex items-center justify-between">
              <span>窗口均值 —</span>
              <span className="font-semibold text-foreground">峰值 —</span>
            </div>
          </div>

          {/* 系统进程总数 */}
          <div className="rounded-[2px] border border-border/70 bg-card/60 p-3 shadow-2xs backdrop-blur-xs">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <Layers className="size-3.5 text-chart-1" />
                <span>系统活跃进程 (Procs)</span>
              </span>
              <Skeleton className="h-4 w-10 rounded-[1px]" />
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-[1px] bg-muted/80">
              <div className="h-full w-2/5 rounded-[1px] bg-chart-1/40 animate-pulse" />
            </div>
            <div className="mt-3 border-t border-border/30 pt-2 text-[11px] font-mono text-muted-foreground flex items-center justify-between">
              <span>窗口均值 —</span>
              <span className="font-semibold text-foreground">峰值 —</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. 服务可用性与在线率 SLA 骨架条（置于 24 时段热力矩阵上方） */}
      <UptimeSlaBarSkeleton hours={hours} />

      {/* 3. 负载时段活动热力图 (Heatmap) */}
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

      {/* 4. 核心 2x2 并列时序走势图骨架（与全景仪表 overview 1:1 精准像素级对齐，杜绝高度抖动） */}
      <div className="grid gap-3 grid-cols-1 lg:grid-cols-2 pt-1">
        {/* CPU 曲线骨架 */}
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

        {/* 物理内存趋势曲线骨架 */}
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

        {/* 网络速率对数走势骨架 */}
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

        {/* TCP & UDP 并发连接走势图骨架 */}
        <div className="rounded-[2px] border border-border/70 bg-card/60 p-3 shadow-2xs">
          <div className="flex items-center justify-between border-b border-border/40 pb-2 text-xs font-semibold text-foreground">
            <span className="flex items-center gap-1.5">
              <Network className="size-3.5 text-primary" />
              <span>TCP / UDP 网络套接字时序走势</span>
            </span>
            <span className="font-mono text-xs font-normal text-muted-foreground">
              当前: TCP — · UDP —
            </span>
          </div>
          <div className="mt-2 flex h-40 w-full flex-col justify-between rounded-[2px] border border-border/30 bg-muted/10 p-3">
            <div className="flex flex-1 flex-col justify-around opacity-30">
              <div className="h-px w-full border-t border-dashed border-border" />
              <div className="h-px w-full border-t border-dashed border-border" />
              <div className="h-px w-full border-t border-dashed border-border" />
            </div>
          </div>
          <div className="mt-2 flex items-center justify-end gap-4 border-t border-border/30 pt-1.5 text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-[0.5px] bg-primary" />
              <span className="text-muted-foreground">TCP 活跃连接</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-[0.5px] bg-chart-2" />
              <span className="text-muted-foreground">UDP 监听套接字</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * 实时遥测动态测控驾驶舱骨架屏 (Live Telemetry Dashboard Skeleton)
 * 与 LiveTelemetryBoard 真实组件 1:1 像素级高度与层级对齐
 */
export function LiveTelemetryBoardSkeleton() {
  return (
    <div className="space-y-2.5 rounded-[2px] border border-border/80 bg-card/70 p-3 shadow-2xs backdrop-blur-xs sm:p-3.5">
      {/* 顶部标题栏：显性 LIVE 标识、长连接刷新提示与心跳状态 */}
      <div className="flex flex-col gap-2 border-b border-border/50 pb-2.5 sm:flex-row sm:items-center sm:justify-between">
        {/* 左侧：实时状态主标识 */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Radio className="size-3.5 text-online" />
            <span>实时遥测驾驶舱</span>
            <span className="font-mono text-[11px] font-normal text-muted-foreground">
              · Live Telemetry
            </span>
          </div>

          <div className="flex items-center gap-1.5 rounded-[2px] border border-online/30 bg-online/10 px-2 py-0.5 text-[11px] font-mono font-medium text-online shadow-2xs">
            <span className="size-1.5 rounded-[0.5px] bg-online pulse-online" />
            <span>LIVE 实时流 · 2s 自动推送</span>
          </div>
        </div>

        {/* 右侧：心跳上报频率与系统连续运行时长 */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-muted-foreground sm:justify-end">
          <div className="flex items-center gap-1 rounded-[1px] border border-border/60 bg-muted/40 px-2 py-0.5">
            <Clock className="size-3 text-muted-foreground/70 shrink-0" />
            <span>运行:</span>
            <Skeleton className="h-3.5 w-14 rounded-[1px]" />
          </div>

          <div className="flex items-center gap-1 rounded-[1px] border border-border/60 bg-muted/40 px-2 py-0.5">
            <span>心跳:</span>
            <Skeleton className="h-3.5 w-10 rounded-[1px]" />
          </div>
        </div>
      </div>

      {/* 4 格工控实时动态仪表矩阵 */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* 卡片 1：实时 CPU 负荷与系统负载 */}
        <div className="flex flex-col justify-between rounded-[2px] border border-border/70 bg-card/60 p-3 shadow-2xs">
          <div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <Cpu className="size-3.5 text-primary" />
                <span>CPU 实时负荷</span>
              </span>
              <Skeleton className="h-4 w-12 rounded-[1px]" />
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-[1px] bg-muted/80">
              <div className="h-full w-1/4 rounded-[1px] bg-primary/40 animate-pulse" />
            </div>
          </div>
          <div className="mt-3 border-t border-border/30 pt-2 text-[11px] font-mono text-muted-foreground flex items-center justify-between">
            <span className="text-muted-foreground/80">系统负载:</span>
            <Skeleton className="h-3.5 w-24 rounded-[1px]" />
          </div>
        </div>

        {/* 卡片 2：实时物理内存与 Swap */}
        <div className="flex flex-col justify-between rounded-[2px] border border-border/70 bg-card/60 p-3 shadow-2xs">
          <div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <Layers className="size-3.5 text-primary" />
                <span>物理内存占用</span>
              </span>
              <Skeleton className="h-4 w-20 rounded-[1px]" />
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-[1px] bg-muted/80">
              <div className="h-full w-2/5 rounded-[1px] bg-primary/40 animate-pulse" />
            </div>
          </div>
          <div className="mt-3 border-t border-border/30 pt-2 text-[11px] font-mono text-muted-foreground flex items-center justify-between">
            <span className="text-muted-foreground/80">交换空间:</span>
            <Skeleton className="h-3.5 w-20 rounded-[1px]" />
          </div>
        </div>

        {/* 卡片 3：实时瞬时带宽与在线连接 */}
        <div className="flex flex-col justify-between rounded-[2px] border border-border/70 bg-card/60 p-3 shadow-2xs">
          <div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <Activity className="size-3.5 text-primary" />
                <span>实时网络速率</span>
              </span>
              <div className="flex items-center gap-1.5 font-mono text-xs">
                <span className="flex items-center gap-0.5 text-primary">
                  <ArrowDown className="size-3" />
                  <Skeleton className="h-3.5 w-12 rounded-[1px]" />
                </span>
                <span className="text-border select-none">·</span>
                <span className="flex items-center gap-0.5 text-foreground/90">
                  <ArrowUp className="size-3" />
                  <Skeleton className="h-3.5 w-12 rounded-[1px]" />
                </span>
              </div>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-[1px] bg-muted/80">
              <div className="h-full w-1/3 rounded-[1px] bg-primary/40 animate-pulse" />
            </div>
          </div>
          <div className="mt-3 border-t border-border/30 pt-2 text-[11px] font-mono text-muted-foreground flex items-center justify-between">
            <span className="text-muted-foreground/80">通信连接:</span>
            <Skeleton className="h-3.5 w-24 rounded-[1px]" />
          </div>
        </div>

        {/* 卡片 4：实时磁盘存储与运行进程 */}
        <div className="flex flex-col justify-between rounded-[2px] border border-border/70 bg-card/60 p-3 shadow-2xs">
          <div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <HardDrive className="size-3.5 text-primary" />
                <span>存储空间占用</span>
              </span>
              <Skeleton className="h-4 w-20 rounded-[1px]" />
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-[1px] bg-muted/80">
              <div className="h-full w-2/5 rounded-[1px] bg-primary/40 animate-pulse" />
            </div>
          </div>
          <div className="mt-3 border-t border-border/30 pt-2 text-[11px] font-mono text-muted-foreground flex items-center justify-between">
            <span className="text-muted-foreground/80">活跃进程 / 今日吞吐:</span>
            <Skeleton className="h-3.5 w-28 rounded-[1px]" />
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * 详情页全景完整页面骨架屏（用于初次进入详情页、直接访问链接及 Suspense 等待）
 * 包含静态资产档案、实时遥测驾驶舱、时间控制栏及历史时序测控完整高保真骨架！
 */
export function NodeDetailSkeleton() {
  return (
    <div className="space-y-4 animate-fade-in">
      {/* 1. 顶部全景控制栏：主机标识与规格概括（与 NodeSpecs 真实结构与高度 1:1 对齐） */}
      <div className="flex flex-col gap-3 rounded-[2px] border border-border/80 bg-card/80 p-3 shadow-2xs backdrop-blur-xs sm:p-3.5 lg:flex-row lg:items-center lg:justify-between">
        {/* 左侧：主机标识与属性徽章 */}
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-2.5">
          <Skeleton className="h-4 w-6 rounded-[2px]" />
          <Skeleton className="h-6 w-36 rounded-[2px]" />
          <Skeleton className="h-5 w-14 rounded-[2px]" />
          <Skeleton className="h-5 w-16 rounded-[2px] hidden sm:inline-block" />
          <Skeleton className="h-5 w-14 rounded-[2px] hidden sm:inline-block" />
        </div>

        {/* 右侧：节点核心网络标识与规格概括 */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-muted-foreground">
          <div className="flex items-center gap-1 rounded-[1px] border border-border/60 bg-muted/30 px-2 py-0.5">
            <span className="text-muted-foreground/70">IP:</span>
            <Skeleton className="h-3.5 w-24 rounded-[1px]" />
          </div>
          <div className="flex items-center gap-1 rounded-[1px] border border-border/60 bg-muted/30 px-2 py-0.5">
            <span className="text-muted-foreground/70">规格:</span>
            <Skeleton className="h-3.5 w-32 rounded-[1px]" />
          </div>
        </div>
      </div>

      {/* 2. 工控资产规格卡片矩阵：4 格结构化展示静态配置与服务档案 */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* 卡片 A：系统与计算架构 */}
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

        {/* 卡片 B：硬件物理总容量 */}
        <div className="rounded-[2px] border border-border/70 bg-card/60 p-3 shadow-2xs backdrop-blur-xs">
          <div className="flex items-center gap-2 border-b border-border/40 pb-2 text-xs font-semibold text-foreground">
            <Cpu className="size-3.5 text-primary" />
            <span>硬件物理总容量</span>
          </div>
          <div className="divide-y divide-border/30 text-xs">
            <div className="flex items-center justify-between py-1.5">
              <span className="text-muted-foreground">物理内存上限</span>
              <Skeleton className="h-3.5 w-20 rounded-[1px]" />
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-muted-foreground">交换空间 Swap</span>
              <Skeleton className="h-3.5 w-20 rounded-[1px]" />
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-muted-foreground">存储主盘容量</span>
              <Skeleton className="h-3.5 w-20 rounded-[1px]" />
            </div>
          </div>
        </div>

        {/* 卡片 C：网络计划与配额 */}
        <div className="rounded-[2px] border border-border/70 bg-card/60 p-3 shadow-2xs backdrop-blur-xs">
          <div className="flex items-center gap-2 border-b border-border/40 pb-2 text-xs font-semibold text-foreground">
            <Activity className="size-3.5 text-primary" />
            <span>网络计划与配额</span>
          </div>
          <div className="divide-y divide-border/30 text-xs">
            <div className="flex items-center justify-between py-1.5">
              <span className="text-muted-foreground">月度计划配额</span>
              <Skeleton className="h-3.5 w-24 rounded-[1px]" />
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-muted-foreground">重置结算日</span>
              <Skeleton className="h-3.5 w-20 rounded-[1px]" />
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-muted-foreground">计量模式</span>
              <Skeleton className="h-3.5 w-24 rounded-[1px]" />
            </div>
          </div>
        </div>

        {/* 卡片 D：服务周期与资费 */}
        <div className="rounded-[2px] border border-border/70 bg-card/60 p-3 shadow-2xs backdrop-blur-xs">
          <div className="flex items-center gap-2 border-b border-border/40 pb-2 text-xs font-semibold text-foreground">
            <Calendar className="size-3.5 text-primary" />
            <span>服务周期与资费</span>
          </div>
          <div className="divide-y divide-border/30 text-xs">
            <div className="flex items-center justify-between py-1.5">
              <span className="text-muted-foreground">资费周期</span>
              <Skeleton className="h-3.5 w-24 rounded-[1px]" />
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-muted-foreground">到期时间</span>
              <Skeleton className="h-3.5 w-28 rounded-[1px]" />
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-muted-foreground">计费周期</span>
              <Skeleton className="h-3.5 w-20 rounded-[1px]" />
            </div>
          </div>
        </div>
      </div>

      {/* 3. 实时遥测驾驶舱高保真骨架 */}
      <LiveTelemetryBoardSkeleton />

      {/* 4. 详情监控主视图控制栏（与 NodeDetail 控制栏 1:1 对齐，移动端响应式防换行） */}
      <div className="space-y-2.5 border-t border-border/70 pt-3.5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {/* 标签页选择器（与真实 NodeDetail TABS: '资源' / '网络延迟' 1:1 完全对齐） */}
          <div className="flex items-center gap-1 rounded-[2px] border border-border/70 bg-muted/40 p-0.5 shrink-0 self-start">
            <div className="rounded-[1px] px-3 py-1 text-xs font-semibold bg-primary text-primary-foreground shadow-2xs whitespace-nowrap shrink-0">
              资源
            </div>
            <div className="rounded-[1px] px-3 py-1 text-xs font-medium text-muted-foreground whitespace-nowrap shrink-0">
              网络延迟
            </div>
          </div>

          {/* 时间跨度窗口选择器（支持平滑滚动，禁止折行） */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar max-w-full shrink-0">
            {["1 小时", "6 小时", "24 小时", "3 天", "7 天"].map((label, idx) => (
              <div
                key={label}
                className={`rounded-[2px] py-1 text-xs font-medium px-1.5 sm:px-2.5 whitespace-nowrap shrink-0 ${
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

      {/* 5. 默认呈现对应真实的资源图表高保真骨架（内部已在热力矩阵上方包含 SLA 骨架） */}
      <DetailChartSkeleton tab="resources" hours={6} />
    </div>
  )
}
