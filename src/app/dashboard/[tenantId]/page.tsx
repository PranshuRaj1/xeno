import { db } from "@/db";
import { customers, orders, tenants } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Overview } from "@/components/overview";
import { RecentSales } from "@/components/recent-sales";
import { SyncButton } from "@/components/sync-button";
import { TenantSwitcher } from "@/components/tenant-switcher";
import { Users, CreditCard, DollarSign, Activity, Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";

interface DashboardPageProps {
  params: Promise<{
    tenantId: string;
  }>;
}

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { tenantId: tenantIdStr } = await params;
  const tenantId = parseInt(tenantIdStr, 10);

  if (isNaN(tenantId)) {
      return <div>Invalid Tenant ID</div>;
  }

  // Fetch current tenant
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId)
  });
  
  if (!tenant) {
    return <div className="p-8">Tenant not found.</div>;
  }

  // Fetch all tenants for switcher
  const allTenants = await db.query.tenants.findMany();

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
    <div className="flex-1 space-y-8 p-8 pt-6 bg-muted/20 min-h-screen">
      <div className="flex items-center justify-between space-y-2 relative z-10">
        <div className="flex items-center space-x-4 w-1/3">
            <TenantSwitcher tenants={allTenants} currentTenantId={tenantId} />
        </div>
        <div className="flex flex-col items-center justify-center w-1/3 text-center">
            <h2 className="text-4xl font-extrabold tracking-tight">
            Dashboard
            </h2>
            <p className="text-muted-foreground mt-1">
            Overview for <span className="font-semibold text-foreground">{tenant.storeName}</span>
            </p>
        </div>
        <div className="flex items-center justify-end space-x-2 w-1/3">
          <Link href="/tenants/new">
            <Button size="sm" className="cursor-pointer shadow-sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Store
            </Button>
          </Link>
          <SyncButton tenantId={tenantId} />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-lg transition-all duration-200 border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${Number(totalRevenue?.total || 0).toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">+20.1% from last month</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-all duration-200 border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Customers</CardTitle>
            <Users className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+{customerCount?.count || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">+180.1% from last month</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-all duration-200 border-l-4 border-l-orange-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Orders</CardTitle>
            <CreditCard className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+{orderCount?.count || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">+19% from last month</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-all duration-200 border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Now</CardTitle>
            <Activity className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+573</div>
            <p className="text-xs text-muted-foreground mt-1">
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
