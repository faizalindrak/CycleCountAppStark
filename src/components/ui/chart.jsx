import * as React from "react"
import * as RechartsPrimitive from "recharts"
import { cn } from "@/lib/utils"

// ChartContainer component
const ChartContainer = React.forwardRef(
  ({ id, className, children, config, ...props }, ref) => {
    const uniqueId = React.useId()
    const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`

    return (
      <ChartContext.Provider value={{ config }}>
        <div
          data-chart={chartId}
          ref={ref}
          className={cn(
            "flex aspect-video justify-center text-xs",
            className
          )}
          {...props}
        >
          <RechartsPrimitive.ResponsiveContainer>
            {children}
          </RechartsPrimitive.ResponsiveContainer>
        </div>
      </ChartContext.Provider>
    )
  }
)
ChartContainer.displayName = "ChartContainer"

// ChartContext for passing config
const ChartContext = React.createContext(null)

function useChart() {
  const context = React.useContext(ChartContext)

  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />")
  }

  return context
}

// ChartTooltip component
const ChartTooltip = RechartsPrimitive.Tooltip

const ChartTooltipContent = React.forwardRef(
  ({ active, payload, className, hideLabel = false, labelFormatter }, ref) => {
    const { config } = useChart()

    if (!active || !payload?.length) {
      return null
    }

    return (
      <div
        ref={ref}
        className={cn(
          "grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl",
          className
        )}
      >
        {!hideLabel && payload[0]?.payload && (
          <div className="font-medium">
            {labelFormatter
              ? labelFormatter(payload[0].payload.date || payload[0].name)
              : payload[0].payload.date || payload[0].name}
          </div>
        )}
        <div className="grid gap-1.5">
          {payload.map((item, index) => {
            const key = `item-${index}`
            const itemConfig = config?.[item.dataKey] || {}
            const label = itemConfig.label || item.dataKey

            return (
              <div
                key={key}
                className="flex w-full items-center justify-between gap-2"
              >
                <div className="flex items-center gap-1.5">
                  <div
                    className="h-2.5 w-2.5 rounded-[2px]"
                    style={{
                      backgroundColor: item.color || item.fill
                    }}
                  />
                  <span className="text-muted-foreground">{label}</span>
                </div>
                <span className="font-mono font-medium tabular-nums text-foreground">
                  {item.value}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }
)
ChartTooltipContent.displayName = "ChartTooltipContent"

// ChartLegend component
const ChartLegend = RechartsPrimitive.Legend

const ChartLegendContent = React.forwardRef(
  ({ className, payload }, ref) => {
    const { config } = useChart()

    if (!payload?.length) {
      return null
    }

    return (
      <div
        ref={ref}
        className={cn("flex items-center justify-center gap-4", className)}
      >
        {payload.map((item) => {
          const key = item.dataKey
          const itemConfig = config?.[key] || {}

          return (
            <div
              key={item.value}
              className="flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-muted-foreground"
            >
              <div
                className="h-2.5 w-2.5 rounded-[2px]"
                style={{
                  backgroundColor: item.color
                }}
              />
              <span className="text-sm text-muted-foreground">
                {itemConfig.label || item.value}
              </span>
            </div>
          )
        })}
      </div>
    )
  }
)
ChartLegendContent.displayName = "ChartLegendContent"

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
}
