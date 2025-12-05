"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

interface AutoSyncProps {
  tenantId: number
  lastSyncedAt: Date | null
}

export function AutoSync({ tenantId, lastSyncedAt }: AutoSyncProps) {
  const [isSyncing, setIsSyncing] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // If never synced, trigger sync automatically
    if (!lastSyncedAt) {
      const syncData = async () => {
        setIsSyncing(true)
        try {
          const res = await fetch('/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tenantId }),
          })
          
          if (!res.ok) throw new Error('Auto-sync failed')
          
          router.refresh()
        } catch (error) {
          console.error("Auto-sync error:", error)
        } finally {
          setIsSyncing(false)
        }
      }

      syncData()
    }
  }, [tenantId, lastSyncedAt, router])

  if (!isSyncing) return null

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-lg font-medium text-muted-foreground">
          Setting up your dashboard for the first time...
        </p>
      </div>
    </div>
  )
}
