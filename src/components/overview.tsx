"use client"

import { useState } from "react"
import { useTheme } from "next-themes"
import { Bar, BarChart, Line, LineChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts"
import { Button } from "@/components/ui/button"
import { BarChart3, LineChart as LineChartIcon } from "lucide-react"

interface OverviewProps {
    data: { name: string; total: number }[]
}

export function Overview({ data }: OverviewProps) {
  const { resolvedTheme } = useTheme()
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar')

  return (
    <div className="space-y-4">
      <div className="flex justify-end space-x-2">
        <Button 
            variant={chartType === 'bar' ? 'default' : 'outline'} 
            size="icon"
            onClick={() => setChartType('bar')}
            title="Bar Chart"
        >
            <BarChart3 className="h-4 w-4" />
        </Button>
        <Button 
            variant={chartType === 'line' ? 'default' : 'outline'} 
            size="icon"
            onClick={() => setChartType('line')}
            title="Line Chart"
        >
            <LineChartIcon className="h-4 w-4" />
        </Button>
      </div>
      <ResponsiveContainer width="100%" height={350}>
        {chartType === 'bar' ? (
          <BarChart data={data}>
            <XAxis
              dataKey="name"
              stroke="#888888"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#888888"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `$${value}`}
            />
            <Tooltip 
                cursor={{ fill: 'transparent' }}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', color: 'black', backgroundColor: 'white' }}
            />
            <Bar
              dataKey="total"
              fill="currentColor"
              radius={[4, 4, 0, 0]}
              className={resolvedTheme === 'dark' ? "fill-green-500" : "fill-primary"}
            />
          </BarChart>
        ) : (
          <LineChart data={data}>
            <XAxis
              dataKey="name"
              stroke="#888888"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#888888"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `$${value}`}
            />
            <Tooltip 
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', color: 'black', backgroundColor: 'white' }}
            />
            <Line
              type="monotone"
              dataKey="total"
              stroke="currentColor"
              strokeWidth={2}
              dot={{ r: 4, fill: "currentColor" }}
              className={resolvedTheme === 'dark' ? "stroke-green-500 fill-green-500" : "stroke-primary fill-primary"}
            />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}
