import { CardCategory, CardStatus, Currency } from "./types"

/**
 * The card allowlists, shared by the server parser and the issue drawer so
 * neither side can drift from the other. Nothing here touches the store.
 */

export const CARD_CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]

export const CARD_CATEGORIES: readonly CardCategory[] = [
  "advertising",
  "software",
  "travel",
  "contractors",
  "office_supplies",
  "other",
]

export const CATEGORY_LABELS: Record<CardCategory, string> = {
  advertising: "Advertising",
  software: "Software",
  travel: "Travel",
  contractors: "Contractors",
  office_supplies: "Office supplies",
  other: "Other",
}

export const CARD_STATUSES: readonly CardStatus[] = ["active", "frozen", "cancelled"]

/** 5,000,000 minor units: the ceiling the ticket sets for any single card. */
export const MAX_SPEND_LIMIT = 5_000_000
