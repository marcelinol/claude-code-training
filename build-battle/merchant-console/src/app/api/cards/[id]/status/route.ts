import { CARD_STATUSES } from "@/data/card-rules"
import { transitionCard } from "@/data/cards"
import { CardStatus } from "@/data/types"
import { NextRequest, NextResponse } from "next/server"

/** Moves a card through the status state machine. Never returns a full number. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const body = await request.json().catch(() => null)
  const status = body?.status
  if (!CARD_STATUSES.includes(status)) {
    return NextResponse.json(
      { message: "Status must be active, frozen, or cancelled." },
      { status: 400 },
    )
  }

  const { id } = await params
  const result = transitionCard(id, status as CardStatus)
  if (!result.ok) {
    return result.reason === "not_found"
      ? NextResponse.json({ message: "That card does not exist." }, { status: 404 })
      : NextResponse.json(
          { message: `This card cannot move to ${status} from its current status.` },
          { status: 409 },
        )
  }

  return NextResponse.json({ card: result.card })
}
