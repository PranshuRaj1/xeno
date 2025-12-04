import { Info } from "lucide-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface InfoButtonProps {
  content: React.ReactNode
  className?: string
  side?: "top" | "right" | "bottom" | "left"
}

export function InfoButton({ content, className, side = "top" }: InfoButtonProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-6 w-6 rounded-full text-muted-foreground hover:text-foreground", className)}
        >
          <Info className="h-4 w-4" />
          <span className="sr-only">Info</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent side={side} className="w-80 text-sm">
        {content}
      </PopoverContent>
    </Popover>
  )
}
