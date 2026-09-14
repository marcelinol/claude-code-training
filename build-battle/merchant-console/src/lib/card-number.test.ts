import { describe, expect, it } from "vitest"
import {
  buildCardNumber,
  generateCardNumber,
  isLuhnValid,
  luhnCheckDigit,
} from "./card-number"

describe("luhnCheckDigit", () => {
  it("produces the digit that makes a known number valid", () => {
    // 79927398713 is the worked example from the Luhn specification.
    expect(luhnCheckDigit("7992739871")).toBe("3")
    // The Stripe test card everyone recognises.
    expect(luhnCheckDigit("424242424242424")).toBe("2")
  })
})

describe("isLuhnValid", () => {
  it("accepts numbers with a correct check digit", () => {
    expect(isLuhnValid("79927398713")).toBe(true)
    expect(isLuhnValid("4242424242424242")).toBe(true)
  })

  it("rejects a single changed digit", () => {
    expect(isLuhnValid("4242424242424241")).toBe(false)
    expect(isLuhnValid("4243424242424242")).toBe(false)
  })

  it("rejects anything that is not all digits", () => {
    expect(isLuhnValid("")).toBe(false)
    expect(isLuhnValid("4242 4242 4242 4242")).toBe(false)
  })
})

describe("buildCardNumber", () => {
  it("prefixes the test BIN and appends the check digit", () => {
    expect(buildCardNumber("42424242424")).toBe("4242424242424242")
  })

  it("always yields a 16-digit Luhn-valid number on the 4242 BIN", () => {
    const number = buildCardNumber("00000000000")
    expect(number).toHaveLength(16)
    expect(number.startsWith("4242")).toBe(true)
    expect(isLuhnValid(number)).toBe(true)
  })
})

describe("generateCardNumber", () => {
  it("never leaves the test BIN and is always Luhn-valid", () => {
    for (let i = 0; i < 100; i++) {
      const number = generateCardNumber()
      expect(number).toMatch(/^4242\d{12}$/)
      expect(isLuhnValid(number)).toBe(true)
    }
  })
})
