import { Divider } from "@/components/Divider"
import { StatusBadge } from "@/components/ui/payments/StatusBadge"
import { cardById, chargesFor, eventsFor, spentFor } from "@/data/cards"
import { merchantById } from "@/data/merchants"
import { CardEventType } from "@/data/types"
import { formatInZone } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"
import { CATEGORY_LABELS } from "@/data/card-rules"
import Link from "next/link"
import { notFound } from "next/navigation"

const EVENT_LABELS: Record<CardEventType, string> = {
  issued: "Card issued",
  frozen: "Frozen",
  unfrozen: "Unfrozen",
  cancelled: "Cancelled",
}

const AMBER_FROM_PERCENT = 80

/** Static classes in steps of five so Tailwind can see every width it must emit. */
const WIDTHS = [
  "w-0", "w-[5%]", "w-[10%]", "w-[15%]", "w-[20%]", "w-[25%]", "w-[30%]",
  "w-[35%]", "w-[40%]", "w-[45%]", "w-[50%]", "w-[55%]", "w-[60%]", "w-[65%]",
  "w-[70%]", "w-[75%]", "w-[80%]", "w-[85%]", "w-[90%]", "w-[95%]", "w-full",
]

export default async function CardDetail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const card = cardById(id)
  if (!card) notFound()

  const merchant = merchantById(card.merchantId)!
  const spent = spentFor(card.id)
  const charges = chargesFor(card.id)
  const events = eventsFor(card.id)
  const remaining = card.spendLimit - spent
  const percent = Math.min(100, Math.round((spent / card.spendLimit) * 100))
  const overThreshold = percent >= AMBER_FROM_PERCENT

  return (
    <div className="p-4 sm:p-6">
      <Link
        href="/cards"
        className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-50"
      >
        ← All cards
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
          {card.nickname}
        </h1>
        <span className="font-mono text-sm text-gray-500">•••• {card.last4}</span>
        <StatusBadge status={card.status} />
      </div>
      <p className="mt-1 font-mono text-sm text-gray-500">{card.id}</p>

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        Spend against limit
      </h2>
      <div className="mt-3 flex items-baseline justify-between text-sm">
        <span className="tabular-nums text-gray-900 dark:text-gray-50">
          {formatMoney(spent, card.currency)} of{" "}
          {formatMoney(card.spendLimit, card.currency)}
        </span>
        <span
          className={cx(
            "tabular-nums",
            overThreshold
              ? "font-medium text-amber-600 dark:text-amber-500"
              : "text-gray-500",
          )}
        >
          {percent}%
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Spend against limit"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
      >
        <div
          className={cx(
            "h-full rounded-full transition-all",
            WIDTHS[Math.round(percent / 5)],
            overThreshold ? "bg-amber-500" : "bg-blue-500",
          )}
        />
      </div>
      {overThreshold && (
        <p className="mt-2 text-sm text-amber-600 dark:text-amber-500">
          Past {AMBER_FROM_PERCENT}% of the limit.
        </p>
      )}

      <Divider />

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Merchant">
          {merchant.name}
          <span className="ml-2 text-gray-500">{merchant.country}</span>
        </Field>
        <Field label="Category lock">{CATEGORY_LABELS[card.category]}</Field>
        <Field label="Number">
          <span className="font-mono">•••• {card.last4}</span>
        </Field>
        <Field label="Currency">{card.currency}</Field>
        <Field label="Spend limit">
          <span className="tabular-nums">
            {formatMoney(card.spendLimit, card.currency)}
          </span>
        </Field>
        <Field label="Remaining">
          <span className="tabular-nums">{formatMoney(remaining, card.currency)}</span>
        </Field>
        <Field label="Created (UTC)">
          <span className="font-mono text-sm">{card.createdAt}</span>
        </Field>
        <Field label={`Created (${merchant.timezone})`}>
          {formatInZone(card.createdAt, merchant.timezone)}
        </Field>
        <Field label="Number reference">
          <span className="font-mono text-xs">{card.numberRef}</span>
        </Field>
      </dl>

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        Charges
      </h2>
      {charges.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500">
          Nothing has been charged to this card yet.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-gray-200 text-sm dark:divide-gray-800">
          {charges.map((charge) => (
            <li key={charge.id} className="flex items-center justify-between py-2">
              <span>
                <span className="text-gray-900 dark:text-gray-50">
                  {charge.description}
                </span>
                <span className="ml-2 text-gray-500">
                  {formatInZone(charge.createdAt, merchant.timezone)}
                </span>
              </span>
              <span className="tabular-nums text-gray-900 dark:text-gray-50">
                {formatMoney(charge.amount, charge.currency)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        History
      </h2>
      <ol className="mt-4 space-y-4">
        {events.map((event) => (
          <li key={event.id} className="flex gap-3">
            <span
              className="mt-1.5 size-2 shrink-0 rounded-full bg-blue-500"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm text-gray-900 dark:text-gray-50">
                {EVENT_LABELS[event.type]}
              </p>
              <p className="text-sm text-gray-500">
                {formatInZone(event.at, merchant.timezone)}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900 dark:text-gray-50">{children}</dd>
    </div>
  )
}
