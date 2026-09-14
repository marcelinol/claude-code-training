"use client"

import { Button } from "@/components/Button"
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/Drawer"
import { CardStatus } from "@/data/types"
import { useRouter } from "next/navigation"
import { useState } from "react"

/**
 * Offers the moves that make sense from the row. The route decides whether
 * each one is allowed; a cancelled card offers nothing.
 */
export function CardActions({
  cardId,
  nickname,
  last4,
  status,
}: {
  cardId: string
  nickname: string
  last4: string
  status: CardStatus
}) {
  const router = useRouter()
  const [pending, setPending] = useState<CardStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  if (status === "cancelled") return null

  const toggle: CardStatus = status === "active" ? "frozen" : "active"
  const toggleLabel = status === "active" ? "Freeze" : "Unfreeze"

  const move = async (next: CardStatus) => {
    setPending(next)
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
      setConfirmOpen(false)
      router.refresh()
    } catch {
      setError("The status could not be changed. Check your connection.")
    } finally {
      setPending(null)
    }
  }

  return (
    <span className="flex items-center justify-end gap-2">
      {error && (
        <span className="text-xs text-red-600 dark:text-red-500" role="alert">
          {error}
        </span>
      )}
      <Button
        variant="secondary"
        className="py-1 text-xs"
        onClick={() => move(toggle)}
        isLoading={pending === toggle}
        disabled={pending !== null}
        aria-label={`${toggleLabel} ${nickname}`}
      >
        {toggleLabel}
      </Button>

      <Drawer open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DrawerTrigger asChild>
          <Button
            variant="destructive"
            className="py-1 text-xs"
            disabled={pending !== null}
            aria-label={`Cancel ${nickname}`}
          >
            Cancel
          </Button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Cancel {nickname}?</DrawerTitle>
            <DrawerDescription className="text-sm">
              •••• {last4} stops working immediately. A cancelled card cannot be
              reactivated; you would issue a new one instead.
            </DrawerDescription>
          </DrawerHeader>
          <DrawerBody>
            <p className="text-sm text-gray-500">
              Its charges and history stay visible on the card page.
            </p>
          </DrawerBody>
          <DrawerFooter className="items-center">
            <p
              className="text-sm text-red-600 dark:text-red-500 sm:mr-auto"
              aria-live="polite"
            >
              {error}
            </p>
            <DrawerClose asChild>
              <Button variant="secondary" className="w-full sm:w-fit">
                Keep card
              </Button>
            </DrawerClose>
            <Button
              variant="destructive"
              className="w-full sm:w-fit"
              onClick={() => move("cancelled")}
              isLoading={pending === "cancelled"}
            >
              Cancel card
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </span>
  )
}
