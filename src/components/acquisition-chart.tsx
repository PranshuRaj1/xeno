"use client"

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts"

interface AcquisitionChartProps {
    data: { 
        date: string; 
        orders: number; 
        customers: number; 
    }[]
}

export function AcquisitionChart({ data }: AcquisitionChartProps) {
  return (
    <ResponsiveContainer width="100%" height={350}>
      <LineChart data={data}>
        <XAxis
          dataKey="date"
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
        />
        <Tooltip 
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="orders"
          stroke="#f97316" // Orange for orders
          strokeWidth={2}
          dot={false}
          name="Orders"
        />
        <Line
          type="monotone"
          dataKey="customers"
          stroke="#22c55e" // Green for customers
          strokeWidth={2}
          dot={false}
          name="New Customers"
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
