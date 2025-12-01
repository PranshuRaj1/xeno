import { db } from "@/db";
import { redirect } from "next/navigation";

export default async function DashboardRootPage() {
  const tenant = await db.query.tenants.findFirst();

  if (tenant) {
    redirect(`/dashboard/${tenant.id}`);
  } else {
    // If no tenants, maybe redirect to create one?
    redirect('/tenants/new');
  }
}
