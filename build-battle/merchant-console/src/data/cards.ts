import { randomUUID } from "node:crypto"
import { generateCardNumber } from "@/lib/card-number"
import { formatMoney, parseAmountToMinorUnits, sumMinorUnits } from "@/lib/money"
import { CARD_CATEGORIES, CARD_CURRENCIES, MAX_SPEND_LIMIT } from "./card-rules"
import { merchantById } from "./merchants"
import { store } from "./store"
import {
  Card,
  CardCategory,
  CardCharge,
  CardEvent,
  CardEventType,
  CardStatus,
  Currency,
} from "./types"

const MAX_NICKNAME_LENGTH = 40

interface IssueCardInput {
  nickname: string
  merchantId: string
  /** Integer minor units. */
  spendLimit: number
  currency: Currency
  category: CardCategory
}

type ParseResult =
  | { ok: true; input: IssueCardInput }
  | { ok: false; message: string }

const reject = (message: string): ParseResult => ({ ok: false, message })

/**
 * The one place client input becomes a card request. Everything is checked
 * against an allowlist here; the route handler trusts nothing else.
 */
export function parseIssueCardInput(body: unknown): ParseResult {
  if (typeof body !== "object" || body === null) {
    return reject("The request body must be a JSON object.")
  }
  const { nickname, merchantId, spendLimit, currency, category } =
    body as Record<string, unknown>

  const name = typeof nickname === "string" ? nickname.trim() : ""
  if (!name) return reject("Give the card a nickname.")
  if (name.length > MAX_NICKNAME_LENGTH) {
    return reject(`Nicknames are at most ${MAX_NICKNAME_LENGTH} characters.`)
  }

  const merchant = typeof merchantId === "string" ? merchantById(merchantId) : undefined
  if (!merchant) return reject("Choose a merchant.")

  const limit =
    typeof spendLimit === "string" ? parseAmountToMinorUnits(spendLimit) : null
  if (limit === null) {
    return reject("Enter the spend limit as an amount like 250.00.")
  }
  if (limit <= 0) return reject("The spend limit must be more than zero.")

  if (!CARD_CURRENCIES.includes(currency as Currency)) {
    return reject("Currency must be USD, EUR, or GBP.")
  }
  if (limit > MAX_SPEND_LIMIT) {
    return reject(
      `The spend limit cannot exceed ${formatMoney(MAX_SPEND_LIMIT, currency as Currency)}.`,
    )
  }
  if (currency !== merchant.currency) {
    return reject(`${merchant.name} settles in ${merchant.currency}; the card currency must match.`)
  }

  if (!CARD_CATEGORIES.includes(category as CardCategory)) {
    return reject("Choose the merchant category the card is locked to.")
  }

  return {
    ok: true,
    input: {
      nickname: name,
      merchantId: merchant.id,
      spendLimit: limit,
      currency: currency as Currency,
      category: category as CardCategory,
    },
  }
}

function record(cardId: string, type: CardEventType): CardEvent {
  const event = { id: randomUUID(), cardId, type, at: new Date().toISOString() }
  store.cardEvents.push(event)
  return event
}

type IssueResult =
  | { card: Card; number: string; replayed: false }
  | { card: Card; number: null; replayed: true }

/**
 * Creates the card and returns its full number exactly once. A retry with the
 * same idempotency key gets the same card back, without the number.
 */
export function issueCard(input: IssueCardInput, idempotencyKey: string): IssueResult {
  const existingId = store.issuedCardsByKey.get(idempotencyKey)
  const existing = existingId ? cardById(existingId) : null
  if (existing) return { card: existing, number: null, replayed: true }

  const number = generateCardNumber()
  const card: Card = {
    id: randomUUID(),
    merchantId: input.merchantId,
    nickname: input.nickname,
    currency: input.currency,
    spendLimit: input.spendLimit,
    category: input.category,
    last4: number.slice(-4),
    numberRef: randomUUID(),
    status: "active",
    createdAt: new Date().toISOString(),
  }
  store.cards.push(card)
  store.issuedCardsByKey.set(idempotencyKey, card.id)
  record(card.id, "issued")
  return { card, number, replayed: false }
}

/** Newest first. */
export function listCards(): Card[] {
  return [...store.cards].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function cardById(id: string): Card | null {
  return store.cards.find((card) => card.id === id) ?? null
}

/** Newest first. */
export function chargesFor(cardId: string): CardCharge[] {
  return store.cardCharges
    .filter((charge) => charge.cardId === cardId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/** Integer minor units in the card's currency. Derived, never stored. */
export function spentFor(cardId: string): number {
  return sumMinorUnits(chargesFor(cardId).map((charge) => charge.amount))
}

/** Oldest first, so it reads as a timeline. */
export function eventsFor(cardId: string): CardEvent[] {
  return store.cardEvents
    .filter((event) => event.cardId === cardId)
    .sort((a, b) => a.at.localeCompare(b.at))
}

const TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

type TransitionResult =
  | { ok: true; card: Card }
  | { ok: false; reason: "not_found" | "invalid_transition" }

/** The server-side guard. The UI only offers moves; this decides them. */
export function transitionCard(id: string, to: CardStatus): TransitionResult {
  const card = cardById(id)
  if (!card) return { ok: false, reason: "not_found" }
  if (!canTransition(card.status, to)) {
    return { ok: false, reason: "invalid_transition" }
  }
  card.status = to
  record(card.id, to === "active" ? "unfrozen" : to)
  return { ok: true, card }
}
