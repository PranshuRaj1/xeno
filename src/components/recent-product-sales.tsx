import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar"

interface RecentProductSalesProps {
    sales: {
        productName: string;
        quantity: number;
        price: string;
        date: string;
    }[]
}

export function RecentProductSales({ sales }: RecentProductSalesProps) {
  return (
    <div className="space-y-8">
      {sales.map((sale, i) => (
        <div key={i} className="flex items-center">
            <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                <span className="text-xs font-medium">{sale.productName.charAt(0)}</span>
            </div>
            <div className="ml-4 space-y-1">
            <p className="text-sm font-medium leading-none">{sale.productName}</p>
            <p className="text-sm text-muted-foreground">
                Qty: {sale.quantity} &bull; {sale.date}
            </p>
            </div>
            <div className="ml-auto font-medium">{sale.price}</div>
        </div>
      ))}
    </div>
  )
}
