"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function NewTenantPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)

    const formData = new FormData(event.currentTarget)
    const data = {
      storeName: formData.get("storeName"),
      storeDomain: formData.get("storeDomain"),
      accessToken: formData.get("accessToken"),
      clientSecret: formData.get("clientSecret"),
    }

    try {
      const response = await fetch("/api/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error("Failed to create tenant")
      }

      router.push("/dashboard")
      router.refresh()
    } catch (error) {
      console.error(error)
      alert("Something went wrong.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center h-screen bg-muted/50">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle>Add New Store</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="storeName">Store Name</Label>
              <Input id="storeName" name="storeName" placeholder="My Awesome Store" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="storeDomain">Store Domain</Label>
              <Input id="storeDomain" name="storeDomain" placeholder="my-store.myshopify.com" required />
            </div>
            <div className="space-y-2">
              <Input id="accessToken" name="accessToken" placeholder="shpat_..." required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientSecret">Client Secret (Optional)</Label>
              <Input id="clientSecret" name="clientSecret" placeholder="shpss_..." />
              <p className="text-[0.8rem] text-muted-foreground">Required for webhook verification.</p>
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Adding..." : "Add Store"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
