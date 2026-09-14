import { issueCard, parseIssueCardInput } from "@/data/cards"
import { NextRequest, NextResponse } from "next/server"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Issues a card. The only response anywhere that carries a full card number.
 * A retry with the same key returns the same card with `number: null`.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const parsed = parseIssueCardInput(body)
  if (!parsed.ok) {
    return NextResponse.json({ message: parsed.message }, { status: 400 })
  }

  const key = (body as Record<string, unknown>).idempotencyKey
  if (typeof key !== "string" || !UUID.test(key)) {
    return NextResponse.json(
      { message: "Each issue request needs a UUID idempotencyKey." },
      { status: 400 },
    )
  }

  const result = issueCard(parsed.input, key)
  return NextResponse.json(result, { status: result.replayed ? 200 : 201 })
}
