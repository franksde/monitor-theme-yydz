/**
 * 全球国家与地区国旗图标映射表
 * 提取自 country-flag-icons，按需加载 SVG URL，防止全量打包膨胀
 * 遵循 AGENT.md 规范
 */

export const FLAGS: Record<string, string> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>("/node_modules/country-flag-icons/3x2/*.svg", {
      query: "?url",
      import: "default",
      eager: true,
    }),
  ).map(([path, url]) => [path.match(/([\w-]+)\.svg$/)![1], url]),
)
