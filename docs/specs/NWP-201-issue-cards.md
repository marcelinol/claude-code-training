# SPEC · NWP-201 — Issue virtual cards from the console

> Written before any code. Generated with `/spec`, then edited by a human.
> Load it as context when you build: `@docs/specs/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** Luciano Medeiros
**Status:** building

## Problem

Ops issues virtual cards by asking the platform team in Slack. It takes hours, happens twelve to twenty times a week, and last month two cards got the wrong spend limit because the request lived in a thread. Ops needs to issue a card, see the cards they have issued, and open one to check it, without leaving the console.

## Current state

Paths are relative to `build-battle/merchant-console/`.

- `src/app/` — routes for overview, payments, disputes, payouts. No `/cards` route. `CLAUDE.md` says "Cards is NWP-201 and does not exist yet".
- `src/data/types.ts` — `Merchant`, `Payment`, `Refund`, `Dispute`, `Payout`. No `Card` type. `Currency` is already `"USD" | "EUR" | "GBP"`, the exact allowlist the ticket asks for.
- `src/data/store.ts` — in-memory `Store` on `globalThis.__northwindStore` with `merchants`, `payments`, `refunds`, `disputes`, `payouts`. No `cards`.
- `src/data/generate.ts` — deterministic seed data from `mulberry32(20260813)`. No card generation.
- `src/data/merchants.ts` — ten fictional merchants, each with a `currency` and `timezone`.
- `src/lib/money.ts` — `formatMoney(minorUnits, currency)` and `parseAmountToMinorUnits(input)` already exist. The spend limit must go through these.
- `src/lib/dates.ts` — `formatDate` (UTC, tables) and `formatInZone` (merchant timezone, detail pages).
- `src/app/api/payments/export/route.ts` — the house pattern for validation-first route handlers returning `{ message }` with a 400.
- `src/components/ui/payments/StatusBadge.tsx` — one badge for every status type in the app; card statuses belong here, not in a new component.
- `src/components/Drawer.tsx`, `Input.tsx`, `Select.tsx`, `Table.tsx` — the primitives the issue form and list use.
- No Luhn code and no status state machine exist anywhere in the codebase.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| Money is integer minor units. `$250.00` is `25000`. Format once, at the edge. | `CLAUDE.md`, `.claude/rules/money.md` | Limits drift by cents; two halves of the app disagree |
| Generated numbers use the `4242` test BIN and a valid Luhn check digit. | `CLAUDE.md`, `.claude/rules/cards.md` | Something in the repo resembles a real PAN |
| Generate on the server. A card number produced in the browser is a bug. | `.claude/rules/cards.md` | Client can forge numbers |
| The full number is returned exactly once, in the creation response. After that, last four only. | `CLAUDE.md`, `.claude/rules/cards.md`, `.claude/rules/api-routes.md` | Full PANs leak through list or detail payloads |
| Status is a state machine: `active ⇄ frozen`, either to `cancelled`, `cancelled` is terminal. Guard it on the server. | `CLAUDE.md`, `.claude/rules/cards.md` | A cancelled card comes back to life |
| Validate on the server against an allowlist. | `CLAUDE.md`, `.claude/rules/api-routes.md` | Client sends `JPY` or a negative limit |
| Storage and bucketing are UTC; display converts to the merchant timezone. | `CLAUDE.md` | Created dates shift by a day near midnight |
| Never edit seed data to make a failing case disappear. | root `CLAUDE.md` | Tests pass for the wrong reason |

## Approach

Build cards as a sibling of payments using the same shapes: a `Card` type and `cards` array in the store, a data module for validation and the state-machine guard, one `POST /api/cards` route, and three UI pieces (list page, issue drawer, detail page). Pure Luhn functions live in `src/lib/card-number.ts` with a test beside them, matching how `money.ts` and `dates.ts` are organised, and so `generate.ts` can seed Luhn-valid cards without an import cycle. Ids and number references are UUIDs. Dev gets six deterministic seed cards; production starts empty. The spend limit crosses the wire as the string the user typed and is converted once, on the server, with the existing `parseAmountToMinorUnits`.

**Considered and rejected:**
- *Client converts the limit to minor units and posts an integer.* Rejected: `money.md` says client input is converted at the boundary once, and the boundary is the server.
- *Sequential ids (`card_0001`).* Rejected: a real issuing system never exposes issue order or count; UUIDs match what a safe environment would return.
- *A `GET /api/cards` list route.* Rejected: list and detail are server components that read the store, exactly as `payments/page.tsx` does. No caller needs the JSON.
- *Seeding cards in production too.* Rejected: seed cards are for the dev experience; production must start from what ops actually issued.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | change | `CardStatus`, `Card` |
| `src/lib/card-number.ts` + `.test.ts` | add | Luhn digit, validity, `4242` builder, server generator |
| `src/data/generate.ts` | change | six deterministic dev cards, generated last so other seeds do not shift |
| `src/data/store.ts` | change | `cards: Card[]`, empty in production |
| `src/data/cards.ts` + `.test.ts` | add | `parseIssueCardInput`, `issueCard`, `listCards`, `cardById`, `canTransition` |
| `src/app/api/cards/route.ts` | add | `POST`: validate, issue, return full number once |
| `src/app/siteConfig.ts` | change | `baseLinks.cards` |
| `src/components/ui/navigation/AppSidebar.tsx` | change | Cards nav item |
| `src/components/ui/payments/StatusBadge.tsx` | change | `active`, `frozen`, `cancelled` |
| `src/app/cards/page.tsx` | add | list, empty state |
| `src/app/cards/issue-card-dialog.tsx` | add | form, errors, one-time reveal, copy |
| `src/app/cards/[id]/page.tsx` | add | detail with spend against limit |
| `CLAUDE.md`, `.claude/rules/cards.md` | change | cards now exist; UUID and server-parse rules |

## Plan

1. **Types, store, seed cards** — done when `tsc` is clean, existing tests still pass, and the dev store holds six cards.
2. **`card-number.ts` via TDD** — done when Luhn tests pass and every generated number starts `4242`, is 16 digits, and is Luhn-valid.
3. **`cards.ts` via TDD** — done when each ticket rejection case returns a message, a good body issues a card, and `canTransition` matches the state machine.
4. **`POST /api/cards`** — done when `curl` gets 201 with a `4242…` number for a good body and 400 `{ message }` for each bad one.
5. **Nav, badge, config** — done when `/cards` is in the sidebar and highlights when active.
6. **List page and issue drawer** — done when the six seeds render masked, issuing shows the number once, and closing shows the new row masked.
7. **Detail page** — done when a row opens to its record with limit, spent, remaining, and both timestamps; an unknown id 404s.
8. **Instruction files** — done when `CLAUDE.md` no longer says cards do not exist and the UUID and server-parse rules are written down.
9. **Quality gate** — done when `npm test`, `npm run lint`, `tsc --noEmit`, and `/ship-ready` are clean.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card | Manual: submit the drawer, new row appears after close |
| Card list at `/cards` | Manual: six seeds with nickname, merchant, mask, limit, status, date |
| Card detail | Manual: click a row, see full record and spend against limit |
| Generated numbers on `4242` with valid Luhn | `card-number.test.ts` |
| Reveal once, mask forever | Manual: number visible only in the drawer success view; grep list/detail payloads for no 16-digit strings |
| Server-side validation | `cards.test.ts` plus `curl` against the route with each bad body |
| Money is minor units | `parseAmountToMinorUnits` on the server; `formatMoney` only in components |
| State machine | `cards.test.ts` on `canTransition` |

## Risks

- Adding card generation to `generate.ts` could shift the shared PRNG and change existing seeds. Mitigation: generate cards last, and confirm the existing tests and the payments list are unchanged.
- The full number could linger in React state after the drawer closes. Mitigation: reset all form and reveal state in the drawer's `onOpenChange(false)`.
- Time. Core first; freeze/unfreeze and the spend bar only if the clock allows.

## Out of scope

- Persistence (NWP-203), auth and roles, real issuer calls, editing a limit after issue (NWP-202).
- Freeze/unfreeze, spend bar, category lock: stretch, tracked in the ticket, built only after core is done.

## Open questions

- None at build start. Currency defaults to the merchant's but is not enforced to match; the ticket only requires the USD/EUR/GBP allowlist.
