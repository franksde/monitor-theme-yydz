/** 图表交互共用主题变量；保留序列配色，消除组件库默认浅色遮罩及白色描边。 */
export const CHART_TOOLTIP = {
  contentStyle: {
    background: "var(--color-card)",
    border: "1px solid var(--color-border)",
    borderRadius: 2,
    color: "var(--color-card-foreground)",
    fontSize: 12,
  },
  labelStyle: { color: "var(--color-muted-foreground)" },
  itemStyle: { color: "var(--color-card-foreground)" },
  cursor: {
    fill: "var(--color-muted)",
    fillOpacity: 0.55,
    stroke: "var(--color-muted-foreground)",
    strokeOpacity: 0.4,
  },
  wrapperStyle: { zIndex: 30, maxWidth: "calc(100vw - 2rem)", pointerEvents: "none" as const },
  isAnimationActive: false,
}

/** 活动点中心沿用各序列颜色，边缘随卡片背景变化。 */
export const CHART_ACTIVE_DOT = { r: 3, stroke: "var(--color-card)", strokeWidth: 2 }
