import { issueCard, parseIssueCardInput } from "@/data/cards"
import { NextRequest, NextResponse } from "next/server"

/** Issues a card. The only response anywhere that carries a full card number. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const parsed = parseIssueCardInput(body)
  if (!parsed.ok) {
    return NextResponse.json({ message: parsed.message }, { status: 400 })
  }

  const { card, number } = issueCard(parsed.input)
  return NextResponse.json({ card, number }, { status: 201 })
}
