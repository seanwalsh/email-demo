# Live Tracking Lookup: Research and Plan

Date: 2026-10-12. Scope: add live status / ETA / events / delivered time per tracking number to the `shipments` feature.

Evidence legend: **V** = verified on 2026-10-12 against an official page or doc I could load. **S** = secondary source only (third-party blog/vendor page), treat as likely but check. **U** = not verified; I could not load an authoritative source. Several official pages (UPS developer portal in particular) timed out or blocked fetching, so UPS is mostly S/U.

## 1. Executive summary

- Build a `TrackingProvider` adapter layer and a tracking-refresh job that is separate from the 60-second mail poll. Never call carriers from the mail poll path.
- Prototype order: **USPS API first** (free, key-only, and it covers the real example, a 26-digit `92...` number), then **UPS, FedEx, DHL official APIs** (all free with registration), then **one aggregator as fallback** for what the official APIs cannot do (Amazon `TBA`, PostNord/foreign last-mile, any number the official API rejects). Best fallback candidate: **17TRACK** (cheap, prepaid, webhooks, carrier auto-detect), with **TrackingMore** or **Ship24** as alternates. Pricing pages for all three conflict or were incomplete, so confirm before committing.
- Amazon Logistics has no public tracking API that I could find. Realistic options: aggregator coverage (unverified for TBA), parsing Amazon's own notification emails (already in the user's inbox), or deep-link only.
- Do not scrape carrier web pages. ToS risk plus bot protection make it fragile; the free APIs make it unnecessary.
- For a real multi-user app, the official-API terms (esp. USPS and DHL) restrict redistribution and require deleting data, and per-user quotas are small. Plan on a commercial aggregator as the primary path at scale and contact each carrier about volume terms.

## 2. Existing code touchpoints (read before planning)

- `lib/automations/shipments/carriers.ts`: `CarrierId = ups|usps|fedex|dhl|amazon`; each carrier has `pattern`, `validate`, `trackUrl`.
- `extract.ts`: derives `{trackingNumber, carrier, status, eta}` from email text. Status is regex-only. `fromLabeled` deliberately trusts the email's stated carrier ("UPS tracking number: 9261...") even when the number shape looks like USPS.
- `sync.ts`: `syncShipments(provider, db, accountId)` scans mail, upserts `shipments`, status only moves forward via `rank`. It dedupes overlapping runs with an in-memory `running` map.
- `lib/db/schema.ts`: `shipments` has `status` (shipped|out_for_delivery|delivered), `eta` (YYYY-MM-DD), `dismissed`, unique (accountId, trackingNumber). No last-checked, events, or delivered time.
- Note: the label-trusted case means `carrier` (what the email says) and the carrier that actually has the data can differ. The adapter needs a "carrier hint" and a way to try alternates.

## 3. Official carrier APIs

### 3.1 USPS (new APIs platform)

- **API**: Tracking (portal lists "Tracking 3.2" as current; legacy Web Tools being replaced) on the USPS developer portal. Source: https://developers.usps.com/trackingv3r2 (V that the page exists; it did not render API details for me). Endpoint reported as `GET https://apis.usps.com/tracking/v3/tracking/{trackingNumber}` with optional `expand=DETAIL` for full history (S: https://docs.tenovi.com/recipes/usps-granular-shipping-status/). Response field names (expected delivery date, event list) U; confirm with a test call.
- **Auth**: OAuth 2.0 client credentials; create an app in the portal to get Consumer Key/Secret (V, FAQ: https://developers.usps.com/faq). Cache the token (S, Tenovi link above).
- **Registration/approval**: FAQ says the default product includes Tracking, OAuth, Addresses, Pricing, etc., and that "some API products are approved automatically and others require administrative approvals" (V: https://developers.usps.com/faq). Another FAQ copy omitted Tracking from the default list (S: https://developer.usps.com/faq), so check your app's product list. Whether a Business Customer Gateway / Customer Registration ID is needed for Tracking: U. Approval time: U.
- **Limits**: Default quota reported as 60 calls/hour per API (S via search snippet of https://developer.usps.com/faq; the other FAQ copy says only "limited per hour", numeric value not shown, V). Increase via a service request (https://emailus.usps.com/s/usps-APIs per FAQ) or a Registration for API Access form (S). For one user with a handful of packages and a poll cadence of tens of minutes this is fine; it is a hard constraint for multi-user.
- **Sandbox**: U (not confirmed).
- **Terms** (V, https://developers.usps.com/terms-and-conditions): data may be used for commercial informational purposes only to inform users about **their own** shipping/mailing transactions; no resale or licensing of the data; no building databases or AI models from the data; USPS may demand deletion of credentials and data (including derivatives); daily request limits can change without notice; no implied USPS endorsement. A consumer email client showing a user's own packages fits; a data warehouse of events does not. No explicit caching rule, but "retain only what you need" is the safe posture.
- **Gotchas**: IMpb/GS1 numbers are 20-26 digits starting 9x (matches our `usps` pattern). Last-mile hand-offs (UPS Ground Saver, FedEx Ground Economy) use these numbers, so a USPS lookup may be the only source of the final-mile events. UPS renamed SurePost to Ground Saver in 2025; UPS says final delivery is by UPS or USPS depending on destination (V: https://www.ups.com/us/en/support/shipping-support/shipping-costs-rates/ups-ground-saver; rename S: https://www.freightwaves.com/news/ups-rebrands-surepost-as-ground-saver). Whether UPS's own Tracking API returns the USPS leg for a bare `92...` number: U.
- **The real example** (`92612926998410543494064502`, labeled "UPS tracking number"): 26 digits starting `92` is a USPS IMpb shape. Try USPS first even when the email says UPS, then UPS, then aggregator. PostNord (Nordic carrier) will not be in the USPS/UPS APIs; only an aggregator might cover it (U).
- Verified 2026-10-12: terms, FAQ, default-product claim. Not verified: response schema, numeric quota (conflict), sandbox, approval time, account prerequisites.

### 3.2 UPS

- **API**: UPS Tracking API on developer.ups.com. Reported endpoint `GET /api/track/v1/details/{inquiryNumber}` on production host `onlinetools.ups.com`, test host `wwwcie.ups.com` (S: https://atoship.com/blog/ups-shipping-api-integration-developer-guide and similar guides; U against official docs, https://developer.ups.com timed out).
- **Auth**: OAuth 2.0 client credentials (Basic auth with client id/secret to `/security/v1/oauth/token`, tokens ~4 hours); the older access-key/username scheme was deprecated in 2023 (S, same sources).
- **Returns**: package status, activity history, delivery date/estimates and milestones (S/U; field names not verified).
- **Registration**: sign in with a UPS.com account, create an app, get client id/secret; production credentials are reported to require approval (S). Whether a UPS shipper account number is required to link: U. Approval time: U.
- **Limits**: no official numbers found. A third-party article cites error 10429 "too many requests" (S: https://www.shippypro.com/blog/en/ups-error-10429-too-many-requests-the-complete-fix-guide); do not assume a figure.
- **Sandbox**: CIE host and test number `1Z999AA10123456784` reported (S). Reported quirk: not-found returns HTTP 200 with warning code (S, single forum post).
- **Terms**: not verified. UPS developer terms historically restrict use to UPS services and ban scraping and resale; read before shipping to users.
- **Gotchas**: Mail Innovations / SurePost / Ground Saver numbers: behavior U. Ground Saver is claimed to have end-to-end UPS tracking on a `1Z` number (V, UPS FAQ above), so the `1Z` number should work; a bare 26-digit `92` number is likely USPS-only (inference).
- Verified 2026-10-12: Ground Saver FAQ only. Everything else S/U. Action: a human should open the UPS developer docs and confirm.

### 3.3 FedEx

- **API**: FedEx Track API on developer.fedex.com ("Track by Tracking Number" among six Track endpoints) (V: https://developer.fedex.com/api/en-us/guides/ratelimits.html mentions six Track endpoints).
- **Auth**: OAuth 2.0 client credentials, token valid one hour, reuse it (V: ratelimits page). Test `https://apis-sandbox.fedex.com`, production `https://apis.fedex.com` (S: https://docs.runalloy.com/connectors/FedEx).
- **Registration**: create a project on the portal, choose Track API. Sandbox keys do not need a shipping account; production keys appear to need a linked FedEx account number (S: https://help.the7bridges.com/a-guide-for-customers-to-obtain-fedex-tracking-api-keys; no official confirmation). A personal FedEx account may be enough; U. Approval time: U.
- **Limits** (V, ratelimits page): Track capability default 100K requests/day per project; project rate limit 1,400 transactions per 10 seconds; token endpoint abuse (more than ~3/sec burst or ~1/sec sustained per IP) triggers a 10-minute 403 penalty. FedEx may change limits without notice. 429s: retry after 10 s for rate limits, after midnight GMT for daily quota (S: https://developer.fedex.com/api/en-jm/guides/ratelimits.html).
- **Returns**: status, scan events, estimated/committed delivery (S/U; field names not verified).
- **Terms**: not verified.
- **Gotchas**: our pattern accepts bare 12/15-digit numbers only with FedEx context; wrong-carrier numbers return not-found, so treat not-found as "try next provider". Ground Economy / SmartPost: the 22-digit `96...` is FedEx but the final leg is USPS (S: https://www.parcelmonitor.com/blog/smartpost-surepost-ground-economy-explained).
- Verified 2026-10-12: limits and token behavior. Not verified: response schema, production prerequisites, terms.

### 3.4 DHL

- **API**: Shipment Tracking - Unified v1.5.8 on developer.dhl.com (V: https://developer.dhl.com/api-reference/shipment-tracking). Base `https://api-eu.dhl.com/track/shipments`, used for sandbox and production (V via search of https://developer.dhl.com/tracking).
- **Auth**: API key (`DHL-API-Key` header). Create an app, request access to the API (V). Demo key returns mocked data only (V).
- **Coverage**: Express, eCommerce, Parcel Germany, Global Forwarding, Freight, Supply Chain. Login-gated B2B services excluded (V). Our `JD...`/`JJD...` patterns are DHL eCommerce/Express shapes.
- **Returns**: status codes (treat unknown as undefined), `estimatedTimeOfDelivery` for some services only, full event history, proof of delivery for Express/Freight after postal-code check (V). Providing `recipientPostalCode`/`service` improves matching and detail.
- **Limits**: initial 250 calls/day, 1 call per 5 seconds (V, API page; an older description says 1/sec). Described as for development; upgrade via My Apps > Request Upgrade, granted per use case (V).
- **Terms** (V): tracking data is confidential; no sharing with third parties or competitive use without consent; use only for your own or your customers' legitimate tracking; no combining with advertising; delete data 30 days after delivery; display "Delivered by Deutsche Post DHL Group" to recipients; DHL may audit. The 30-day deletion rule must be honored by retention logic.
- Verified 2026-10-12: all of the above. Not verified: approval time for production use.

### 3.5 Amazon Logistics (`TBA...`)

- No public tracking API found. Searches returned only aggregator marketing pages (S: https://www.trackingmore.com/sv/amazon-tracking, https://carriers.aftership.com/amazon-mcf), one of which says the number may only be viewable inside Amazon's own platform. Selling Partner API tracking is for sellers/their own orders, not consumers (U, not checked).
- Our `trackUrl` deep-links to Amazon's progress tracker, which requires the user to be logged in.
- Realistic options: (1) aggregator coverage (U for TBA quality), (2) parse Amazon shipment emails ("Out for delivery", "Delivered", "Arriving today") which `detectStatus`/`detectEta` already handle, (3) deep-link only. Recommend (2) + deep-link for the prototype, and test (1) with a real TBA number on a free tier.
- Amazon robots.txt is permissive for most paths (V, fetched), but its Conditions of Use bar automated access; this is not a viable scraping target because tracking is behind login (S/inference).

## 4. Aggregators

Pricing pages conflict and change often; every figure below needs re-checking on the vendor page before purchase.

| Provider | Coverage / auto-detect | Free tier | Paid | Rate limit | Webhooks | Notes |
|---|---|---|---|---|---|---|
| **17TRACK** | "3,500+ carriers, 230+ countries"; carrier auto-detect for "80%+ of tracking numbers" (V: https://www.17track.net/en/api) | New API accounts get a one-time 200 free tracking numbers; the old monthly 100 free ended 2026-01-07 (V: https://api.17track.net/en/doc?anchor=doc-pricing) | Annual prepaid quota; one source says 5,000 for $119/yr (S: https://www.track123.com/blog/track123-vs-17track); higher tiers need sales (V) | 3 req/s; 429 on excess (V) | Yes (`TRACKING_UPDATED`) (V) | Register once (billed once per number during auto-tracking, V) then poll `gettrackinfo` or receive webhook. Max 40 numbers per request (V). Their consumer plans (free 50 shipments) are a different product (V: https://www.17track.net/en/pricing). |
| **AfterShip** | 1,000+ couriers (U); has auto-detect (U) | Pricing page blocked (403). Third-party listings: free plan ~50 shipments/mo, but API/webhooks only on Pro (~$119/mo) (S: https://www.capterra.com/p/178663/AfterShip/pricing) | Pro ~$119/mo, ~$0.08 overage (S) | Documented but not loaded (U) | Yes (U) | Likely too expensive for a prototype. |
| **EasyPost** | Standalone Tracker needs just `tracking_code`; carrier optional, auto-detected (V: https://docs.easypost.com/docs/trackers) | None for tracking (V: https://www.easypost.com/pricing says free is for labels only) | Tracking API $0.01-$0.03 per shipment, "contact sales" (V pricing page) | U | Yes (Events) (V) | Docs warn some carriers restrict tracking for third-party platforms and may need carrier credentials (V). Returns `est_delivery_date` and `tracking_details` (V). Good schema, sales-gated pricing. |
| **Shippo** | Register number + carrier name; standalone tracking works for non-Shippo labels (V: https://docs.goshippo.com/tracking/tracking) | Tracking free only for Shippo-bought labels; per-number cost otherwise, rate not found (S/V mix) | U | U | Yes; register webhook before numbers; not idempotent (V) | Carrier name required, no auto-detect found. Some carriers only allow tracking Shippo-created shipments (V). Weak fit. |
| **TrackingMore** | Large carrier list incl. Amazon Logistics (S, vendor page); auto-detect (U) | Current pricing page shows Free with 0 credits and no API; Basic tier adds API and webhooks (S: https://www.trackingmore.com/en/pricing) | Basic/Pro overage $0.04 per extra shipment (S) | 3 or 10 req/s per endpoint; 120 s wait after 429 (S: https://support.trackingmore.com/en/article/trackingmore-api-request-rate-limit-c0ye70/) | Yes | Conflicting pricing pages across locales. |
| **Ship24** | 2,500 couriers (V: https://www.ship24.com/pricing) | Free: 10 shipments/mo per one page, 3 per another, no API/webhooks on Free (V: pricing; help center S: https://help.ship24.com/en/article/ship24-pricing-and-plans-explained-425d9d/) | Pro $59/mo for 1,000 shipments, $0.05 overage, API+webhooks on Pro (V) | U | Yes, Pro (V) | Per-shipment billing, predictive-ETA add-on $9/mo (V). Cheapest API entry is $59/mo, high for a prototype. |

Other candidates (not researched, listed for the owner to consider): Parcel / Parcels app APIs, Pitney Bowes tracking, Trackcorp, Track123. Not verified.

Cross-cutting aggregator concerns: carriers' own terms may prohibit upstream resale (USPS explicitly prohibits reselling its data, V), so aggregator ETAs/status for USPS are typically scraped/licensed by the aggregator, which pushes the ToS risk onto them; read each aggregator's ToS for end-user display and data-retention rules (not read). Data quality: aggregators lag official APIs by minutes to hours for polling-based carriers and their ETA is often the carrier's own or a prediction (U; test on real numbers).

## 5. Other methods

- **Scraping public tracking pages**: Not recommended. robots.txt fetched 2026-10-12: FedEx disallows `/*?*` (query-string URLs, which is what tracking URLs use) (V); USPS robots disallows `/go/tools/track-confirm/quick-track.html` and the tool host `tools.usps.com` robots was not retrievable (V/U); UPS and DHL robots returned nothing parsable (U). Beyond robots, USPS terms prohibit datamining (V, terms link above), and tracking pages sit behind JS challenges and bot protection that break often. Legal/ToS risk plus constant maintenance for a problem free APIs solve. Do not build.
- **Parsing carrier notification emails**: Zero-cost, ToS-clean, and already in the user's mailbox: UPS/FedEx/USPS Informed Delivery/Amazon send "out for delivery"/"delivered" emails. Extend `extract.ts`/`sync.ts` to apply status-only updates (including `delivered`) when a later email mentions an already-known tracking number. Limits: only as fresh as the email, ETAs vary. Best fallback for Amazon.
- **Carrier push notification services** (UPS My Choice, USPS text tracking, FedEx Delivery Manager): these send emails to the user, feeding the method above. Requires user opt-in; mention in UI as tip.
- **Manual deep link**: keep `trackUrl`; always show it.

## 6. Comparison

| Option | Cost | Integration effort | Coverage | Reliability | ETA quality | ToS risk |
|---|---|---|---|---|---|---|
| USPS API | Free | S-M | USPS + USPS last-mile of UPS/FedEx | High | Good (expected delivery when USPS provides it, U) | Low for own-shipments display; strict no-resale |
| UPS API | Free | M | UPS `1Z` | High | Good (S) | Low-Med (terms unverified) |
| FedEx API | Free | M | FedEx | High | Good (S) | Low-Med (terms unverified); prod may need account |
| DHL API | Free, 250/day | S | DHL (varied by service) | High | Only for some services | Med: 30-day deletion, attribution, no third-party sharing |
| Amazon | None | n/a | TBA | n/a | Email text only | n/a |
| 17TRACK | ~200 free once; then prepaid annual | M | Very broad, auto-detect | Med-High (U) | Carrier's or predicted | Low-Med (read ToS) |
| TrackingMore | Paid API | M | Broad | Med (U) | U | Low-Med |
| Ship24 | $59/mo for API | M | Broad | Med (U) | Optional predictive add-on | Low-Med |
| EasyPost | Per-shipment, sales-gated | M | Good; some carriers restricted | High | est_delivery_date | Low |
| AfterShip | ~$119/mo | M | Very broad | High | Good | Low |
| Shippo | Per-number (rate unknown) | M | Needs carrier name | Med | U | Low |
| Email parsing | Free | S | Whatever emails say | Med | Low-Med | None |
| Scraping | Free | L, ongoing | Any | Low | n/a | High |

## 7. Recommendation and architecture

### 7.1 Phases

1. **Prototype (week 1-2)**: `TrackingProvider` interface, a `FakeProvider` for tests, a USPS provider, DB columns, a refresh job and a "Last checked / live" UI badge. USPS first because the user's sample is a USPS-shaped number and key-only auth is simplest. Then add UPS, FedEx, DHL providers one at a time. Add email-driven `delivered` updates for Amazon.
2. **Next**: add one aggregator provider (17TRACK first choice; test with a real TBA and PostNord number before paying), used as fallback and for unknown carriers. Add carrier auto-detect via the aggregator when the number is ambiguous.
3. **Real app**: move to webhooks (aggregator push) and a queue instead of polling; per-user quota fairness; encrypted per-tenant or central credentials; negotiate USPS/UPS/FedEx/DHL volume terms or make an aggregator primary; add data retention jobs (DHL 30 days, USPS delete on demand); monitoring and cost metering.

### 7.2 Adapter interface

```ts
type TrackingStatus = "unknown" | "shipped" | "out_for_delivery" | "delivered" | "exception";
interface TrackingEvent { at: string /*ISO*/; status?: string; description: string; location?: string }
interface TrackingResult {
  carrier: CarrierId;            // carrier whose data this is (may differ from hint)
  status: TrackingStatus;
  statusRaw: string | null;
  eta: string | null;            // YYYY-MM-DD, carrier-reported
  deliveredAt: string | null;    // ISO
  events: TrackingEvent[];
  provider: string;              // "usps" | "ups" | "17track" ...
}
type LookupOutcome =
  | { ok: true; result: TrackingResult }
  | { ok: false; reason: "not_found" | "unsupported" | "rate_limited" | "auth" | "error"; retryAfterMs?: number };
interface TrackingProvider {
  id: string;
  supports(carrier: CarrierId, trackingNumber: string): boolean;
  lookup(trackingNumber: string, carrierHint?: CarrierId): Promise<LookupOutcome>;
}
```

Never throw for expected failures; return an outcome so the router can fall through. Map provider status vocabularies to our three persisted statuses plus `exception` (needs a type change; see 7.4).

### 7.3 Routing and fallback

- Official-first: ordered list per carrier hint, e.g. hint `ups` + `1Z`: [ups, 17track]; hint `ups` + 26-digit `92`: [usps, ups, 17track]; `usps`: [usps, 17track]; `fedex`: [fedex, usps (for `96...`), 17track]; `dhl`: [dhl, 17track]; `amazon`: [17track if enabled]. Rationale: free, authoritative, and ETA/events come from the source; the aggregator costs per number.
- On `not_found` try the next provider; on `rate_limited` or `error` do not fall through to a paid provider within the same run, set `next_check_at` with back-off instead. Remember which provider succeeded (`tracking_provider`) and use it first next time.
- Aggregator-first becomes preferable at scale (single integration, webhooks, no per-carrier approvals) once the official APIs' per-account quotas bind.

### 7.4 Caching and polling cadence

- Store `last_checked_at` and `next_check_at`; the refresh job selects only rows with `next_check_at <= now`.
- Never poll `delivered` (final) or `dismissed`. Mark stale after, say, 30 days with no change and stop (check weekly or via manual refresh).
- Suggested cadence: `shipped`, age under 1 day: 60 min; older: 3 h; with ETA today or `out_for_delivery`: 30 min; with consecutive no-change results: back off up to 6 h; `not_found` (just created): 15 min, 1 h, 4 h, then daily for 5 days. Add jitter. Manual "Refresh now" bypasses cadence but is limited to once per package per 5 min.
- Per-provider limiter (token bucket) sized below the documented quota: USPS 60/h default, DHL 250/day and 1 per 5 s, 17TRACK 3 req/s, FedEx 1,400/10 s. Persist counters (DB) so restarts do not reset them. On 429, honor `Retry-After` or FedEx's "10 s / midnight GMT" rule.
- Cache OAuth tokens in memory until about 5 min before expiry; avoid FedEx token abuse limits (V above).
- Batch where supported (17TRACK up to 40 per request).

### 7.5 Secrets and failure handling

- Env vars only (`USPS_CLIENT_ID/SECRET`, `UPS_...`, `FEDEX_...`, `DHL_API_KEY`, `TRACK17_KEY`), read server-side in one `config` module; never to the client, never logged. Add `.env.example`. Provider disabled if its vars are missing so the app works without any key. In the real app: secret manager, rotation, per-environment sandbox vs production.
- Failure handling: timeout 8-10 s per call, one retry on 5xx with jitter, circuit breaker per provider (open after N failures, cool-down), store `last_error` and show "couldn't check" only when stale beyond a threshold; email-derived data remains the fallback so the dashboard never regresses.

### 7.6 Mapping onto `shipments`

Add columns (Drizzle migration):

- `tracking_provider` text null
- `last_checked_at` integer null, `next_check_at` integer null, `check_failures` integer default 0, `last_error` text null
- `carrier_status_raw` text null
- `eta_source` text null ("email" | "carrier"), keep `eta` as display value; prefer carrier ETA over email ETA once present
- `delivered_at` integer null
- `events_json` text (JSON array) null, capped to the latest ~50 events; or a separate table `shipment_events(shipment_id, at, description, location, status)` with unique (shipment_id, at, description) if the real app wants queryable history

Status rules: keep monotonic `rank` for `shipped|out_for_delivery|delivered` (do not move back), but allow an `exception` flag/column (`has_exception` boolean) rather than a fourth rank, to avoid breaking the existing `Record<ShipmentStatus, number>`.

## 8. Integration plan

### Files

- New `lib/tracking/types.ts` (interface above), `lib/tracking/providers/{usps,ups,fedex,dhl,aggregator17track}.ts`, `lib/tracking/router.ts` (ordering, fallback), `lib/tracking/limiter.ts`, `lib/tracking/cadence.ts` (next-check calculation), `lib/tracking/refresh.ts` (selects due rows, calls router, writes results), `lib/tracking/config.ts`.
- Change `lib/db/schema.ts` + migration (new columns), `lib/automations/shipments/sync.ts` (if email says `delivered`, set `delivered_at` and `next_check_at=null`; initialize `next_check_at=now` on insert; trust `eta` from carrier over email), and `carriers.ts` (add optional `lookupHints`, e.g. 26-digit `92` also tries USPS).
- New API routes: `app/api/shipments/refresh/route.ts` (POST: refresh due rows, or one by id with `?force=1`, authenticated), optionally `app/api/tracking/webhook/17track/route.ts` later (verify signature).
- UI (dashboard): show live status, ETA, "checked 4 min ago", events drawer, refresh button, fallback to `trackUrl`.

### Hooking into the 60-second poll

`useAutoSync` keeps calling the mail sync every 60 s. Separately, after each sync (server-side, fire-and-forget, guarded like `running` in `sync.ts` by a per-account in-flight lock) call `refreshDueShipments(accountId)`, which only touches rows where `next_check_at <= now`. Because cadence is minutes to hours, most 60 s ticks do zero carrier calls. Cap per tick (for example 5 lookups) and rely on limiter state. Do not make the mail poll wait on carrier calls. In the real app move this to a scheduled worker/queue.

### Tests

- Contract tests per provider using **recorded fixtures** (sanitized real responses saved under `lib/tracking/__fixtures__/`), mapped through the normalizer; include not-found, 429, expired token, and a delivered response.
- Router tests with mock providers: fallthrough on `not_found`, no fallthrough on `rate_limited`, preferred-provider memory.
- Cadence tests (pure function, table-driven) and limiter tests with a fake clock.
- `sync.ts` regression: status never moves backward; email `delivered` stops polling.
- Optional manual smoke script against real keys, never in CI.

### Task breakdown (order)

1. Types, config, `FakeProvider`, cadence + limiter (M)
2. Schema migration + sync.ts changes (S)
3. Router + refresh job + API route + hook into poll (M)
4. USPS provider + fixtures, register account (M)
5. UI: live status, last checked, events, refresh (M)
6. DHL provider (S), FedEx provider (M), UPS provider (M)
7. Email-driven delivered/status updates for Amazon (S)
8. Aggregator provider (17TRACK) + auto-detect + optional webhook (L)
9. Retention rules (DHL 30 days), metrics, circuit breaker polish (M)

## 9. Open questions and risks for the product owner

1. Accounts to register: USPS developer portal (free), UPS developer app, FedEx developer project (may need an account number for production), DHL developer app. Who owns these accounts? A personal UPS.com/FedEx account is fine for the prototype; a company account should be created before real users.
2. Budget: any appetite for an aggregator (roughly $0 to $60/mo for a prototype, more at scale)? Pricing must be re-verified on the vendor sites; several pages conflicted.
3. Is Amazon (TBA) in scope for live data, or is email-derived status acceptable?
4. Terms-of-use fit: USPS (own-shipments display only, no resale, delete on demand), DHL (30-day deletion, attribution, no third-party sharing) and UPS/FedEx (terms not read) were designed for shippers and their customers. Multi-user email client use is probably a gray area; legal review is needed before launch. Each carrier may need an explicit use-case approval or enterprise agreement.
5. Quota ceilings: USPS 60/h and DHL 250/day do not scale beyond a handful of users; require quota-increase requests or an aggregator.
6. Privacy: tracking events include addresses and names; decide retention, encryption at rest, and account deletion behavior.
7. UPS Ground Saver / PostNord / international hand-offs: which API gives full history for a given number is not verified. Plan a short spike with the real example number `92612926998410543494064502` against USPS, UPS and 17TRACK.
8. Unknowns to close first (spike, 1 day): UPS official docs and terms; USPS Tracking response fields, sandbox and exact quota; FedEx production prerequisites; 17TRACK/Ship24/TrackingMore current prices and TBA/PostNord coverage.

## 10. Verification summary

| Source | Verified 2026-10-12 | Not verified |
|---|---|---|
| USPS | FAQ default product, terms of use | Response schema, numeric quota (sources conflict), sandbox, approval time, account prerequisites |
| UPS | Ground Saver FAQ | Almost everything else (portal timed out); endpoints/auth from third-party guides |
| FedEx | Rate limits and token behavior | Response schema, production prerequisites, terms |
| DHL | API page: auth, limits, terms, coverage | Production approval time |
| Amazon | robots.txt, absence of a public API in searches | Seller/other APIs, ToS text |
| 17TRACK | API doc: free quota change, 3 req/s, endpoints, webhooks | Full price list, ToS |
| AfterShip | Nothing official (403) | Pricing, limits, coverage |
| EasyPost | Tracker docs, pricing page snippet | Rate limits, exact price |
| Shippo | Tracking docs | Per-number price |
| TrackingMore | Search snippets only | Live pricing, coverage |
| Ship24 | Pricing page (plans, prices) | API docs, rate limits |
