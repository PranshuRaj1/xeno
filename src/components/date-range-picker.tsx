"use client"

import * as React from "react"
import { addDays, format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { DateRange } from "react-day-picker"
import { useRouter, useSearchParams } from "next/navigation"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export function DatePickerWithRange({
  className,
}: React.HTMLAttributes<HTMLDivElement>) {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // Initialize state from URL params or default to last 30 days
  const [date, setDate] = React.useState<DateRange | undefined>(() => {
    const fromParam = searchParams.get("from")
    const toParam = searchParams.get("to")
    
    if (fromParam && toParam) {
      return {
        from: new Date(fromParam),
        to: new Date(toParam)
      }
    }
    
    return {
      from: addDays(new Date(), -30),
      to: new Date(),
    }
  })

  // Update URL when date changes
  React.useEffect(() => {
    if (date?.from && date?.to) {
      const newSearchParams = new URLSearchParams(searchParams.toString())
      newSearchParams.set("from", date.from.toISOString())
      newSearchParams.set("to", date.to.toISOString())
      
      if (newSearchParams.toString() !== searchParams.toString()) {
        router.push(`?${newSearchParams.toString()}`)
      }
    }
  }, [date, router, searchParams])

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-[300px] justify-start text-left font-normal",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "LLL dd, y")} -{" "}
                  {format(date.to, "LLL dd, y")}
                </>
              ) : (
                format(date.from, "LLL dd, y")
              )
            ) : (
              <span>Pick a date</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={setDate}
            numberOfMonths={2}
            className="rounded-lg border shadow-sm"
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
