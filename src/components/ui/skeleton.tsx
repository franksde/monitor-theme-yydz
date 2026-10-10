import { cn } from "@/lib/utils"

/**
 * 骨架屏占位组件
 * 遵循 AGENT.md 规范：采用微倒角 rounded-[2px]，具有柔和的呼吸渐变动画
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-[2px] bg-muted/60 border border-border/40", className)}
      {...props}
    />
  )
}

export { Skeleton }

