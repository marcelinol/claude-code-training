import { Divider } from "@/components/Divider"
import { StatusBadge } from "@/components/ui/payments/StatusBadge"
import { cardById } from "@/data/cards"
import { merchantById } from "@/data/merchants"
import { formatInZone } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import Link from "next/link"
import { notFound } from "next/navigation"

export default async function CardDetail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const card = cardById(id)
  if (!card) notFound()

  const merchant = merchantById(card.merchantId)!
  const remaining = card.spendLimit - card.spent
  const percent = Math.round((card.spent / card.spendLimit) * 100)

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

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Merchant">
          {merchant.name}
          <span className="ml-2 text-gray-500">{merchant.country}</span>
        </Field>
        <Field label="Number">
          <span className="font-mono">•••• {card.last4}</span>
        </Field>
        <Field label="Currency">{card.currency}</Field>
        <Field label="Spend limit">
          <span className="tabular-nums">
            {formatMoney(card.spendLimit, card.currency)}
          </span>
        </Field>
        <Field label="Spent">
          <span className="tabular-nums">
            {formatMoney(card.spent, card.currency)}
          </span>
          <span className="ml-2 text-gray-500">{percent}% of limit</span>
        </Field>
        <Field label="Remaining">
          <span className="tabular-nums">
            {formatMoney(remaining, card.currency)}
          </span>
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
