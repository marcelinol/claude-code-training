"use client"

import { Button } from "@/components/Button"
import { CardStatus } from "@/data/types"
import { useRouter } from "next/navigation"
import { useState } from "react"

/** Offers the one move that makes sense from the row. The route decides if it is allowed. */
export function CardStatusButton({
  cardId,
  nickname,
  status,
}: {
  cardId: string
  nickname: string
  status: CardStatus
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (status === "cancelled") return null

  const next: CardStatus = status === "active" ? "frozen" : "active"
  const label = status === "active" ? "Freeze" : "Unfreeze"

  const move = async () => {
    setPending(true)
    setError(null)
    try {
      const response = await fetch(`/api/cards/${cardId}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setError(body?.message ?? "The status could not be changed.")
        return
      }
      router.refresh()
    } catch {
      setError("The status could not be changed. Check your connection.")
    } finally {
      setPending(false)
    }
  }

  return (
    <span className="flex items-center gap-2">
      <Button
        variant="secondary"
        className="py-1 text-xs"
        onClick={move}
        isLoading={pending}
        aria-label={`${label} ${nickname}`}
      >
        {label}
      </Button>
      {error && (
        <span className="text-xs text-red-600 dark:text-red-500" role="alert">
          {error}
        </span>
      )}
    </span>
  )
}
