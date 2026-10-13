export type CarrierId = "ups" | "usps" | "fedex" | "dhl" | "amazon";

export interface Carrier {
  id: CarrierId;
  name: string;
  // Global regex (with word boundaries) that finds candidates in free text.
  pattern: RegExp;
  validate?: (n: string) => boolean;
  trackUrl: (n: string) => string;
}

// UPS: "1Z" + 15 chars + check digit. Letters map to (code - 63) % 10.
function upsChecksum(n: string): boolean {
  const val = (c: string) => (/\d/.test(c) ? Number(c) : (c.charCodeAt(0) - 63) % 10);
  let sum = 0;
  [...n.slice(2, 17)].forEach((c, i) => (sum += i % 2 ? 2 * val(c) : val(c)));
  const check = sum % 10 === 0 ? 0 : 10 - (sum % 10);
  return check === Number(n[17]);
}

export const CARRIERS: Carrier[] = [
  {
    id: "ups",
    name: "UPS",
    pattern: /\b1Z[0-9A-Z]{16}\b/g,
    validate: upsChecksum,
    trackUrl: (n) => `https://www.ups.com/track?tracknum=${n}`,
  },
  {
    id: "amazon",
    name: "Amazon Logistics",
    pattern: /\bTBA\d{9,15}\b/g,
    trackUrl: (n) => `https://www.amazon.com/progress-tracker/package/ref=ppx_yo_dt_b_track_package?_encoding=UTF8&trackingId=${n}`,
  },
  {
    id: "usps",
    name: "USPS",
    // 20-26 digit IMpb/GS1 numbers starting 9[1-5]..., or 13-char international (XX#########US)
    pattern: /\b(?:9[1-5]\d{18,24}|[A-Z]{2}\d{9}US)\b/g,
    trackUrl: (n) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}`,
  },
  {
    id: "dhl",
    name: "DHL",
    pattern: /\b(?:JD\d{18}|JJD\d{15,18})\b/g,
    trackUrl: (n) => `https://www.dhl.com/global-en/home/tracking/tracking-express.html?submit=1&tracking-id=${n}`,
  },
  {
    id: "fedex",
    name: "FedEx",
    // Bare 12/15-digit numbers are ambiguous; they are only accepted in a
    // FedEx context (see extract.ts). 96xxxxxxxxxxxxxxxxxxxx (22) is SmartPost-style.
    pattern: /\b(?:96\d{20}|\d{15}|\d{12})\b/g,
    trackUrl: (n) => `https://www.fedex.com/fedextrack/?trknbr=${n}`,
  },
];

export const carrierById = (id: CarrierId) => CARRIERS.find((c) => c.id === id)!;

// Hosts whose tracking-link query params carry a tracking number: the most
// reliable signal, because the retailer put it there deliberately.
export const TRACKING_LINK_HOSTS: { host: RegExp; carrier: CarrierId; params: string[] }[] = [
  { host: /(^|\.)ups\.com$/, carrier: "ups", params: ["tracknum", "InquiryNumber1", "trackNums", "tracknums_displayed"] },
  { host: /(^|\.)fedex\.com$/, carrier: "fedex", params: ["trknbr", "tracknumbers", "trackingnumber"] },
  { host: /(^|\.)usps\.com$/, carrier: "usps", params: ["tLabels", "tLc", "trackingNumber"] },
  { host: /(^|\.)dhl\.com$/, carrier: "dhl", params: ["tracking-id", "trackingNumber", "AWB"] },
  { host: /(^|\.)amazon\.com$/, carrier: "amazon", params: ["trackingId"] },
];
