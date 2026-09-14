import { buildCardNumber } from "@/lib/card-number"
import { merchants } from "./merchants"
import {
  Card,
  CardCategory,
  CardCharge,
  CardEvent,
  CardStatus,
  Currency,
  Dispute,
  Payment,
  PaymentStatus,
  Payout,
  Refund,
} from "./types"

/**
 * Deterministic seed data. Everyone in the room gets identical records,
 * so a bug reproduces the same way on every machine.
 */

const SEED = 20260813
const DAYS = 120
const PAYMENTS_PER_DAY = 14

/** Small, fast, deterministic PRNG. Not for anything that matters. */
function mulberry32(a: number) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = mulberry32(SEED)
const pick = <T>(items: readonly T[]): T =>
  items[Math.floor(rand() * items.length)]
const between = (min: number, max: number) =>
  Math.floor(rand() * (max - min + 1)) + min

const DESCRIPTIONS = [
  "Online order",
  "In-store purchase",
  "Subscription renewal",
  "Gift card",
  "Wholesale invoice",
  "Repeat order",
  "Marketplace order",
]

const REASON_CODES = [
  "10.4 Other Fraud",
  "12.6 Duplicate Processing",
  "13.1 Merchandise Not Received",
  "13.3 Not as Described",
  "13.7 Cancelled Merchandise",
]

const pad = (n: number, width = 6) => String(n).padStart(width, "0")

/** The anchor date. Fixed, so "the last 30 days" is stable across runs. */
export const GENERATED_AT = new Date("2026-08-13T00:00:00.000Z")

function statusFor(): PaymentStatus {
  const roll = rand()
  if (roll < 0.78) return "captured"
  if (roll < 0.86) return "authorized"
  if (roll < 0.93) return "refunded"
  if (roll < 0.98) return "failed"
  return "disputed"
}

export function generate() {
  const payments: Payment[] = []
  const refunds: Refund[] = []
  const disputes: Dispute[] = []
  let paymentSeq = 0
  let refundSeq = 0
  let disputeSeq = 0

  for (let day = DAYS - 1; day >= 0; day--) {
    const dayStart = new Date(GENERATED_AT)
    dayStart.setUTCDate(dayStart.getUTCDate() - day)

    const count = between(PAYMENTS_PER_DAY - 5, PAYMENTS_PER_DAY + 5)

    for (let i = 0; i < count; i++) {
      const merchant = pick(merchants)
      const createdAt = new Date(dayStart)
      createdAt.setUTCHours(between(0, 23), between(0, 59), between(0, 59), 0)

      const status = statusFor()
      const method = rand() < 0.82 ? "card" : rand() < 0.6 ? "wallet" : "bank_transfer"
      const amount = between(450, 480_00)

      const payment: Payment = {
        id: `pay_${pad(++paymentSeq)}`,
        merchantId: merchant.id,
        amount,
        currency: merchant.currency as Currency,
        status,
        method,
        cardBrand:
          method === "card" ? pick(["visa", "mastercard", "amex"] as const) : null,
        last4: method === "card" ? String(between(1000, 9999)) : null,
        createdAt: createdAt.toISOString(),
        description: pick(DESCRIPTIONS),
      }
      payments.push(payment)

      if (status === "refunded") {
        const full = rand() < 0.7
        refunds.push({
          id: `re_${pad(++refundSeq)}`,
          paymentId: payment.id,
          amount: full ? amount : Math.floor(amount / 2),
          currency: payment.currency,
          reason: pick([
            "requested_by_customer",
            "duplicate",
            "fraudulent",
          ] as const),
          createdAt: new Date(
            createdAt.getTime() + between(1, 6) * 86_400_000,
          ).toISOString(),
        })
      }

      if (status === "disputed") {
        const openedAt = new Date(createdAt.getTime() + between(2, 10) * 86_400_000)
        disputes.push({
          id: `dp_${pad(++disputeSeq)}`,
          paymentId: payment.id,
          merchantId: merchant.id,
          amount,
          currency: payment.currency,
          reasonCode: pick(REASON_CODES),
          status: pick([
            "needs_response",
            "needs_response",
            "under_review",
            "won",
            "lost",
          ] as const),
          openedAt: openedAt.toISOString(),
          evidenceDueAt: new Date(
            openedAt.getTime() + 14 * 86_400_000,
          ).toISOString(),
        })
      }
    }
  }

  const payouts = generatePayouts(payments)
  // Cards draw from the shared PRNG last so every earlier seed stays identical.
  const { cards, cardCharges, cardEvents } = generateCards()
  return { payments, refunds, disputes, payouts, cards, cardCharges, cardEvents }
}

/** A deterministic RFC 4122 v4 UUID, so seed ids are stable but never sequential. */
function uuidFrom(): string {
  const hex = () => Math.floor(rand() * 16).toString(16)
  const run = (n: number) => Array.from({ length: n }, hex).join("")
  const variant = pick(["8", "9", "a", "b"])
  return `${run(8)}-${run(4)}-4${run(3)}-${variant}${run(3)}-${run(12)}`
}

const CHARGE_DESCRIPTIONS: Record<CardCategory, string[]> = {
  advertising: ["Search ads", "Social campaign", "Sponsored listing"],
  software: ["Monthly subscription", "Seat upgrade", "Annual licence"],
  travel: ["Rail fare", "Hotel deposit", "Conference pass"],
  contractors: ["Design retainer", "Copywriting", "Bookkeeping"],
  office_supplies: ["Print run", "Packaging", "Stationery"],
  other: ["Miscellaneous"],
}

/**
 * Each seed card gets a utilisation band. Charges are generated to land in
 * it, so spend on the detail page is always the sum of real charge rows.
 */
const SEED_CARDS: {
  nickname: string
  merchantIndex: number
  status: CardStatus
  category: CardCategory
  spendLimit: number
  utilisation: [number, number]
  charges: number
}[] = [
  { nickname: "Ad spend", merchantIndex: 0, status: "active", category: "advertising", spendLimit: 250_000, utilisation: [30, 40], charges: 4 },
  { nickname: "Vendor SaaS", merchantIndex: 3, status: "active", category: "software", spendLimit: 40_000, utilisation: [85, 95], charges: 3 },
  { nickname: "Contractor tools", merchantIndex: 4, status: "active", category: "contractors", spendLimit: 120_000, utilisation: [0, 0], charges: 0 },
  { nickname: "Trade show travel", merchantIndex: 1, status: "frozen", category: "travel", spendLimit: 500_000, utilisation: [40, 50], charges: 5 },
  { nickname: "Print vendor", merchantIndex: 6, status: "cancelled", category: "office_supplies", spendLimit: 15_000, utilisation: [100, 100], charges: 2 },
  { nickname: "Cloud hosting", merchantIndex: 8, status: "active", category: "software", spendLimit: 80_000, utilisation: [10, 20], charges: 2 },
]

/** Split `total` into `parts` positive integers that sum exactly to it. */
function splitMinorUnits(total: number, parts: number): number[] {
  if (parts === 0) return []
  const cuts = Array.from({ length: parts - 1 }, () => between(1, total - 1)).sort((a, b) => a - b)
  const amounts: number[] = []
  let previous = 0
  for (const cut of [...cuts, total]) {
    amounts.push(cut - previous)
    previous = cut
  }
  return amounts
}

function generateCards() {
  const cards: Card[] = []
  const cardCharges: CardCharge[] = []
  const cardEvents: CardEvent[] = []

  for (const seed of SEED_CARDS) {
    const merchant = merchants[seed.merchantIndex]
    const createdAt = new Date(GENERATED_AT)
    createdAt.setUTCDate(createdAt.getUTCDate() - between(20, 60))
    createdAt.setUTCHours(between(8, 18), between(0, 59), 0, 0)
    const number = buildCardNumber(pad(between(0, 99_999_999_999), 11))

    const card: Card = {
      id: uuidFrom(),
      merchantId: merchant.id,
      nickname: seed.nickname,
      currency: merchant.currency,
      spendLimit: seed.spendLimit,
      category: seed.category,
      last4: number.slice(-4),
      numberRef: uuidFrom(),
      status: seed.status,
      createdAt: createdAt.toISOString(),
    }
    cards.push(card)
    cardEvents.push({ id: uuidFrom(), cardId: card.id, type: "issued", at: card.createdAt })

    const [low, high] = seed.utilisation
    const target = Math.round((seed.spendLimit * between(low, high)) / 100)
    splitMinorUnits(target, seed.charges).forEach((amount, index) => {
      const at = new Date(createdAt.getTime() + (index + 1) * between(1, 4) * 86_400_000)
      cardCharges.push({
        id: uuidFrom(),
        cardId: card.id,
        amount,
        currency: card.currency,
        description: pick(CHARGE_DESCRIPTIONS[seed.category]),
        createdAt: at.toISOString(),
      })
    })

    if (seed.status !== "active") {
      const at = new Date(createdAt.getTime() + between(15, 19) * 86_400_000)
      cardEvents.push({ id: uuidFrom(), cardId: card.id, type: seed.status, at: at.toISOString() })
    }
  }

  return { cards, cardCharges, cardEvents }
}

function generatePayouts(payments: Payment[]): Payout[] {
  const payouts: Payout[] = []
  let seq = 0

  for (const merchant of merchants) {
    for (let week = 0; week < 8; week++) {
      const periodEnd = new Date(GENERATED_AT)
      periodEnd.setUTCDate(periodEnd.getUTCDate() - week * 7)
      const periodStart = new Date(periodEnd)
      periodStart.setUTCDate(periodStart.getUTCDate() - 7)

      const inPeriod = payments.filter(
        (p) =>
          p.merchantId === merchant.id &&
          p.status === "captured" &&
          p.createdAt >= periodStart.toISOString() &&
          p.createdAt < periodEnd.toISOString(),
      )
      if (inPeriod.length === 0) continue

      const gross = inPeriod.reduce((sum, p) => sum + p.amount, 0)
      const fees = Math.round(gross * 0.029) + inPeriod.length * 30

      payouts.push({
        id: `po_${pad(++seq, 4)}`,
        merchantId: merchant.id,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        gross,
        fees,
        net: gross - fees,
        currency: merchant.currency,
        status: week === 0 ? "pending" : week === 1 ? "in_transit" : "paid",
        paymentIds: inPeriod.map((p) => p.id),
      })
    }
  }

  return payouts
}
