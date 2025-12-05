"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"
import { useRouter } from "next/navigation"

export function SyncButton({ tenantId }: { tenantId: number }) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSync = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      })

      console.log("------------------------------------");
      
      console.log(tenantId);

      console.log("************************************");
      console.log(res);
      
      
      
      
      if (!res.ok) throw new Error('Sync failed', { cause: res })
      
      // Refresh the page to show new data
      router.refresh()
    } catch (error) {
      console.error(error)
      alert('Failed to sync data')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button 
      onClick={handleSync} 
      disabled={isLoading}
      variant="outline"
      size="sm"
    >
      <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
      {isLoading ? 'Syncing...' : 'Sync Now'}
    </Button>
  )
}
