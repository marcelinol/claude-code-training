import { describe, expect, it } from "vitest"
import { generate } from "./generate"
import { merchantById } from "./merchants"

/**
 * The seed contract for cards, as written in .claude/rules/cards.md. Payments
 * come first from the shared PRNG, so these checks also guard against a card
 * change silently reshuffling every other seed.
 */

const V4_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe("generate: cards", () => {
  const { cards, cardCharges, cardEvents, payments } = generate()

  it("seeds six cards with a mix of statuses", () => {
    expect(cards).toHaveLength(6)
    expect(new Set(cards.map((c) => c.status))).toEqual(
      new Set(["active", "frozen", "cancelled"]),
    )
  })

  it("gives every seed a v4 UUID id and number reference", () => {
    for (const card of cards) {
      expect(card.id).toMatch(V4_UUID)
      expect(card.numberRef).toMatch(V4_UUID)
    }
  })

  it("never lets derived spend exceed the limit", () => {
    for (const card of cards) {
      const spent = cardCharges
        .filter((c) => c.cardId === card.id)
        .reduce((sum, c) => sum + c.amount, 0)
      expect(Number.isInteger(spent)).toBe(true)
      expect(spent).toBeGreaterThanOrEqual(0)
      expect(spent).toBeLessThanOrEqual(card.spendLimit)
    }
  })

  it("puts at least one active card past the amber threshold", () => {
    const past = cards.filter((card) => {
      const spent = cardCharges
        .filter((c) => c.cardId === card.id)
        .reduce((sum, c) => sum + c.amount, 0)
      return card.status === "active" && spent * 100 >= card.spendLimit * 80
    })
    expect(past.length).toBeGreaterThan(0)
  })

  it("records an issued event for every card and a status event for non-active ones", () => {
    for (const card of cards) {
      const types = cardEvents.filter((e) => e.cardId === card.id).map((e) => e.type)
      expect(types[0]).toBe("issued")
      if (card.status !== "active") expect(types).toContain(card.status)
    }
  })

  it("issues each card in its merchant's currency", () => {
    for (const card of cards) {
      expect(card.currency).toBe(merchantById(card.merchantId)?.currency)
    }
  })

  it("leaves the payment seeds untouched by drawing cards last", () => {
    // Known values from before cards existed; a change here means every seed shifted.
    expect(payments).toHaveLength(1658)
    expect(payments[0]).toMatchObject({ id: "pay_000001", amount: 2978 })
  })
})
