---
paths:
  - "src/**/card*.ts"
  - "src/**/card*.tsx"
  - "src/**/cards/**"
---

# Cards

- **Test BIN only.** Every generated number starts `4242` and carries a valid Luhn check digit. Nothing here may resemble a real PAN, ever, including in tests and fixtures.
- **Generate on the server.** A card number produced in the browser is a bug.
- **Reveal once.** The full number appears in the creation response and nowhere else: not on the card record, not in a list or detail payload, not left in client state after the success screen closes.
- **Mask everywhere else** as `•••• 4242`.
- **Status is a state machine.** `active ⇄ frozen`, either to `cancelled`, and `cancelled` is terminal. Guard the transition on the server, not only in the UI.
- Spend limits follow the money rule: integer minor units, with a currency. The limit crosses the wire as the string the user typed and is parsed once, on the server, with `parseAmountToMinorUnits`.
- **Ids are UUIDs.** Issued cards and their number references come from `crypto.randomUUID()`; seed rows derive a deterministic v4 UUID from the PRNG. Sequential ids leak issue order and count; a real issuer never exposes either.
- **Dev seeds, production empty.** `generate.ts` seeds six deterministic cards, their charges, and their history for the dev server; `store.ts` drops them when `NODE_ENV` is `production`.
- **Spend is derived.** A card never stores `spent`. It is the sum of its `CardCharge` rows, computed by `spentFor` in `src/data/cards.ts`.
- **Currency matches the merchant.** A card is issued in the merchant's settlement currency; the parser rejects anything else.
- **Category lock is chosen at issue** from the `CARD_CATEGORIES` allowlist and cannot be changed afterwards.
- **Issuing is idempotent.** Every issue request carries a UUID `idempotencyKey`; a retry with the same key returns the same card with `number: null`, never a second card and never the number again.
- **Every status change is recorded** as a `CardEvent`, shown as the card's history. Cancelling from the UI asks for confirmation because it cannot be undone.
- **Allowlists live in one place**, `src/data/card-rules.ts`, imported by both the server parser and the drawer.
