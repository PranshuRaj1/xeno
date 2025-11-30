import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"

interface RecentSalesProps {
    sales: {
        name: string;
        email: string;
        amount: string;
    }[]
}

export function RecentSales({ sales }: RecentSalesProps) {
  return (
    <div className="space-y-8">
      {sales.map((sale, i) => (
        <div key={i} className="flex items-center">
            <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                {/* Fallback avatar */}
                <span className="text-xs font-medium">{sale.name.charAt(0)}</span>
            </div>
            <div className="ml-4 space-y-1">
            <p className="text-sm font-medium leading-none">{sale.name}</p>
            <p className="text-sm text-muted-foreground">
                {sale.email}
            </p>
            </div>
            <div className="ml-auto font-medium">+{sale.amount}</div>
        </div>
      ))}
    </div>
  )
}
