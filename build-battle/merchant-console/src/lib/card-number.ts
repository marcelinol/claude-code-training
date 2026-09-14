import { randomInt } from "node:crypto"

/**
 * Card numbers are generated here and nowhere else. Every one starts with the
 * 4242 test BIN so nothing in this repository can resemble a real PAN.
 */

const TEST_BIN = "4242"
const BODY_LENGTH = 11

function luhnSum(digits: string, doubleFromRight: boolean): number {
  let sum = 0
  let double = doubleFromRight
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i])
    if (double) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
    double = !double
  }
  return sum
}

/** The digit that, appended to `partial`, makes the whole number Luhn-valid. */
export function luhnCheckDigit(partial: string): string {
  return String((10 - (luhnSum(partial, true) % 10)) % 10)
}

export function isLuhnValid(number: string): boolean {
  if (!/^\d+$/.test(number)) return false
  return luhnSum(number, false) % 10 === 0
}

/** TEST_BIN + eleven body digits + check digit: always sixteen digits. */
export function buildCardNumber(body: string): string {
  const partial = TEST_BIN + body
  return partial + luhnCheckDigit(partial)
}

export function generateCardNumber(): string {
  let body = ""
  for (let i = 0; i < BODY_LENGTH; i++) body += randomInt(10)
  return buildCardNumber(body)
}
