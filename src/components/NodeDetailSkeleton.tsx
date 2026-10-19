import { Skeleton } from "@/components/ui/skeleton"
import { UptimeSlaBarSkeleton } from "@/components/UptimeSlaBar"

/** 历史分析骨架与默认图表优先排布对齐，不展示已经移除的视图选项。 */
export function DetailChartSkeleton({
  tab = "resources",
  hours = 6,
}: {
  tab?: "resources" | "latency"
  hours?: number
}) {
  return (
    <div aria-label="正在加载历史分析" className="animate-fade-in space-y-4">
      <div className="flex flex-wrap justify-between gap-2 border-b border-border/60 pb-2">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-7 w-64" />
      </div>
      {tab === "resources" ? (
        <>
          <UptimeSlaBarSkeleton hours={hours} />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 rounded-[2px]" />
            ))}
          </div>
        </>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40 rounded-[2px]" />
          ))}
        </div>
      )}
      <div className={tab === "resources" ? "grid gap-3 lg:grid-cols-2" : "grid gap-3"}>
        {Array.from({ length: tab === "resources" ? 4 : 1 }, (_, i) => (
          <div key={i} className="rounded-[2px] border border-border/70 bg-card/60 p-3">
            <Skeleton className="mb-3 h-4 w-36" />
            <Skeleton className={tab === "resources" ? "h-48 w-full" : "h-80 w-full"} />
            <Skeleton className="mt-2 h-3 w-56" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** 首屏骨架保留规格、实时指标和历史区的层次。 */
export function NodeDetailSkeleton() {
  return (
    <div aria-label="正在加载节点详情" className="animate-fade-in space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-48 rounded-[2px]" />
        ))}
      </div>
      <div className="rounded-[2px] border border-border/70 p-3">
        <Skeleton className="mb-3 h-5 w-48" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 rounded-[2px]" />
          ))}
        </div>
      </div>
      <DetailChartSkeleton />
    </div>
  )
}
