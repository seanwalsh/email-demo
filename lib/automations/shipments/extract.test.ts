import { describe, expect, it } from "vitest";
import type { Message } from "@/lib/mail/types";
import { extractShipment } from "./extract";

const msg = (o: Partial<Message> & { from?: Message["from"] }): Message => ({
  id: "m1",
  threadId: "t1",
  from: { name: "Shop", email: "shop@example.com" },
  to: [],
  cc: [],
  date: Date.UTC(2026, 9, 12),
  subject: "",
  html: null,
  text: null,
  attachments: [],
  labelIds: [],
  ...o,
});

describe("extractShipment (carrier-keyed, retailer-independent)", () => {
  it("UPS number in plain text, board-game retailer", () => {
    const r = extractShipment(
      msg({
        from: { name: "Asmodee", email: "no-reply@asmodee.com" },
        subject: "Your order has shipped",
        text: "Shipped via UPS. Tracking number: 1Z742W400390007009\nEstimated delivery: Wed, Oct 14",
      }),
    )!;
    expect(r).toMatchObject({
      trackingNumber: "1Z742W400390007009",
      carrier: "ups",
      sender: "Asmodee",
      status: "shipped",
      eta: "2026-10-14",
    });
  });

  it("same extraction for an unrelated retailer", () => {
    const r = extractShipment(
      msg({
        from: { name: "Acme Outfitters Customer Service", email: "orders@acme.test" },
        subject: "Shipment notification",
        text: "Your package is on its way! UPS tracking: 1Z999AA10123456784. Arriving 10/16",
      }),
    )!;
    expect(r).toMatchObject({ carrier: "ups", sender: "Acme Outfitters", eta: "2026-10-16" });
  });

  it("prefers tracking numbers from carrier links in HTML", () => {
    const r = extractShipment(
      msg({
        html: `<p>Track it</p><a href="https://www.fedex.com/fedextrack/?trknbr=123456789012&amp;x=1">Track</a>`,
        subject: "Shipped",
      }),
    )!;
    expect(r).toMatchObject({ carrier: "fedex", trackingNumber: "123456789012" });
  });

  it("detects USPS IMpb numbers", () => {
    const r = extractShipment(msg({ text: "USPS tracking 9400111899223397623910 delivered to your mailbox. Package was delivered" }))!;
    expect(r).toMatchObject({ carrier: "usps", status: "delivered" });
  });

  it("detects out for delivery", () => {
    const r = extractShipment(msg({ subject: "Out for delivery", text: "1Z742W400390007009 is out for delivery today" }))!;
    expect(r.status).toBe("out_for_delivery");
  });

  it("ignores bare 12-digit numbers without a FedEx context", () => {
    expect(extractShipment(msg({ text: "Order number 123456789012. Thanks for shopping!" }))).toBeNull();
  });

  it("accepts 12-digit numbers when FedEx is named nearby", () => {
    expect(extractShipment(msg({ text: "FedEx tracking number 123456789012" }))?.carrier).toBe("fedex");
  });

  it("rejects UPS-shaped strings that fail the checksum", () => {
    expect(extractShipment(msg({ text: "ref 1Z742W400390007000" }))).toBeNull();
  });

  it("trusts the carrier the email names for a 26-digit labeled number (UPS Mail Innovations)", () => {
    const r = extractShipment(
      msg({
        from: { name: "DFTBA", email: "hello@dftba.com" },
        subject: "Your DFTBA order #1409960 has shipped!",
        text: "Order #1409960\nYour order is on the way!\n\nUPS tracking number: 92612926998410543494064502\n\nShipping method\nStandard Flat Rate Shipping (7-10 Business Days)",
      }),
    )!;
    expect(r).toMatchObject({ carrier: "ups", trackingNumber: "92612926998410543494064502", sender: "DFTBA", status: "shipped", eta: null });
  });

  it("does not treat 'UPS tracking information' as a number", () => {
    expect(extractShipment(msg({ text: "See your UPS tracking information below." }))).toBeNull();
  });

  it("returns null for ordinary mail", () => {
    expect(extractShipment(msg({ subject: "Lunch?", text: "Want to grab lunch Thursday?" }))).toBeNull();
  });

  it("leaves ETA null when none is stated", () => {
    expect(extractShipment(msg({ text: "UPS 1Z742W400390007009 has shipped." }))?.eta).toBeNull();
  });
});

describe("sender label", () => {
  it("strips whole noise words only", () => {
    const from = (name: string) => extractShipment(msg({ from: { name, email: "x@y.test" }, text: "UPS 1Z742W400390007009" }))!.sender;
    expect(from("Asmodee NA")).toBe("Asmodee");
    expect(from("Banana Republic")).toBe("Banana Republic");
    expect(from("Orders")).toBe("Orders");
  });
});
