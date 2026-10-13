import type { Message } from "@/lib/mail/types";
import type { ShipmentStatus } from "@/lib/db/schema";
import { CARRIERS, TRACKING_LINK_HOSTS, carrierById, type CarrierId } from "./carriers";

export interface ExtractedShipment {
  trackingNumber: string;
  carrier: CarrierId;
  sender: string;
  status: ShipmentStatus;
  eta: string | null; // YYYY-MM-DD
}

// Retailer-independent: nothing here looks at who sent the message, except to
// derive a display label.
export function extractShipment(msg: Message): ExtractedShipment | null {
  const html = msg.html ?? "";
  const text = msg.text ?? htmlToText(html);
  const haystack = `${msg.subject}\n${text}`;

  const found = fromLinks(html) ?? fromLabeled(haystack) ?? fromText(haystack);
  if (!found) return null;

  return {
    trackingNumber: found.trackingNumber,
    carrier: found.carrier,
    sender: senderLabel(msg),
    status: detectStatus(`${msg.subject}\n${text}`),
    eta: detectEta(haystack, new Date(msg.date)),
  };
}

export function htmlToText(html: string): string {
  return html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ");
}

function fromLinks(html: string): { trackingNumber: string; carrier: CarrierId } | null {
  for (const m of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
    let url: URL;
    try {
      url = new URL(m[1].replace(/&amp;/g, "&"));
    } catch {
      continue;
    }
    const rule = TRACKING_LINK_HOSTS.find((r) => r.host.test(url.hostname));
    if (!rule) continue;
    for (const p of rule.params) {
      const raw = url.searchParams.get(p);
      const n = raw?.split(/[,\s]/)[0]?.toUpperCase();
      if (n && /^[A-Z0-9]{8,30}$/.test(n)) return { trackingNumber: n, carrier: rule.carrier };
    }
  }
  return null;
}

const CARRIER_NAMES: Record<string, CarrierId> = {
  ups: "ups",
  usps: "usps",
  fedex: "fedex",
  dhl: "dhl",
  amazon: "amazon",
};

// "UPS tracking number: 9261..." — the email itself says which shipper to trust,
// even when the number's shape suggests another carrier (e.g. UPS Mail Innovations).
function fromLabeled(text: string): { trackingNumber: string; carrier: CarrierId } | null {
  const re =
    /\b(ups|usps|fedex|dhl|amazon)\b[^\n:#]{0,30}?\b(?:tracking|track)\b\s*(?:number|no\.?|#|id|code)?\s*[:#\-]?\s*([A-Z0-9]{10,35})\b/gi;
  for (const m of text.matchAll(re)) {
    const n = m[2].toUpperCase();
    if ((n.match(/\d/g)?.length ?? 0) < 8) continue; // "information", "details", ...
    const carrier = CARRIER_NAMES[m[1].toLowerCase()];
    if (carrier === "ups" && n.startsWith("1Z") && n.length === 18 && !carrierById("ups").validate!(n)) continue;
    return { trackingNumber: n, carrier };
  }
  return null;
}

function fromText(text: string): { trackingNumber: string; carrier: CarrierId } | null {
  const upper = text.toUpperCase();
  for (const c of CARRIERS) {
    for (const m of upper.matchAll(c.pattern)) {
      const n = m[0];
      if (c.validate && !c.validate(n)) continue;
      // Bare digit runs are ambiguous (order numbers, phone numbers): require
      // the carrier to be named near the number.
      if (c.id === "fedex" && !nameNear(upper, m.index!, "FEDEX")) continue;
      return { trackingNumber: n, carrier: c.id };
    }
  }
  return null;
}

const nameNear = (upper: string, at: number, name: string) =>
  upper.slice(Math.max(0, at - 200), at + 200).includes(name);

export function detectStatus(text: string): ShipmentStatus {
  const t = text.toLowerCase();
  if (/\b(has been delivered|was delivered|delivered to|package delivered|delivery complete)\b/.test(t))
    return "delivered";
  if (/\bout for delivery\b|\barriving today\b|\bdelivery today\b/.test(t)) return "out_for_delivery";
  return "shipped";
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const ETA_CUE =
  /(estimated delivery|estimated arrival|expected delivery|expected by|expected on|delivery date|delivery estimate|arriving|arrives|scheduled delivery|deliver(?:y|ed)? by|get it by)[^\n]{0,60}/gi;

export function detectEta(text: string, sent: Date): string | null {
  for (const cue of text.matchAll(ETA_CUE)) {
    const d = parseDate(cue[0], sent);
    if (d) return d;
  }
  return null;
}

function parseDate(s: string, sent: Date): string | null {
  const iso = (y: number, m: number, d: number) => {
    // roll to next year if the date lands well before the email date (e.g. Jan ETA in a Dec email)
    let date = new Date(Date.UTC(y, m, d));
    if (date.getTime() < sent.getTime() - 60 * 864e5) date = new Date(Date.UTC(y + 1, m, d));
    return date.toISOString().slice(0, 10);
  };
  const y = sent.getUTCFullYear();

  let m = s.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/);
  if (m) return iso(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[1] - 1, +m[2]);
  m = s.match(/\b(\d{1,2})\/(\d{1,2})\b/);
  if (m && +m[1] <= 12 && +m[2] <= 31) return iso(y, +m[1] - 1, +m[2]);

  m = s.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?/i);
  if (m) return iso(m[3] ? +m[3] : y, MONTHS.indexOf(m[1].toLowerCase()), +m[2]);
  m = s.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/i);
  if (m) return iso(y, MONTHS.indexOf(m[2].toLowerCase()), +m[1]);
  return null;
}

// "Asmodee <no-reply@asmodee.com>" -> "Asmodee". Display label only.
const NOISE = new Set(["customer", "service", "support", "order", "orders", "shipping", "notification", "notifications", "noreply", "no-reply", "team", "na"]);

export function senderLabel(msg: Message): string {
  const words = msg.from.name.split(/\s+/).filter(Boolean);
  const kept = words.filter((w) => !NOISE.has(w.toLowerCase()));
  const name = (kept.length ? kept : words).join(" ").trim();
  if (name) return name;
  const domain = msg.from.email.split("@")[1]?.split(".").slice(-2, -1)[0] ?? msg.from.email;
  return domain.charAt(0).toUpperCase() + domain.slice(1);
}

export { carrierById };
