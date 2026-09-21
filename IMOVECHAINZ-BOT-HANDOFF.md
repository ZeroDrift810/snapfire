# iMoveChainz Bot — Storefront Integration Handoff

Bring the iMoveChainz storefront into the Discord bot (AP shop + player-hub delivery), **1:1 synced
with the web** (`cfmos-web`, live at `imovechainz.cfmos.com`). The web is the single source of truth
for the catalog, the rendered artifacts, and the entitlement ledger. The bot is a client.

**Repo:** `C:\iMoveChainz\iMoveChainzBot` (PM2 `imovechainz` on t740).
**Companion (do not edit):** `C:\Users\Himkage\Desktop\cfmos-web` — already built + deployed the API below.

---

## The 1:1 rule (non-negotiable)

Do NOT duplicate the catalog, re-implement the renderer, or open a second entitlement store. All of
that lives on the web. The bot talks to the web over a Bearer-gated machine API and shows the exact
same products, prices, and art. A purchase in the bot (AP) and a purchase on the web (Stripe) write
the **same** `store_entitlements/{discordId}` ledger in the `cfm-os-prod` Firestore project, so they
are indistinguishable and unlock on both surfaces instantly.

**The bot needs exactly one secret: `STORE_BOT_TOKEN`.** It does NOT need `cfm-os-prod` Firestore
credentials, do not add a firebase-admin app for the storefront. Entitlement reads and writes go
through the web endpoints below.

---

## The web contract (already live)

Base URL: `https://imovechainz.cfmos.com`
Auth header on every call: `Authorization: Bearer ${STORE_BOT_TOKEN}` (same value the web has in
Vercel). Missing/wrong token ⇒ `401`. The token is shared out-of-band; never commit it.

### 1. Catalog
```
GET /api/store/catalog
-> { products: [ { id, type: 'scheme'|'playsheet'|'template', title, blurb, priceUsd, apPrice } ] }
```
Render the AP shop / hub from this. **`apPrice` is the AP cost, already computed** (don't invent your
own mapping); `priceUsd` is the parallel Stripe price. The product set + titles + blurbs come from here.

**AP runs PARALLEL to Stripe (not a tier):** a player can buy a product with AP in the bot OR pay USD
on the web, and EITHER unlocks the SAME entitlement (both write `store_entitlements/{discordId}`). So
buying a scheme with AP in Discord makes it downloadable on the web too, and vice versa. AP does not
gate a subset; it's a second register for the same catalog.

### 2. Read a player's entitlement (owned / locked badges)
```
GET /api/store/entitlements?discordId=<id>
-> { discordId, products: string[], subscriptionUntil: number /*epoch ms*/, subscriptionActive: boolean }
```
A product is owned if `products.includes(id) || subscriptionActive`.

### 3. Grant after an AP purchase (the only write path)
```
POST /api/store/grant   (application/json)
  { discordId, productId }            -> unlock one product (idempotent; alreadyOwned:true if owned)
  { discordId, subscriptionDays }     -> grant/extend all-access for N days
-> { ok: true, ... }
```
Flow: verify the player's AP balance → call grant → on `ok:true`, deduct AP and confirm. If grant is
for something already owned (`alreadyOwned:true`), do not deduct again.

### 4. Artifacts (same engine images as the web)
```
GET /api/store/<id>/artifact?kind=preview                  -> image/png  (free teaser)
GET /api/store/<id>/artifact?kind=pdf&discordId=<id>        -> application/pdf (402 if not entitled)
```
Post the `preview` PNG in the shop/hub embed. Deliver the `pdf` (DM or ephemeral) only after the
player owns it, the endpoint enforces entitlement against the shared ledger, so a 402 means "not
owned".

---

## Build (this phase)

Priority: **AP shop + hub delivery first.** (The OC/DC mini-app — owned schemes become callable
playbooks in the playcall game — is a later phase, not now.)

1. **Catalog cache:** fetch `/api/store/catalog` (cache a few minutes). Don't hardcode products.
2. **Store panel / `/lab`:** browse by type (scheme / playsheet / template) with buttons or a select;
   show the product's `preview` PNG in an embed with title, blurb, and AP price; show an "Owned"
   state by checking `/api/store/entitlements`.
3. **Buy with AP:** confirm funds → `POST /api/store/grant {discordId, productId}` → deduct AP →
   confirm. Idempotent (never double-charge).
4. **All-Access:** a subscription product → `POST /api/store/grant {discordId, subscriptionDays}`
   (pick the window, e.g. 30). Gate everything on `entitlements`.
5. **Deliver:** owned → fetch `kind=pdf` and DM it (or ephemeral). Locked → show the Buy CTA.
6. **Player-hub entry:** a "Playbook Lab" button/module that opens the store panel.

---

## Rules

- **Voice/brand:** iMoveChainz brand. **No em dashes** and **no the word "AI"** in any player-facing
  copy (embeds, buttons, modals). Mirror the web's tone.
- **Cross-bot check** before shipping: this reaches into the shared `cfm-os-prod` storefront ledger
  (indirectly, via the web). Confirm nothing in the bot writes storefront entitlements anywhere else.
- **Test in `botstuff` (`1418823834341212190`)**, never a production channel.
- **Deploy** via `deploy imovechainz` (git reset to origin/main → npm ci → tsc → pm2 restart on t740).
  Ask before restarting.
- **Secrets:** `STORE_BOT_TOKEN` goes in the bot's env only; never in code or commits.

---

## Smoke test (once STORE_BOT_TOKEN is set on both sides)

```
TOKEN=...   # same value as Vercel
B=https://imovechainz.cfmos.com
curl -H "Authorization: Bearer $TOKEN" "$B/api/store/catalog"
curl -H "Authorization: Bearer $TOKEN" "$B/api/store/entitlements?discordId=<you>"
curl -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' -d '{"discordId":"<you>","productId":"air-raid"}' "$B/api/store/grant"
curl -H "Authorization: Bearer $TOKEN" "$B/api/store/air-raid/artifact?kind=pdf&discordId=<you>" -o air-raid.pdf
```
Granting `air-raid` here should immediately make it show as owned on the **web** too (sign in at
cfmos.com → `imovechainz.cfmos.com/store/p/air-raid` shows Download). That round-trip IS the 1:1 proof.

---

## Product ids (current seed; fetch the catalog for the live set)

- Schemes ($14.99): `air-raid`, `west-coast-zone-run`, `multiple-power-run`
- Playsheets: `air-raid-playsheet`, `west-coast-zone-run-playsheet`, `multiple-power-run-playsheet` ($6.99), `blank-field-shell` ($3.99)
- Template ($9.99): `def-formations`
