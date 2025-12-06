import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ShoppingCart, AlertCircle } from "lucide-react"

interface CheckoutEventsProps {
    checkouts: {
        id: string;
        email: string;
        status: string; // 'Active' or 'Abandoned'
        totalPrice: string;
        date: string;
    }[]
}

export function CheckoutEvents({ checkouts }: CheckoutEventsProps) {
  return (
    <Card className="col-span-3">
      <CardHeader>
        <CardTitle>Checkout Activity</CardTitle>
        <CardDescription>
          Real-time checkout events and abandoned carts.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-8">
          {checkouts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent checkout activity.</p>
          ) : (
              checkouts.map((checkout, i) => (
                <div key={i} className="flex items-center">
                    <div className={`h-9 w-9 rounded-full flex items-center justify-center ${checkout.status === 'Abandoned' ? 'bg-red-100' : 'bg-blue-100'}`}>
                        {checkout.status === 'Abandoned' ? (
                            <AlertCircle className="h-4 w-4 text-red-500" />
                        ) : (
                            <ShoppingCart className="h-4 w-4 text-blue-500" />
                        )}
                    </div>
                    <div className="ml-4 space-y-1">
                        <p className="text-sm font-medium leading-none">
                            {checkout.email || 'Unknown Customer'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                            {checkout.status} &bull; {checkout.date}
                        </p>
                    </div>
                    <div className="ml-auto font-medium">
                        {checkout.totalPrice ? `$${checkout.totalPrice}` : '-'}
                    </div>
                </div>
              ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
