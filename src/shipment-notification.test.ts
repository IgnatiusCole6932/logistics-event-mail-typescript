import test from "node:test";
import assert from "node:assert/strict";
import { buildShipmentEmail } from "./shipment-notification.js";

test("an exception notice makes the delivery decision visible in the subject", () => {
  const email = buildShipmentEmail({
    shipmentId: "SHP-7",
    recipient: "ops@example.com",
    carrier: "Northline",
    trackingNumber: "NL-7",
    proofOfDelivery: { name: "pod.pdf", mediaType: "application/pdf" },
    exception: "recipient unavailable",
  });
  assert.equal(email.subject, "Delivery exception for SHP-7");
  assert.match(email.html, /recipient unavailable/);
});
