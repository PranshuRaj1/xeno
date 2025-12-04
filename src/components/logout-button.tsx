"use client"

import { signOut } from "next-auth/react"
import { LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"

export function LogoutButton() {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => signOut({ callbackUrl: "/login" })}
      title="Log out"
    >
      <LogOut className="h-[1.2rem] w-[1.2rem]" />
      <span className="sr-only">Log out</span>
    </Button>
  )
}
