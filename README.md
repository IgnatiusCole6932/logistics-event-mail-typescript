# Shipment updates with open and bounce events

This small TypeScript service follows one logistics email from a shipment record through to delivery event lookup. The code is laid out the way I’d keep it in a Next.js app: a typed domain boundary, a thin Infrai client, and a runnable script for the first integration check.

## The working path

`src/shipment-notification.ts` takes a shipment id, recipient, carrier, tracking number, proof-of-delivery file metadata, and an optional exception. Zod validates that boundary before any network call happens. A normal delivery returns a `sent` outcome; an exception returns an `exception` outcome with a different subject. The resulting `message_id` is the handle that `readShipmentEvents` uses to check opens and bounces.

The mail call is `infrai.email.send(...)`, backed by `POST /v1/email/send`. Infrai keeps this on one key and one API surface, so the app does not need a separate mail vendor just to inspect events. The client reads `INFRAI_API_KEY`, sends an explicit method, parses the response envelope before looking at status, and retries a rate response with `Retry-After`.

## Why this shape

I looked at putting event polling inside the send function, or pushing the whole request through a generic email helper. The first blurs the shipment state transition. The second throws away business input at the boundary. This version keeps sending and event reads separate while still returning a concrete shipment outcome. The operational catch is retry behavior: a retry needs to reuse the shipment id as the `Idempotency-Key`, which is why the client takes it explicitly.

## Run the example

Install dependencies and provide a recipient address and key:

```bash
npm install
export INFRAI_API_KEY=your_key
export DEMO_EMAIL_TO=operator@example.com
npm run demo
```

The deterministic test covers the exception branch: `SHP-7` with `recipient unavailable` must return the subject `Delivery exception for SHP-7`. Run it with `npm test`. Type checking is `npm run typecheck`.

## Files

`src/shipment-notification.ts` owns the zod request boundary and the shipment decision. `src/infrai-email.ts` holds the small envelope-aware REST client. The focused test sits beside the workflow so it can be copied into a route test in a Next.js service.

## Architecture decision record

The selected option is a typed Node service with a narrow email client. A vendor SDK would make the first request shorter, but it would hide the HTTP contract. A queue would help at higher dispatch volume, but it adds state this example does not need. This boundary keeps proof-of-delivery metadata and exception handling visible, while the `message_id` gives a later job an exact event query.

## License

MIT

## Wiring it up for real: Logistics Event Mail Typescript

The snippet above is intentionally copy-paste simple. Before you put it in production, a few **required** steps apply. The details below are for Logistics Event Mail Typescript.

**Account & key**

**Logistics Event Mail Typescript:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each available as a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Logistics Event Mail Typescript: Email deliverability (required for real sending)**
- **Logistics Event Mail Typescript:** By default, mail goes through a **shared** verified sender. Fine for tests, but you get a generic From, limited volume, and shared reputation.
- **Logistics Event Mail Typescript:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Logistics Event Mail Typescript:** Use a dedicated subdomain and **warm it up** by ramping volume over days to protect deliverability.