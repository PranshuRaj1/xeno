"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Store } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useRouter } from "next/navigation"

type Tenant = {
  id: number
  storeName: string
}

interface TenantSwitcherProps {
  tenants: Tenant[]
  currentTenantId: number
}

export function TenantSwitcher({ tenants, currentTenantId }: TenantSwitcherProps) {
  const router = useRouter()
  const currentTenant = tenants.find((t) => t.id === currentTenantId)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-label="Select a store"
          className="w-[200px] justify-between cursor-pointer"
        >
          <Store className="mr-2 h-4 w-4" />
          {currentTenant?.storeName || "Select a store"}
          <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[200px]">
        <DropdownMenuLabel>Stores</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {tenants.map((tenant) => (
          <DropdownMenuItem
            key={tenant.id}
            onSelect={() => {
              router.push(`/dashboard/${tenant.id}`)
            }}
            className="text-sm cursor-pointer"
          >
            <Store className="mr-2 h-4 w-4" />
            {tenant.storeName}
            <Check
              className={cn(
                "ml-auto h-4 w-4",
                currentTenantId === tenant.id
                  ? "opacity-100"
                  : "opacity-0"
              )}
            />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
