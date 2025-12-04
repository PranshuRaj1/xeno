"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function ComparisonSelector() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentCompare = searchParams.get("compare") || "period"

  const handleValueChange = (value: string) => {
    const newSearchParams = new URLSearchParams(searchParams.toString())
    newSearchParams.set("compare", value)
    router.push(`?${newSearchParams.toString()}`)
  }

  return (
    <Select value={currentCompare} onValueChange={handleValueChange}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Compare to" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="period">vs Previous Period</SelectItem>
        <SelectItem value="month">vs Previous Month</SelectItem>
        <SelectItem value="year">vs Previous Year</SelectItem>
      </SelectContent>
    </Select>
  )
}
