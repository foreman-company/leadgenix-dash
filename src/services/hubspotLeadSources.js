// HubSpot lead-source connector.
//
// Built against the published HubSpot CRM v3 Contacts API docs
// (developers.hubspot.com/docs/api/crm/contacts):
//   GET /crm/v3/objects/contacts
//     - `properties` query param: comma-separated list of properties to return
//     - `limit`: up to 100 results per page
//     - `after`: cursor from the previous page's `paging.next.after`
//     - response: { results: [{ id, properties: { ... } }], paging: { next: { after, link } } }
//   Requires a private-app token with the `crm.objects.contacts.read` scope.
//
// Contacts carry their original traffic source in the `hs_analytics_source`
// property, so the breakdown aggregates contacts by that value.

export const HUBSPOT_CONTACTS_URL = "https://api.hubspot.com/crm/v3/objects/contacts";

// Vite only exposes env vars with the VITE_ prefix to client code
// (see vite.config.js — no envPrefix override), and a private-app token must
// never be baked into a public bundle. Production deployments should proxy
// HubSpot calls through their backend; VITE_HUBSPOT_API_TOKEN exists for
// local/preview use against a sandbox portal.
export const HUBSPOT_TOKEN_ENV_VAR = "VITE_HUBSPOT_API_TOKEN";
export const LEAD_SOURCE_PROPERTY = "hs_analytics_source";

const PAGE_LIMIT = 100;

export const FALLBACK_LEAD_SOURCES = [
  { source: "Organic Search", count: 184 },
  { source: "Paid Search", count: 97 },
  { source: "Referrals", count: 63 },
  { source: "Email Marketing", count: 41 },
  { source: "Social Media", count: 28 },
  { source: "Direct Traffic", count: 15 },
];

const KNOWN_SOURCES = new Set(FALLBACK_LEAD_SOURCES.map((s) => s.source));

export function getHubspotToken() {
  // Browser-safe: never reference `process` in Vite client code (it is a
  // Node global and throws "process is not defined" in the browser).
  // Vite statically replaces `import.meta.env.VITE_HUBSPOT_API_TOKEN` from
  // the env vars Studio injects; the `|| {}` fallback keeps the property
  // access safe in non-Vite runtimes (like node --test).
  const env = import.meta.env || {};
  const token = env[HUBSPOT_TOKEN_ENV_VAR];
  return typeof token === "string" && token.length > 0 ? token : null;
}

// HubSpot returns enumerated snake_case values for `hs_analytics_source`
// (e.g. PAID_SEARCH, DIRECT_TRAFFIC). Map the known enums to the same
// title-case labels used by the widget, its legend and the demo dataset.
const SOURCE_LABELS = {
  ORGANIC_SEARCH: "Organic Search",
  PAID_SEARCH: "Paid Search",
  REFERRALS: "Referrals",
  EMAIL_MARKETING: "Email Marketing",
  SOCIAL_MEDIA: "Social Media",
  DIRECT_TRAFFIC: "Direct Traffic",
};

/** Normalize a raw HubSpot source value into a display label. */
export function normalizeSource(rawSource) {
  const value = typeof rawSource === "string" ? rawSource.trim() : "";
  if (!value) return "Unknown";
  if (KNOWN_SOURCES.has(value)) return value;
  if (SOURCE_LABELS[value]) return SOURCE_LABELS[value];
  // Unrecognized enum-style values (ALL_CAPS_SNAKE, e.g. PAID_SOCIAL) become
  // Title Case words; mixed-case custom values are kept verbatim.
  const base = value === value.toUpperCase() ? value.toLowerCase() : value;
  const prettified = base
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
  return prettified.length > 0 ? prettified : "Unknown";
}

function contactProperties(contact) {
  if (!contact || typeof contact !== "object") return null;
  if (contact.properties && typeof contact.properties === "object") {
    return contact.properties;
  }
  return contact;
}

/**
 * Map HubSpot contacts (each carrying the `hs_analytics_source` property)
 * into lead-source data: [{ source, count }] sorted by count desc.
 */
export function mapContactsToLeadSources(contacts) {
  if (!Array.isArray(contacts)) return [];
  const counts = new Map();
  for (const contact of contacts) {
    const props = contactProperties(contact);
    const raw = props ? props[LEAD_SOURCE_PROPERTY] : undefined;
    const label = normalizeSource(raw);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count || a.source.localeCompare(b.source));
}

/**
 * Pull every page of contacts from HubSpot and return the aggregated
 * lead-source breakdown. Errors are thrown so callers can surface them;
 * when no token is configured the connector returns a clearly-labeled
 * demo dataset instead, so the widget stays operable during development.
 *
 * Options:
 *   fetchImpl — fetch-like function (tests inject pages here)
 *   token     — explicit HubSpot private-app token; overrides env lookup
 */
export async function fetchLeadSources({
  fetchImpl = globalThis.fetch,
  token,
} = {}) {
  const resolvedToken = token ?? getHubspotToken();
  if (!resolvedToken) {
    return {
      sources: [...FALLBACK_LEAD_SOURCES],
      origin: "demo",
      lastUpdated: new Date(),
    };
  }
  if (typeof fetchImpl !== "function") {
    throw new Error("fetchLeadSources requires a fetch implementation");
  }

  const contacts = [];
  let after;
  do {
    const url = new URL(HUBSPOT_CONTACTS_URL);
    url.searchParams.set("properties", LEAD_SOURCE_PROPERTY);
    url.searchParams.set("limit", String(PAGE_LIMIT));
    if (after) url.searchParams.set("after", after);

    const response = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${resolvedToken}` },
    });
    if (!response.ok) {
      throw new Error(`HubSpot request failed with status ${response.status}`);
    }
    const payload = await response.json();
    if (Array.isArray(payload?.results)) contacts.push(...payload.results);
    after = payload?.paging?.next?.after;
  } while (after);

  return {
    sources: mapContactsToLeadSources(contacts),
    origin: "hubspot",
    lastUpdated: new Date(),
  };
}
