import { randomUUID } from "node:crypto"
import { generateCardNumber } from "@/lib/card-number"
import { parseAmountToMinorUnits } from "@/lib/money"
import { merchantById } from "./merchants"
import { store } from "./store"
import { Card, CardStatus, Currency } from "./types"

export const CARD_CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]
/** 5,000,000 minor units: the ceiling the ticket sets for any single card. */
export const MAX_SPEND_LIMIT = 5_000_000
const MAX_NICKNAME_LENGTH = 40

export interface IssueCardInput {
  nickname: string
  merchantId: string
  /** Integer minor units. */
  spendLimit: number
  currency: Currency
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
  const { nickname, merchantId, spendLimit, currency } = body as Record<
    string,
    unknown
  >

  const name = typeof nickname === "string" ? nickname.trim() : ""
  if (!name) return reject("Give the card a nickname.")
  if (name.length > MAX_NICKNAME_LENGTH) {
    return reject(`Nicknames are at most ${MAX_NICKNAME_LENGTH} characters.`)
  }

  if (typeof merchantId !== "string" || !merchantById(merchantId)) {
    return reject("Choose a merchant.")
  }

  const limit =
    typeof spendLimit === "string" ? parseAmountToMinorUnits(spendLimit) : null
  if (limit === null) {
    return reject("Enter the spend limit as an amount like 250.00.")
  }
  if (limit <= 0) return reject("The spend limit must be more than zero.")
  if (limit > MAX_SPEND_LIMIT) {
    return reject("The spend limit cannot exceed 50,000.00.")
  }

  if (!CARD_CURRENCIES.includes(currency as Currency)) {
    return reject("Currency must be USD, EUR, or GBP.")
  }

  return {
    ok: true,
    input: {
      nickname: name,
      merchantId,
      spendLimit: limit,
      currency: currency as Currency,
    },
  }
}

/** Creates the card and returns its full number exactly once. It is never stored. */
export function issueCard(input: IssueCardInput): { card: Card; number: string } {
  const number = generateCardNumber()
  const card: Card = {
    id: randomUUID(),
    merchantId: input.merchantId,
    nickname: input.nickname,
    currency: input.currency,
    spendLimit: input.spendLimit,
    spent: 0,
    last4: number.slice(-4),
    numberRef: randomUUID(),
    status: "active",
    createdAt: new Date().toISOString(),
  }
  store.cards.push(card)
  return { card, number }
}

/** Newest first. */
export function listCards(): Card[] {
  return [...store.cards].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function cardById(id: string): Card | null {
  return store.cards.find((card) => card.id === id) ?? null
}

const TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

export const CARD_STATUSES: readonly CardStatus[] = ["active", "frozen", "cancelled"]

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
  return { ok: true, card }
}
