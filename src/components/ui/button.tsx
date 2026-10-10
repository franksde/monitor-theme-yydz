import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * 按钮变体样式定义
 * 遵循 AGENT.md 规范：严格采用微倒角 rounded-[2px]，加入平滑的 hover/active 交互动效
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-[2px] text-sm font-medium whitespace-nowrap transition-all duration-150 outline-none focus-visible:border-ring focus-visible:ring-[2px] focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border/60",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/60",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 gap-1.5 rounded-[2px] px-3 has-[>svg]:px-2.5 text-xs",
        icon: "size-9 rounded-[2px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)


function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button }
