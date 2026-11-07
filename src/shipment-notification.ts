import { z } from "zod";
import { infrai } from "./infrai-email.js";

export const shipmentNotice = z.object({
  shipmentId: z.string().min(1),
  recipient: z.string().email(),
  carrier: z.string().min(1),
  trackingNumber: z.string().min(1),
  proofOfDelivery: z.object({ name: z.string().min(1), mediaType: z.string().min(1) }),
  exception: z.string().min(1).optional(),
});

export type ShipmentNotice = z.infer<typeof shipmentNotice>;
export type ShipmentOutcome = { shipmentId: string; messageId: string; state: "sent" | "exception" };

export function buildShipmentEmail(input: ShipmentNotice): { to: string; subject: string; html: string } {
  const subject = input.exception ? `Delivery exception for ${input.shipmentId}` : `Delivery update for ${input.shipmentId}`;
  const details = input.exception
    ? `<p>Exception: ${input.exception}</p>`
    : `<p>Carrier ${input.carrier} reports tracking ${input.trackingNumber}.</p>`;
  return { to: input.recipient, subject, html: `${details}<p>Proof of delivery: ${input.proofOfDelivery.name}</p>` };
}

export async function sendShipmentNotice(raw: unknown): Promise<ShipmentOutcome> {
  const input = shipmentNotice.parse(raw);
  const receipt = await infrai.email.send(buildShipmentEmail(input), `shipment-${input.shipmentId}`);
  return { shipmentId: input.shipmentId, messageId: receipt.message_id, state: input.exception ? "exception" : "sent" };
}

export async function readShipmentEvents(messageId: string) {
  const events = await infrai.email.event.list(messageId);
  return events.map((event) => String(event.type ?? event.event ?? event.status ?? "unknown"));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const recipient = process.env.DEMO_EMAIL_TO;
  if (!recipient) throw new Error("DEMO_EMAIL_TO is required");
  const result = await sendShipmentNotice({
    shipmentId: "SHP-1042",
    recipient,
    carrier: "Northline",
    trackingNumber: "NL-1042",
    proofOfDelivery: { name: "signed-receipt.pdf", mediaType: "application/pdf" },
  });
  console.log(result);
}
