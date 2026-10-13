import { useId } from "react"
import { ArrowUpDown, Search, X } from "lucide-react"

import { cn } from "@/lib/utils"

export type SortMode =
  | "default"
  | "cpu_desc"
  | "mem_desc"
  | "net_desc"
  | "expires_asc"
  | "traffic_desc"

export type FilterStatus = "all" | "online" | "offline"

export type NodeFilterBarProps = {
  search: string
  onSearchChange: (value: string) => void
  sort: SortMode
  onSortChange: (value: SortMode) => void
  status: FilterStatus
  onStatusChange: (status: FilterStatus) => void
  totalCount: number
  filteredCount: number
  offlineCount: number
}

const SORT_OPTIONS: { label: string; value: SortMode }[] = [
  { label: "默认顺序", value: "default" },
  { label: "CPU 负荷 ↓", value: "cpu_desc" },
  { label: "内存占用 ↓", value: "mem_desc" },
  { label: "实时网速 ↓", value: "net_desc" },
  { label: "到期紧迫 ↑", value: "expires_asc" },
  { label: "月度用量 ↓", value: "traffic_desc" },
]

/**
 * 首页节点列表多维过滤与动态排序控制栏
 * 具备：关键字即时搜索、状态微切（全部/在线/离线）、指标动态排序、匹配计数与一键重置
 * 遵循 AGENT.md 规范：微倒角 (2px/1px)、工控极简风、全中文注释
 */
export function NodeFilterBar({
  search,
  onSearchChange,
  sort,
  onSortChange,
  status,
  onStatusChange,
  totalCount,
  filteredCount,
  offlineCount,
}: NodeFilterBarProps) {
  const searchInputId = useId()
  const isFiltered = search.trim() !== "" || status !== "all" || sort !== "default"

  return (
    <div className="flex flex-col gap-2 rounded-[2px] border border-border/70 bg-card/70 p-2 text-xs shadow-2xs backdrop-blur-xs transition-colors sm:flex-row sm:items-center sm:justify-between">
      {/* 左侧：搜索框、状态快筛与筛选结果提示（置于排序选择器左侧，防止右侧 select 框抖动） */}
      <div className="flex flex-1 flex-wrap items-center gap-2 min-w-0">
        {/* 1. 关键字搜索输入框 */}
        <div className="relative flex min-w-[180px] flex-1 items-center sm:max-w-[260px]">
          <Search className="pointer-events-none absolute left-2 size-3.5 text-muted-foreground" />
          <input
            id={searchInputId}
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="搜索节点名 / 架构 / 地区 / 备注..."
            className="h-7 w-full rounded-[2px] border border-border/70 bg-muted/40 pl-7 pr-7 text-xs text-foreground placeholder:text-muted-foreground/60 transition-colors focus:border-primary/80 focus:bg-background focus:outline-hidden"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-1.5 flex size-4 items-center justify-center rounded-[1px] text-muted-foreground hover:bg-muted hover:text-foreground"
              title="清空搜索"
            >
              <X className="size-3" />
            </button>
          )}
        </div>

        {/* 2. 在线/离线状态快速胶囊过滤 */}
        <div className="flex items-center gap-0.5 rounded-[2px] border border-border/60 bg-muted/30 p-0.5 shrink-0">
          <button
            type="button"
            onClick={() => onStatusChange("all")}
            className={cn(
              "rounded-[1px] px-2 py-0.5 font-medium transition-colors",
              status === "all"
                ? "bg-primary text-primary-foreground shadow-2xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            全部 ({totalCount})
          </button>
          <button
            type="button"
            onClick={() => onStatusChange("online")}
            className={cn(
              "rounded-[1px] px-2 py-0.5 font-medium transition-colors",
              status === "online"
                ? "bg-primary text-primary-foreground shadow-2xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            在线
          </button>
          {offlineCount > 0 && (
            <button
              type="button"
              onClick={() => onStatusChange("offline")}
              className={cn(
                "rounded-[1px] px-2 py-0.5 font-medium transition-colors",
                status === "offline"
                  ? "bg-warn text-warn-foreground shadow-2xs"
                  : "text-warn hover:underline",
              )}
            >
              离线 ({offlineCount})
            </button>
          )}
        </div>

        {/* 3. 筛选结果指示与重置按钮（位于 select 左侧，出现或消失绝不引起最右侧 select 框抖动） */}
        {isFiltered && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground shrink-0 animate-fade-in">
            <span>
              已筛出 <strong className="font-mono text-foreground">{filteredCount}</strong> 台
            </span>
            <button
              type="button"
              onClick={() => {
                onSearchChange("")
                onStatusChange("all")
                onSortChange("default")
              }}
              className="rounded-[1px] px-1 py-0.5 text-primary hover:underline font-medium"
            >
              重置
            </button>
          </div>
        )}
      </div>

      {/* 右侧：多维指标排序下拉（固定右对齐，暗色模式背景自适应） */}
      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto sm:ml-auto">
        <ArrowUpDown className="size-3 shrink-0 text-muted-foreground" />
        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value as SortMode)}
          style={{ backgroundColor: "var(--color-card)", color: "var(--color-foreground)" }}
          className="h-7 rounded-[2px] border border-border/70 bg-card px-2 py-0.5 font-medium text-foreground transition-colors hover:border-border focus:border-primary/80 focus:outline-hidden cursor-pointer"
        >
          {SORT_OPTIONS.map((opt) => (
            <option
              key={opt.value}
              value={opt.value}
              style={{ backgroundColor: "var(--color-card)", color: "var(--color-foreground)" }}
              className="bg-card text-foreground"
            >
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
