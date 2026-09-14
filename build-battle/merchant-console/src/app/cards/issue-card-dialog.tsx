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
import { Input } from "@/components/Input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/Select"
import {
  CARD_CATEGORIES,
  CARD_CURRENCIES,
  CATEGORY_LABELS,
  MAX_SPEND_LIMIT,
} from "@/data/card-rules"
import { Card, CardCategory, Currency } from "@/data/types"
import { formatMoney } from "@/lib/money"
import { Check, Copy, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

const labelClass = "text-sm font-medium text-gray-900 dark:text-gray-50"

type Issued = { card: Card; number: string | null; replayed: boolean }

/** Posts the form as typed. The route validates and converts everything. */
export function IssueCardDialog({
  merchants,
}: {
  merchants: { id: string; name: string; currency: Currency }[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [nickname, setNickname] = useState("")
  const [merchantId, setMerchantId] = useState("")
  const [currency, setCurrency] = useState<Currency>("USD")
  const [spendLimit, setSpendLimit] = useState("")
  const [category, setCategory] = useState<CardCategory | "">("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [issued, setIssued] = useState<Issued | null>(null)
  const [copied, setCopied] = useState(false)
  // One key per attempt, so a double-click or retry cannot mint a second card.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())

  const reset = () => {
    setNickname("")
    setMerchantId("")
    setCurrency("USD")
    setSpendLimit("")
    setCategory("")
    setError(null)
    setSubmitting(false)
    setIssued(null)
    setCopied(false)
    setIdempotencyKey(crypto.randomUUID())
  }

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) return
    const shouldRefresh = issued !== null
    // The full number must not outlive the success screen.
    reset()
    if (shouldRefresh) router.refresh()
  }

  const chooseMerchant = (id: string) => {
    setMerchantId(id)
    const merchant = merchants.find((m) => m.id === id)
    if (merchant) setCurrency(merchant.currency)
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nickname,
          merchantId,
          spendLimit,
          currency,
          category,
          idempotencyKey,
        }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        setError(body?.message ?? "The card could not be issued. Try again.")
        return
      }
      if (!body?.card) {
        // The card exists server-side; the same key on retry returns it rather than a second card.
        setError("The card was issued but the response could not be read. Submit again to see it.")
        return
      }
      setIssued(body as Issued)
    } catch {
      setError("The card could not be issued. Check your connection and try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const copyNumber = async () => {
    if (!issued?.number) return
    try {
      await navigator.clipboard.writeText(issued.number)
      setCopied(true)
    } catch {
      setError("Copy is not available here. Select the number and copy it by hand.")
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerTrigger asChild>
        <Button variant="primary" className="w-full gap-2 py-1.5 sm:w-fit">
          <Plus className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
          Issue card
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        {issued ? (
          <>
            <DrawerHeader>
              <DrawerTitle>Card issued</DrawerTitle>
              <DrawerDescription className="text-sm">
                {issued.card.nickname} is active.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody className="flex flex-col gap-4">
              {issued.number ? (
                <>
                  <p className="text-sm text-gray-500">
                    This is the only time the full number is shown. After you
                    close this panel it appears as •••• {issued.card.last4}{" "}
                    everywhere.
                  </p>
                  <div className="flex items-center justify-between gap-3 rounded-md border border-gray-200 px-3 py-3 dark:border-gray-800">
                    <span className="font-mono text-lg tabular-nums tracking-wider text-gray-900 dark:text-gray-50">
                      {issued.number.replace(/(\d{4})(?=\d)/g, "$1 ")}
                    </span>
                    <Button
                      variant="secondary"
                      className="gap-2 py-1.5"
                      onClick={copyNumber}
                    >
                      {copied ? (
                        <Check className="size-4" aria-hidden="true" />
                      ) : (
                        <Copy className="size-4" aria-hidden="true" />
                      )}
                      {copied ? "Copied" : "Copy"}
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-500">
                  This request had already been issued as •••• {issued.card.last4}.
                  The full number was shown once, on the first attempt, and
                  cannot be shown again.
                </p>
              )}
            </DrawerBody>
            <DrawerFooter className="items-center">
              <p
                className="text-sm text-red-600 dark:text-red-500 sm:mr-auto"
                aria-live="polite"
              >
                {error}
              </p>
              <DrawerClose asChild>
                <Button variant="primary" className="w-full sm:w-fit">
                  Done
                </Button>
              </DrawerClose>
            </DrawerFooter>
          </>
        ) : (
          <form onSubmit={submit} className="flex flex-1 flex-col">
            <DrawerHeader>
              <DrawerTitle>Issue a virtual card</DrawerTitle>
              <DrawerDescription className="text-sm">
                Single merchant, virtual, with a limit from the start.
              </DrawerDescription>
            </DrawerHeader>

            <DrawerBody className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label htmlFor="card-nickname" className={labelClass}>
                  Nickname
                </label>
                <Input
                  id="card-nickname"
                  name="nickname"
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  placeholder="Ad spend"
                  maxLength={40}
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="card-merchant" className={labelClass}>
                  Merchant
                </label>
                <Select value={merchantId} onValueChange={chooseMerchant}>
                  <SelectTrigger id="card-merchant">
                    <SelectValue placeholder="Choose a merchant" />
                  </SelectTrigger>
                  <SelectContent>
                    {merchants.map((merchant) => (
                      <SelectItem key={merchant.id} value={merchant.id}>
                        {merchant.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="card-category" className={labelClass}>
                  Category lock
                </label>
                <Select
                  value={category}
                  onValueChange={(value) => setCategory(value as CardCategory)}
                >
                  <SelectTrigger id="card-category">
                    <SelectValue placeholder="What the card may be used for" />
                  </SelectTrigger>
                  <SelectContent>
                    {CARD_CATEGORIES.map((code) => (
                      <SelectItem key={code} value={code}>
                        {CATEGORY_LABELS[code]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-[1fr_7rem] gap-3">
                <div className="flex flex-col gap-2">
                  <label htmlFor="card-limit" className={labelClass}>
                    Spend limit
                  </label>
                  <Input
                    id="card-limit"
                    name="spendLimit"
                    inputMode="decimal"
                    value={spendLimit}
                    onChange={(event) => setSpendLimit(event.target.value)}
                    placeholder="250.00"
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="card-currency" className={labelClass}>
                    Currency
                  </label>
                  <Select
                    value={currency}
                    onValueChange={(value) => setCurrency(value as Currency)}
                  >
                    <SelectTrigger id="card-currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CARD_CURRENCIES.map((code) => (
                        <SelectItem key={code} value={code}>
                          {code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Up to {formatMoney(MAX_SPEND_LIMIT, currency)}, in the
                merchant&apos;s settlement currency. The limit applies from the
                moment the card exists.
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
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full sm:w-fit"
                >
                  Cancel
                </Button>
              </DrawerClose>
              <Button
                type="submit"
                variant="primary"
                className="w-full sm:w-fit"
                isLoading={submitting}
                disabled={submitting}
              >
                Issue card
              </Button>
            </DrawerFooter>
          </form>
        )}
      </DrawerContent>
    </Drawer>
  )
}
