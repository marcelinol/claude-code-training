import { describe, expect, it } from "vitest"
import { isLuhnValid } from "@/lib/card-number"
import {
  canTransition,
  cardById,
  issueCard,
  listCards,
  parseIssueCardInput,
  transitionCard,
} from "./cards"
import { store } from "./store"

const good = {
  nickname: "Ad spend",
  merchantId: "mch_01",
  spendLimit: "250.00",
  currency: "USD",
}

describe("parseIssueCardInput", () => {
  it("accepts a complete request and converts the limit to minor units", () => {
    const result = parseIssueCardInput(good)
    expect(result).toEqual({
      ok: true,
      input: {
        nickname: "Ad spend",
        merchantId: "mch_01",
        spendLimit: 25000,
        currency: "USD",
      },
    })
  })

  it("rejects a missing or unknown merchant", () => {
    expect(parseIssueCardInput({ ...good, merchantId: undefined }).ok).toBe(false)
    expect(parseIssueCardInput({ ...good, merchantId: "mch_99" }).ok).toBe(false)
  })

  it("rejects a zero or negative limit", () => {
    expect(parseIssueCardInput({ ...good, spendLimit: "0" }).ok).toBe(false)
    expect(parseIssueCardInput({ ...good, spendLimit: "-5" }).ok).toBe(false)
  })

  it("rejects a limit above 5,000,000 minor units", () => {
    expect(parseIssueCardInput({ ...good, spendLimit: "50000.01" }).ok).toBe(false)
    expect(parseIssueCardInput({ ...good, spendLimit: "50000.00" }).ok).toBe(true)
  })

  it("rejects a limit it cannot represent exactly", () => {
    expect(parseIssueCardInput({ ...good, spendLimit: "12.345" }).ok).toBe(false)
    expect(parseIssueCardInput({ ...good, spendLimit: 25000 }).ok).toBe(false)
  })

  it("rejects a currency outside USD, EUR, GBP", () => {
    expect(parseIssueCardInput({ ...good, currency: "JPY" }).ok).toBe(false)
  })

  it("rejects a blank nickname and trims a padded one", () => {
    expect(parseIssueCardInput({ ...good, nickname: "   " }).ok).toBe(false)
    const result = parseIssueCardInput({ ...good, nickname: "  Ad spend  " })
    expect(result.ok && result.input.nickname).toBe("Ad spend")
  })

  it("rejects a body that is not an object", () => {
    expect(parseIssueCardInput(null).ok).toBe(false)
    expect(parseIssueCardInput("nope").ok).toBe(false)
  })

  it("returns a message a user can read on every rejection", () => {
    const result = parseIssueCardInput({ ...good, currency: "JPY" })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toMatch(/currency/i)
  })
})

describe("issueCard", () => {
  it("stores a masked active card and returns the full number once", () => {
    const before = store.cards.length
    const parsed = parseIssueCardInput(good)
    if (!parsed.ok) throw new Error(parsed.message)

    const { card, number } = issueCard(parsed.input)

    expect(number).toMatch(/^4242\d{12}$/)
    expect(isLuhnValid(number)).toBe(true)
    expect(card.last4).toBe(number.slice(-4))
    expect(card.status).toBe("active")
    expect(card.spent).toBe(0)
    expect(card.spendLimit).toBe(25000)
    expect(card.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(JSON.stringify(card)).not.toContain(number)
    expect(store.cards.length).toBe(before + 1)
    expect(cardById(card.id)).toEqual(card)
    expect(listCards()[0]).toEqual(card)
  })
})

describe("canTransition", () => {
  it("lets active and frozen swap and either become cancelled", () => {
    expect(canTransition("active", "frozen")).toBe(true)
    expect(canTransition("frozen", "active")).toBe(true)
    expect(canTransition("active", "cancelled")).toBe(true)
    expect(canTransition("frozen", "cancelled")).toBe(true)
  })

  it("never leaves cancelled", () => {
    expect(canTransition("cancelled", "active")).toBe(false)
    expect(canTransition("cancelled", "frozen")).toBe(false)
    expect(canTransition("cancelled", "cancelled")).toBe(false)
  })

  it("does not count staying put as a transition", () => {
    expect(canTransition("active", "active")).toBe(false)
    expect(canTransition("frozen", "frozen")).toBe(false)
  })
})

describe("transitionCard", () => {
  const issue = () => {
    const parsed = parseIssueCardInput(good)
    if (!parsed.ok) throw new Error(parsed.message)
    return issueCard(parsed.input).card
  }

  it("freezes an active card and thaws it again", () => {
    const card = issue()
    expect(transitionCard(card.id, "frozen")).toEqual({ ok: true, card: { ...card, status: "frozen" } })
    expect(cardById(card.id)?.status).toBe("frozen")
    expect(transitionCard(card.id, "active")).toMatchObject({ ok: true, card: { status: "active" } })
  })

  it("refuses a move the state machine does not allow", () => {
    const card = issue()
    transitionCard(card.id, "cancelled")
    const result = transitionCard(card.id, "active")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe("invalid_transition")
    expect(cardById(card.id)?.status).toBe("cancelled")
  })

  it("reports an unknown card separately from a refused move", () => {
    const result = transitionCard("00000000-0000-4000-8000-000000000000", "frozen")
    expect(result).toEqual({ ok: false, reason: "not_found" })
  })
})
