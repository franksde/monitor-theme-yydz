import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * 基础卡片外壳组件
 * 遵循 AGENT.md 规范：采用微倒角 rounded-[2px]，具备细腻边框和响应式平滑过渡
 */
function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "flex flex-col gap-6 rounded-[2px] border border-border/80 bg-card py-6 text-card-foreground shadow-xs transition-all duration-200",
        className
      )}
      {...props}
    />
  )
}

export { Card }

