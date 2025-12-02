import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface TopCustomersProps {
    customers: {
        name: string;
        email: string;
        totalSpent: string;
        ordersCount: number;
    }[]
}

export function TopCustomers({ customers }: TopCustomersProps) {
  return (
    <div className="space-y-8">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[80px]">Avatar</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Orders</TableHead>
            <TableHead className="text-right">Total Spent</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.map((customer, i) => (
            <TableRow key={i}>
              <TableCell>
                <Avatar className="h-9 w-9">
                  <AvatarImage src="/avatars/01.png" alt="Avatar" />
                  <AvatarFallback>{customer.name.charAt(0)}</AvatarFallback>
                </Avatar>
              </TableCell>
              <TableCell>
                <div className="font-medium">{customer.name}</div>
                <div className="text-sm text-muted-foreground md:inline hidden">
                  {customer.email}
                </div>
              </TableCell>
              <TableCell>{customer.ordersCount}</TableCell>
              <TableCell className="text-right font-bold">
                ${Number(customer.totalSpent).toFixed(2)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
