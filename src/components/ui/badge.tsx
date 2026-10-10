import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * 徽标组件
 * 遵循 AGENT.md 规范：采用精密微倒角 rounded-[2px]，替代过去的胶囊大圆角形态
 */
function Badge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="badge"
      className={cn(
        "inline-flex w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-[2px] border border-border/80 bg-muted/40 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-foreground transition-colors duration-150 [&>svg]:pointer-events-none [&>svg]:size-3",
        className
      )}
      {...props}
    />
  )
}

export { Badge }

