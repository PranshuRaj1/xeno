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
import { ComparisonSelector } from "@/components/comparison-selector";
import { DatePickerWithRange } from "@/components/date-range-picker";
import { TopCustomers } from "@/components/top-customers";
import { AcquisitionChart } from "@/components/acquisition-chart";
import { ModeToggle } from "@/components/mode-toggle";

interface DashboardPageProps {
  params: Promise<{
    tenantId: string;
  }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function DashboardPage({ params, searchParams }: DashboardPageProps) {
  const { tenantId: tenantIdStr } = await params;
  const { from, to, compare } = await searchParams;
  const tenantId = parseInt(tenantIdStr, 10);
  const comparisonMode = (typeof compare === 'string' ? compare : 'period') as 'period' | 'month' | 'year';

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

  // 1. Determine Date Range
  const now = new Date();
  let startDate = new Date(now);
  startDate.setDate(now.getDate() - 30); // Default to last 30 days
  let endDate = now;

  if (typeof from === 'string' && typeof to === 'string') {
      // Parse YYYY-MM-DD and adjust to IST (UTC-5.5)
      // "2025-12-02" -> UTC 00:00 -> IST 05:30. We want IST 00:00, which is UTC 18:30 prev day.
      // Offset = 5.5 hours = 5.5 * 60 * 60 * 1000 ms
      const istOffset = 5.5 * 60 * 60 * 1000;

      const fromDate = new Date(from); // UTC 00:00
      startDate = new Date(fromDate.getTime() - istOffset);

      const toDate = new Date(to); // UTC 00:00
      // Set to end of day in IST: 23:59:59.999
      // UTC 00:00 + 24h - 1ms - 5.5h
      endDate = new Date(toDate.getTime() + (24 * 60 * 60 * 1000) - 1 - istOffset);
  }

  // Calculate previous period based on comparison mode
  const duration = endDate.getTime() - startDate.getTime();
  let prevStartDate = new Date(startDate.getTime() - duration);
  let prevEndDate = new Date(endDate.getTime() - duration);

  if (comparisonMode === 'month') {
      prevStartDate = new Date(startDate);
      prevStartDate.setMonth(prevStartDate.getMonth() - 1);
      prevEndDate = new Date(endDate);
      prevEndDate.setMonth(prevEndDate.getMonth() - 1);
  } else if (comparisonMode === 'year') {
      prevStartDate = new Date(startDate);
      prevStartDate.setFullYear(prevStartDate.getFullYear() - 1);
      prevEndDate = new Date(endDate);
      prevEndDate.setFullYear(prevEndDate.getFullYear() - 1);
  }

  // Helper to fetch stats for a date range
  async function getStatsForRange(start: Date, end: Date) {
      const [customerCountRes] = await db
        .select({ count: sql<number>`count(*)` })
        .from(customers)
        .where(and(eq(customers.tenantId, tenantId), gte(customers.createdAt, start), lte(customers.createdAt, end)));
      
      const [orderCountRes] = await db
        .select({ count: sql<number>`count(*)` })
        .from(orders)
        .where(and(eq(orders.tenantId, tenantId), gte(orders.createdAt, start), lte(orders.createdAt, end)));

      const [revenueRes] = await db
        .select({ total: sql<number>`sum(${orders.totalPrice})` })
        .from(orders)
        .where(and(eq(orders.tenantId, tenantId), gte(orders.createdAt, start), lte(orders.createdAt, end)));

      return {
          customers: Number(customerCountRes?.count || 0),
          orders: Number(orderCountRes?.count || 0),
          revenue: Number(revenueRes?.total || 0),
      };
  }

  const currentStats = await getStatsForRange(startDate, endDate);
  const prevStats = await getStatsForRange(prevStartDate, prevEndDate);

  const calculateGrowth = (current: number, prev: number) => {
      if (prev === 0) return current > 0 ? 100 : 0;
      return ((current - prev) / prev) * 100;
  };

  const customerGrowth = calculateGrowth(currentStats.customers, prevStats.customers);
  const orderGrowth = calculateGrowth(currentStats.orders, prevStats.orders);
  const revenueGrowth = calculateGrowth(currentStats.revenue, prevStats.revenue);

  const formatComparisonDate = (date: Date) => {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const comparisonRange = `${formatComparisonDate(prevStartDate)} - ${formatComparisonDate(prevEndDate)}`;

  const comparisonLabel = 
    comparisonMode === 'month' ? `vs last month (${comparisonRange})` :
    comparisonMode === 'year' ? `vs last year (${comparisonRange})` :
    `vs prev period (${comparisonRange})`;

  // Total Lifetime Stats (for display values)
  const [totalCustomerRes] = await db
    .select({ count: sql<number>`count(*)` })
    .from(customers)
    .where(eq(customers.tenantId, tenantId));
  const totalCustomers = Number(totalCustomerRes?.count || 0);

  const [totalOrderRes] = await db
    .select({ count: sql<number>`count(*)` })
    .from(orders)
    .where(eq(orders.tenantId, tenantId));
  const totalOrders = Number(totalOrderRes?.count || 0);

  const [totalRevenueRes] = await db
    .select({ total: sql<number>`sum(${orders.totalPrice})` })
    .from(orders)
    .where(eq(orders.tenantId, tenantId));
  const totalRevenue = Number(totalRevenueRes?.total || 0);

  // 2. Advanced KPIs & Business Insights
  const aov = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const clv = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;
  const avgOrdersPerCustomer = totalCustomers > 0 ? totalOrders / totalCustomers : 0;

  const [returningCustomersRes] = await db
    .select({ count: sql<number>`count(*)` })
    .from(customers)
    .where(and(eq(customers.tenantId, tenantId), sql`${customers.ordersCount} > 1`));
  const returningCustomerCount = Number(returningCustomersRes?.count || 0);
  const returningRate = totalCustomers > 0 ? (returningCustomerCount / totalCustomers) * 100 : 0;

  const [refundedOrdersRes] = await db
    .select({ count: sql<number>`count(*)` })
    .from(orders)
    .where(and(
        eq(orders.tenantId, tenantId), 
        sql`lower(${orders.financialStatus}) LIKE '%refunded%'`
    ));
  const refundedCount = Number(refundedOrdersRes?.count || 0);
  const refundRate = totalOrders > 0 ? (refundedCount / totalOrders) * 100 : 0;

  // 3. Chart Data: Orders by Date
  const chartDataRaw = await db
    .select({
      date: sql<string>`to_char(${orders.createdAt}, 'Mon DD')`,
      total: sql<number>`sum(${orders.totalPrice})`,
    })
    .from(orders)
    .where(and(eq(orders.tenantId, tenantId), gte(orders.createdAt, startDate), lte(orders.createdAt, endDate)))
    .groupBy(sql`to_char(${orders.createdAt}, 'Mon DD')`)
    .orderBy(sql`min(${orders.createdAt})`);
  
  const chartData = chartDataRaw.map(d => ({ name: d.date, total: Number(d.total) }));

  // 4. Acquisition Trend: Orders vs New Customers
  const acquisitionDataRaw = await db
    .select({
        date: sql<string>`to_char(${orders.createdAt}, 'Mon DD')`,
        orders: sql<number>`count(${orders.id})`,
    })
    .from(orders)
    .where(and(eq(orders.tenantId, tenantId), gte(orders.createdAt, startDate), lte(orders.createdAt, endDate)))
    .groupBy(sql`to_char(${orders.createdAt}, 'Mon DD')`)
    .orderBy(sql`min(${orders.createdAt})`);

  const newCustomersRaw = await db
    .select({
        date: sql<string>`to_char(${customers.createdAt}, 'Mon DD')`,
        count: sql<number>`count(${customers.id})`,
    })
    .from(customers)
    .where(and(eq(customers.tenantId, tenantId), gte(customers.createdAt, startDate), lte(customers.createdAt, endDate)))
    .groupBy(sql`to_char(${customers.createdAt}, 'Mon DD')`)
    .orderBy(sql`min(${customers.createdAt})`);

  // Merge data
  const acquisitionMap = new Map<string, { date: string; orders: number; customers: number }>();

  acquisitionDataRaw.forEach(d => {
      acquisitionMap.set(d.date, { date: d.date, orders: Number(d.orders), customers: 0 });
  });

  newCustomersRaw.forEach(d => {
      if (acquisitionMap.has(d.date)) {
          acquisitionMap.get(d.date)!.customers = Number(d.count);
      } else {
          acquisitionMap.set(d.date, { date: d.date, orders: 0, customers: Number(d.count) });
      }
  });

  const acquisitionData = Array.from(acquisitionMap.values()).sort((a, b) => {
      // Simple sort by date string (Mon DD) - good enough for short ranges in same year
      return new Date(a.date + ", " + new Date().getFullYear()).getTime() - new Date(b.date + ", " + new Date().getFullYear()).getTime();
  });

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
          <ComparisonSelector />
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
            <p className="text-xs text-muted-foreground mt-1">
                {revenueGrowth >= 0 ? '+' : ''}{revenueGrowth.toFixed(1)}% {comparisonLabel}
            </p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-all duration-200 border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Customers</CardTitle>
            <Users className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+{totalCustomers}</div>
            <p className="text-xs text-muted-foreground mt-1">
                {customerGrowth >= 0 ? '+' : ''}{customerGrowth.toFixed(1)}% {comparisonLabel}
            </p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-all duration-200 border-l-4 border-l-orange-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Orders</CardTitle>
            <CreditCard className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+{totalOrders}</div>
            <p className="text-xs text-muted-foreground mt-1">
                {orderGrowth >= 0 ? '+' : ''}{orderGrowth.toFixed(1)}% {comparisonLabel}
            </p>
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
              Per Order Average
            </p>
          </CardContent>
        </Card>
      </div>

      {/* BUSINESS INSIGHTS GRID */}
      <h3 className="text-xl font-semibold tracking-tight mt-8 mb-4">Business Health & Insights</h3>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Customer Lifetime Value</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">${clv.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground mt-1">Avg revenue per customer</p>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Returning Rate</CardTitle>
                <UserPlus className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{returningRate.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground mt-1">{returningCustomerCount} returning customers</p>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Avg Orders / Customer</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{avgOrdersPerCustomer.toFixed(1)}</div>
                <p className="text-xs text-muted-foreground mt-1">Purchase frequency</p>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Refund Rate</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{refundRate.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground mt-1">{refundedCount} refunded orders</p>
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
