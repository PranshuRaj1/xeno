import { db } from "@/db";
import { customers, orders, tenants } from "@/db/schema";
import { eq, desc, sql, and, gte, lte } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Overview } from "@/components/overview";
import { RecentSales } from "@/components/recent-sales";
import { SyncButton } from "@/components/sync-button";
import { TenantSwitcher } from "@/components/tenant-switcher";
import { Users, CreditCard, DollarSign, Activity, Plus, TrendingUp, UserPlus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";
import { DatePickerWithRange } from "@/components/date-range-picker";
import { TopCustomers } from "@/components/top-customers";
import { AcquisitionChart } from "@/components/acquisition-chart";
import { ModeToggle } from "@/components/mode-toggle";

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

  // 1. Basic Stats
  const [customerCountRes] = await db
    .select({ count: sql<number>`count(*)` })
    .from(customers)
    .where(eq(customers.tenantId, tenantId));
  const customerCount = Number(customerCountRes?.count || 0);

  const [orderCountRes] = await db
    .select({ count: sql<number>`count(*)` })
    .from(orders)
    .where(eq(orders.tenantId, tenantId));
  const orderCount = Number(orderCountRes?.count || 0);

  const [totalRevenueRes] = await db
    .select({ total: sql<number>`sum(${orders.totalPrice})` })
    .from(orders)
    .where(eq(orders.tenantId, tenantId));
  const totalRevenue = Number(totalRevenueRes?.total || 0);

  // 2. Advanced KPIs
  const aov = orderCount > 0 ? totalRevenue / orderCount : 0;

  const [returningCustomersRes] = await db
    .select({ count: sql<number>`count(*)` })
    .from(customers)
    .where(and(eq(customers.tenantId, tenantId), sql`${customers.ordersCount} > 1`));
  const returningCustomerCount = Number(returningCustomersRes?.count || 0);
  const returningRate = customerCount > 0 ? (returningCustomerCount / customerCount) * 100 : 0;

  // 3. Chart Data: Orders by Date
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

  // 4. Acquisition Trend: Orders vs New Customers
  const acquisitionDataRaw = await db
    .select({
        date: sql<string>`to_char(${orders.createdAt}, 'Mon DD')`,
        orders: sql<number>`count(${orders.id})`,
    })
    .from(orders)
    .where(eq(orders.tenantId, tenantId))
    .groupBy(sql`to_char(${orders.createdAt}, 'Mon DD')`)
    .limit(7);

  // Note: This is a simplified join for demo. Ideally we'd join dates properly.
  // For now, we'll just map orders. In a real app, we'd fetch customers grouped by date too and merge.
  const acquisitionData = acquisitionDataRaw.map(d => ({
      date: d.date,
      orders: Number(d.orders),
      customers: Math.floor(Math.random() * 5) // Mocking new customers for demo as we don't have enough data
  }));

  // 5. Top Customers
  const topCustomersRaw = await db.query.customers.findMany({
      where: eq(customers.tenantId, tenantId),
      orderBy: [desc(customers.totalSpent)],
      limit: 5,
  });

  const topCustomers = topCustomersRaw.map(c => ({
      name: c.firstName === 'Redacted' ? 'Redacted User' : `${c.firstName} ${c.lastName}`,
      email: c.email || '',
      totalSpent: c.totalSpent || '0',
      ordersCount: c.ordersCount || 0
  }));

  // 6. Recent Sales
  const recentSalesRaw = await db.query.orders.findMany({
    where: eq(orders.tenantId, tenantId),
    orderBy: [desc(orders.createdAt)],
    limit: 5,
    with: {
        customer: true
    }
  });

  const recentSales = recentSalesRaw.map(order => ({
    name: order.customer ? (order.customer.firstName === 'Redacted' ? 'Redacted User' : `${order.customer.firstName} ${order.customer.lastName}`) : 'Unknown',
    email: order.customer?.email || 'No email',
    amount: `${order.totalPrice}`
  }));

  return (
    <div className="flex-1 space-y-8 p-8 pt-6 bg-muted/20 min-h-screen">
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between relative z-10">
        <div className="flex items-center space-x-4">
            <TenantSwitcher tenants={allTenants} currentTenantId={tenantId} />
            <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        </div>
        <div className="flex items-center space-x-2">
          <DatePickerWithRange />
          <Link href="/tenants/new">
            <Button size="sm" className="cursor-pointer shadow-sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Store
            </Button>
          </Link>
          <SyncButton tenantId={tenantId} />
          <ModeToggle />
        </div>
      </div>

      {/* KPI GRID */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-lg transition-all duration-200 border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalRevenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">+20.1% from last month</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-all duration-200 border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Customers</CardTitle>
            <Users className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+{customerCount}</div>
            <p className="text-xs text-muted-foreground mt-1">+180.1% from last month</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-all duration-200 border-l-4 border-l-orange-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Orders</CardTitle>
            <CreditCard className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+{orderCount}</div>
            <p className="text-xs text-muted-foreground mt-1">+19% from last month</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-all duration-200 border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg. Order Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${aov.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Returning Rate: {returningRate.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* CHARTS ROW */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Revenue Overview</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <Overview data={chartData} />
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Acquisition Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <AcquisitionChart data={acquisitionData} />
          </CardContent>
        </Card>
      </div>

      {/* BOTTOM ROW: TOP CUSTOMERS & RECENT SALES */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
            <CardHeader>
                <CardTitle>Top Customers by Spend</CardTitle>
            </CardHeader>
            <CardContent>
                <TopCustomers customers={topCustomers} />
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
