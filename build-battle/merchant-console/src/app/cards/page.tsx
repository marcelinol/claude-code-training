import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRoot,
  TableRow,
} from "@/components/Table"
import { StatusBadge } from "@/components/ui/payments/StatusBadge"
import { listCards } from "@/data/cards"
import { merchantById, merchants } from "@/data/merchants"
import { formatDate } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import { CATEGORY_LABELS } from "@/data/card-rules"
import Link from "next/link"
import { CardActions } from "./card-actions"
import { IssueCardDialog } from "./issue-card-dialog"

// Reads the in-memory store on every request; a build-time snapshot would never show new cards.
export const dynamic = "force-dynamic"

export default function CardsPage() {
  const cards = listCards()

  return (
    <section aria-label="Cards">
      <div className="flex flex-col justify-between gap-2 px-4 py-6 sm:flex-row sm:items-center sm:p-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
            Virtual cards
          </h1>
          <p className="text-sm text-gray-500">
            {cards.length.toLocaleString()} {cards.length === 1 ? "card" : "cards"}{" "}
            issued
          </p>
        </div>
        <IssueCardDialog
          merchants={merchants.map((m) => ({
            id: m.id,
            name: m.name,
            currency: m.currency,
          }))}
        />
      </div>

      <TableRoot className="border-t border-gray-200 dark:border-gray-800">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Card</TableHeaderCell>
              <TableHeaderCell>Merchant</TableHeaderCell>
              <TableHeaderCell>Category</TableHeaderCell>
              <TableHeaderCell>Number</TableHeaderCell>
              <TableHeaderCell className="text-right">Limit</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Created</TableHeaderCell>
              <TableHeaderCell>
                <span className="sr-only">Actions</span>
              </TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {cards.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-16 text-center">
                  <p className="font-medium text-gray-900 dark:text-gray-50">
                    No cards issued yet
                  </p>
                  <p className="mt-1 text-gray-500">
                    Use Issue card to create the first one. It will show up here
                    with its last four digits.
                  </p>
                </TableCell>
              </TableRow>
            )}
            {cards.map((card) => (
              <TableRow key={card.id}>
                <TableCell>
                  <Link
                    href={`/cards/${card.id}`}
                    className="font-medium text-blue-600 hover:underline dark:text-blue-500"
                  >
                    {card.nickname}
                  </Link>
                </TableCell>
                <TableCell>{merchantById(card.merchantId)?.name}</TableCell>
                <TableCell className="text-gray-500">
                  {CATEGORY_LABELS[card.category]}
                </TableCell>
                <TableCell className="font-mono text-gray-500">
                  •••• {card.last4}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums text-gray-900 dark:text-gray-50">
                  {formatMoney(card.spendLimit, card.currency)}
                </TableCell>
                <TableCell>
                  <StatusBadge status={card.status} />
                </TableCell>
                <TableCell>{formatDate(card.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <CardActions
                    cardId={card.id}
                    nickname={card.nickname}
                    last4={card.last4}
                    status={card.status}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableRoot>
    </section>
  )
}
