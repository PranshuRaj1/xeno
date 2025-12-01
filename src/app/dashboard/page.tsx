import { db } from "@/db";
import { customers, orders, tenants } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Overview } from "@/components/overview";
import { RecentSales } from "@/components/recent-sales";
import { SyncButton } from "@/components/sync-button";
import { Users, CreditCard, DollarSign, Activity, Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function DashboardPage() {
  // TODO: Get tenantId from session
  const tenant = await db.query.tenants.findFirst();
  
  if (!tenant) {
    return <div className="p-8">No tenant found. Please sync data first.</div>;
  }

  const tenantId = tenant.id;

  // Fetch stats
  const [customerCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(customers)
    .where(eq(customers.tenantId, tenantId));

  const [orderCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(orders)
    .where(eq(orders.tenantId, tenantId));

  const [totalRevenue] = await db
    .select({ total: sql<number>`sum(${orders.totalPrice})` })
    .from(orders)
    .where(eq(orders.tenantId, tenantId));

  // Fetch chart data (Orders by date)
  const chartDataRaw = await db
    .select({
      date: sql<string>`to_char(${orders.createdAt}, 'Mon DD')`,
      total: sql<number>`sum(${orders.totalPrice})`,
    })
    .from(orders)
    .where(eq(orders.tenantId, tenantId))
    .groupBy(sql`to_char(${orders.createdAt}, 'Mon DD')`)
    .limit(7);
  
  const chartData = chartDataRaw.map(d => ({ name: d.date, total: Number(d.total) }));

  // Fetch recent sales
  const recentSalesRaw = await db.query.orders.findMany({
    where: eq(orders.tenantId, tenantId),
    orderBy: [desc(orders.createdAt)],
    limit: 5,
    with: {
        customer: true
    }
  });

  const recentSales = recentSalesRaw.map(order => ({
    name: order.customer ? `${order.customer.firstName} ${order.customer.lastName}` : 'Unknown',
    email: order.customer?.email || 'No email',
    amount: `${order.totalPrice}`
  }));

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <div className="flex items-center space-x-2">
          <Link href="/tenants/new">
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Store
            </Button>
          </Link>
          <SyncButton tenantId={tenantId} />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${Number(totalRevenue?.total || 0).toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+{customerCount?.count || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Orders</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+{orderCount?.count || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Now</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+573</div>
            <p className="text-xs text-muted-foreground">
              +201 since last hour
            </p>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <Overview data={chartData} />
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Recent Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <RecentSales sales={recentSales} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
