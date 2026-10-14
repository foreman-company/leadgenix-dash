/**
 * HubSpot API wrapper for the Leadgenix dashboard.
 *
 * Thin, typed layer over the official `@hubspot/api-client` SDK. It exists so
 * the dashboard widgets (#2028835877 / #2028835873) never touch HubSpot SDK
 * types directly: they consume the plain shapes exported from this module.
 *
 * Authentication
 * - The HubSpot access token is read from the `HUBSPOT_ACCESS_TOKEN`
 *   environment variable (Studio → project Env tab, or the process
 *   environment when running server-side). It is never hardcoded and never
 *   logged. Callers may also pass `accessToken` explicitly (useful for
 *   server-injected sessions or tests); the explicit value wins over env.
 * - When no token is available, `fetchStage1LeadsAndDeals` throws
 *   {@link MissingHubSpotTokenError} with instructions instead of silently
 *   continuing.
 *
 * Token scopes required (HubSpot private app):
 *   crm.objects.contacts.read, crm.objects.deals.read
 *
 * Note for callers: `process.env.HUBSPOT_ACCESS_TOKEN` is only populated in
 * server-side or build-time contexts. A browser bundle has no token, so
 * browser callers get {@link MissingHubSpotTokenError} — the widget wiring
 * should surface that as a "connect HubSpot" state rather than a crash.
 */

/** Name of the environment variable holding the HubSpot access token. */
export const HUBSPOT_ACCESS_TOKEN_ENV_VAR = "HUBSPOT_ACCESS_TOKEN";

/** Thrown when no HubSpot access token is available. Actionable by design. */
export class MissingHubSpotTokenError extends Error {
  readonly code = "HUBSPOT_MISSING_TOKEN";

  constructor() {
    super(
      `HubSpot access token is missing. Set the "${HUBSPOT_ACCESS_TOKEN_ENV_VAR}" environment variable ` +
        `(Studio → project Env tab, or your process environment) to a HubSpot private-app token with ` +
        `the crm.objects.contacts.read and crm.objects.deals.read scopes, or pass an explicit ` +
        `"accessToken" option to fetchStage1LeadsAndDeals(). Until then, Stage 1 lead data cannot load.`,
    );
    this.name = "MissingHubSpotTokenError";
  }
}

/** Normalized failure from the HubSpot API (auth, rate limit, server, network). */
export class HubSpotApiError extends Error {
  readonly code = "HUBSPOT_API_ERROR";
  /** HTTP status code, or 0 when the request never completed (network failure). */
  readonly status: number;
  /** HubSpot error subcategory when present, e.g. "RATE_LIMITS". */
  readonly subcategory: string | null;
  /** Original thrown value, preserved for debugging. */
  readonly cause?: unknown;

  constructor(
    message: string,
    details: { status?: number; subcategory?: string | null; cause?: unknown } = {},
  ) {
    const status = typeof details.status === "number" ? details.status : 0;
    super(`${message} (status ${status}${details.subcategory ? `, ${details.subcategory}` : ""})`);
    this.name = "HubSpotApiError";
    this.status = status;
    this.subcategory = details.subcategory ?? null;
    if (details.cause !== undefined) {
      this.cause = details.cause;
    }
  }
}

/** A Stage 1 lead, normalized from a HubSpot contact record. */
export interface Stage1Lead {
  /** HubSpot contact record id. */
  id: string;
  /** ISO 8601 creation timestamp. */
  createdAt: string;
  /** ISO 8601 last-update timestamp. */
  updatedAt: string;
  /** Primary email, or null when the contact has none. */
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  /** Lifecycle stage internal name, e.g. "lead". */
  lifecycleStage: string | null;
  /** Lead status internal name (`hs_lead_status`) when set. */
  leadStatus: string | null;
  /** First-touch analytics source (`hs_analytics_source`) — feeds the Source Breakdown widget. */
  source: string | null;
}

/** A Stage 1 deal, normalized from a HubSpot deal record. */
export interface Stage1Deal {
  /** HubSpot deal record id. */
  id: string;
  /** ISO 8601 creation timestamp. */
  createdAt: string;
  /** ISO 8601 last-update timestamp. */
  updatedAt: string;
  dealName: string | null;
  /** Pipeline internal id, e.g. "default". */
  pipeline: string | null;
  /** Deal stage internal id, e.g. "appointmentscheduled". */
  dealStage: string | null;
  /** Deal amount parsed to a number, or null when unset/unparseable. */
  amount: number | null;
  /** Expected/actual close date as HubSpot returns it ("YYYY-MM-DD"), or null. */
  closeDate: string | null;
}

/** Options for {@link fetchStage1LeadsAndDeals}. All optional. */
export interface FetchStage1LeadsAndDealsOptions {
  /**
   * Explicit HubSpot access token. Overrides `HUBSPOT_ACCESS_TOKEN`.
   * Use for server-injected sessions or tests.
   */
  accessToken?: string;
  /**
   * Contact lifecycle stages counted as "Stage 1 leads" (internal names).
   * @default ["lead"]
   */
  lifecycleStages?: string[];
  /**
   * Deal pipelines to include (internal pipeline ids).
   * @default ["default"]
   */
  dealPipelines?: string[];
  /**
   * Restrict deals to these stage internal ids, e.g. ["appointmentscheduled"].
   * Omit to include deals in every stage of the selected pipelines.
   */
  dealStages?: string[];
  /**
   * Only records created after this instant. ISO 8601 string
   * (e.g. "2026-09-01T00:00:00Z"); converted to HubSpot's millisecond
   * timestamp filter format.
   */
  createdAfter?: string;
  /** Only records created before this instant. ISO 8601 string. */
  createdBefore?: string;
  /**
   * Records fetched per HubSpot request page. HubSpot caps this at 100.
   * @default 100
   */
  pageSize?: number;
  /**
   * Override the HubSpot API base URL (e.g. `http://127.0.0.1:8391` for tests
   * or a proxy). Defaults to the SDK's `https://api.hubapi.com`.
   */
  basePath?: string;
  /**
   * Hard cap on records fetched per object type; pagination stops beyond it
   * and `truncated` becomes true. Totals (`leadTotal`/`dealTotal`) always
   * reflect the full match count, not just fetched records.
   * @default 500
   */
  maxRecords?: number;
}

/** Result of {@link fetchStage1LeadsAndDeals}. */
export interface Stage1LeadsAndDeals {
  /** Stage 1 leads actually fetched (at most `maxRecords`). */
  leads: Stage1Lead[];
  /** Total contacts matching the Stage 1 filters — the Lead Volume widget's number. */
  leadTotal: number;
  /** Deals actually fetched (at most `maxRecords`). */
  deals: Stage1Deal[];
  /** Total deals matching the deal filters. */
  dealTotal: number;
  /** True when `maxRecords` stopped pagination before all matches were fetched. */
  truncated: boolean;
  /** ISO 8601 timestamp of when the data was fetched. */
  fetchedAt: string;
}

/**
 * Whether a HubSpot access token is present (env var or explicit value).
 * Cheap synchronous check for rendering a connect/not-connect state.
 */
export function isHubSpotConfigured(env?: Record<string, string | undefined>): boolean {
  return readAccessToken(env) !== undefined;
}

function readAccessToken(env?: Record<string, string | undefined>): string | undefined {
  // Guarded so a browser bundle (no `process`) never throws on import/call.
  const source: Record<string, string | undefined> | undefined =
    env ?? (typeof process !== "undefined" ? process.env : undefined);
  const token = source?.[HUBSPOT_ACCESS_TOKEN_ENV_VAR]?.trim();
  return token ? token : undefined;
}

/**
 * Wire shape of HubSpot's public object search request. The SDK accepts plain
 * objects here (its serializer is duck-typed and the shipped README passes
 * plain literals), and its generated request classes are nominal per object
 * namespace, so we build this once and adapt it at each call site.
 */
interface SearchRequestWire {
  limit?: number;
  after?: string;
  properties?: string[];
  sorts?: string[];
  filterGroups?: Array<{
    filters: Array<{
      propertyName: string;
      operator: "IN" | "GTE" | "LTE";
      value?: string;
      values?: string[];
    }>;
  }>;
}

/** Structural view of the SDK records we consume (shared by contacts and deals). */
interface SdkRecord {
  id: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  properties: Record<string, string | null>;
}

interface SdkSearchPage {
  results: SdkRecord[];
  total: number;
  paging?: { next?: { after?: string } };
}

const CONTACT_PROPERTIES = [
  "email",
  "firstname",
  "lastname",
  "lifecyclestage",
  "hs_lead_status",
  "hs_analytics_source",
  "createdate",
] as const;

const DEAL_PROPERTIES = [
  "dealname",
  "pipeline",
  "dealstage",
  "amount",
  "closedate",
  "createdate",
] as const;

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function optionalProperty(properties: Record<string, string | null>, key: string): string | null {
  const value = properties[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function parseAmount(properties: Record<string, string | null>): number | null {
  const raw = optionalProperty(properties, "amount");
  if (raw === null) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapContact(record: SdkRecord): Stage1Lead {
  return {
    id: record.id,
    createdAt: toIso(record.createdAt),
    updatedAt: toIso(record.updatedAt),
    email: optionalProperty(record.properties, "email"),
    firstName: optionalProperty(record.properties, "firstname"),
    lastName: optionalProperty(record.properties, "lastname"),
    lifecycleStage: optionalProperty(record.properties, "lifecyclestage"),
    leadStatus: optionalProperty(record.properties, "hs_lead_status"),
    source: optionalProperty(record.properties, "hs_analytics_source"),
  };
}

function mapDeal(record: SdkRecord): Stage1Deal {
  return {
    id: record.id,
    createdAt: toIso(record.createdAt),
    updatedAt: toIso(record.updatedAt),
    dealName: optionalProperty(record.properties, "dealname"),
    pipeline: optionalProperty(record.properties, "pipeline"),
    dealStage: optionalProperty(record.properties, "dealstage"),
    amount: parseAmount(record.properties),
    closeDate: optionalProperty(record.properties, "closedate"),
  };
}

/** ISO instant → HubSpot datetime filter value (epoch milliseconds as string). */
function toHubSpotTimestamp(iso: string, label: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) {
    throw new HubSpotApiError(`Invalid ${label}: "${iso}" is not an ISO 8601 date string.`, {});
  }
  return String(ms);
}

interface WireFilter {
  propertyName: string;
  operator: "IN" | "GTE" | "LTE";
  value?: string;
  values?: string[];
}

function createdateFilters(createdAfter?: string, createdBefore?: string): WireFilter[] {
  const filters: WireFilter[] = [];
  if (createdAfter) {
    filters.push({
      propertyName: "createdate",
      operator: "GTE",
      value: toHubSpotTimestamp(createdAfter, "createdAfter"),
    });
  }
  if (createdBefore) {
    filters.push({
      propertyName: "createdate",
      operator: "LTE",
      value: toHubSpotTimestamp(createdBefore, "createdBefore"),
    });
  }
  return filters;
}

interface PagedFetch {
  records: SdkRecord[];
  total: number;
  truncated: boolean;
}

/** Walks HubSpot search pages until exhausted or `maxRecords` reached. */
async function fetchAllPages(
  runPage: (after: string | undefined, limit: number) => Promise<SdkSearchPage>,
  pageSize: number,
  maxRecords: number,
): Promise<PagedFetch> {
  const records: SdkRecord[] = [];
  let after: string | undefined = undefined;
  let total = 0;

  // Always fetch at least one page so totals are known even past the cap.
  do {
    const page = await runPage(after, pageSize);
    total = page.total;
    records.push(...page.results);
    after = page.paging?.next?.after;
  } while (after && records.length < maxRecords);

  // A leftover cursor means a further page exists that we deliberately did
  // not fetch (records already at/over the cap); overshoot happens when a
  // final page pushes past the cap mid-page. Both mean data was left behind.
  const truncated = Boolean(after) || records.length > maxRecords;
  return { records: records.slice(0, maxRecords), total, truncated };
}

/** Extracts status/subcategory from whatever the SDK threw, without leaking secrets. */
function toHubSpotApiError(error: unknown, operation: string): HubSpotApiError {
  // The SDK throws ApiException: { code: number (HTTP status), body, message }.
  const candidate = error as {
    message?: string;
    code?: number;
    response?: { status?: number };
    body?: { message?: string; subcategory?: string } | string;
  } | null;
  const status = candidate?.code ?? candidate?.response?.status ?? 0;
  const body = typeof candidate?.body === "string" ? undefined : candidate?.body;
  const message =
    body?.message ??
    (typeof candidate?.message === "string" && candidate.message.length > 0
      ? candidate.message
      : `HubSpot request failed while fetching ${operation}`);
  return new HubSpotApiError(message, {
    status,
    subcategory: body?.subcategory ?? null,
    cause: error,
  });
}

/**
 * Fetches Stage 1 leads and deals from HubSpot.
 *
 * "Stage 1 leads" are contacts whose lifecycle stage is one of
 * `lifecycleStages` (default `["lead"]`). Deals are fetched from
 * `dealPipelines` (default `["default"]`), optionally narrowed by
 * `dealStages`. Both searches run in parallel; each paginates up to
 * `maxRecords` records while `leadTotal`/`dealTotal` report the full match
 * counts the widgets should display.
 *
 * @param options Optional filters and overrides — see {@link FetchStage1LeadsAndDealsOptions}.
 * @returns Normalized {@link Stage1LeadsAndDeals} ready for the Lead Volume and
 *   Source Breakdown widgets.
 * @throws {MissingHubSpotTokenError} when no token is configured (env var or explicit).
 * @throws {HubSpotApiError} when HubSpot rejects a request or the network fails.
 */
export async function fetchStage1LeadsAndDeals(
  options: FetchStage1LeadsAndDealsOptions = {},
): Promise<Stage1LeadsAndDeals> {
  const token = options.accessToken?.trim() ? options.accessToken.trim() : readAccessToken();
  if (!token) {
    throw new MissingHubSpotTokenError();
  }

  const lifecycleStages = options.lifecycleStages?.length ? options.lifecycleStages : ["lead"];
  const dealPipelines = options.dealPipelines?.length ? options.dealPipelines : ["default"];
  const pageSize = Math.min(Math.max(1, options.pageSize ?? 100), 100);
  const maxRecords = Math.max(1, options.maxRecords ?? 500);
  const createdate = createdateFilters(options.createdAfter, options.createdBefore);

  const contactFilters: WireFilter[] = [
    { propertyName: "lifecyclestage", operator: "IN", values: lifecycleStages },
    ...createdate,
  ];
  const dealFilters: WireFilter[] = [
    { propertyName: "pipeline", operator: "IN", values: dealPipelines },
    ...(options.dealStages && options.dealStages.length > 0
      ? [{ propertyName: "dealstage", operator: "IN" as const, values: options.dealStages }]
      : []),
    ...createdate,
  ];

  const contactRequest: SearchRequestWire = {
    properties: [...CONTACT_PROPERTIES],
    sorts: ["-createdate"],
    filterGroups: [{ filters: contactFilters }],
  };
  const dealRequest: SearchRequestWire = {
    properties: [...DEAL_PROPERTIES],
    sorts: ["-createdate"],
    filterGroups: [{ filters: dealFilters }],
  };

  // Dynamic import keeps the SDK out of the initial page bundle; it loads only
  // when a fetch is actually attempted (still fully compiled by tsc + vite build).
  const { Client } = await import("@hubspot/api-client");
  const client = options.basePath
    ? new Client({ accessToken: token, numberOfApiCallRetries: 2, basePath: options.basePath })
    : new Client({ accessToken: token, numberOfApiCallRetries: 2 });

  const contactsApi = client.crm.contacts.searchApi;
  const dealsApi = client.crm.deals.searchApi;

  const [contactsFetch, dealsFetch] = await Promise.all([
    fetchAllPages(
      (after, limit) =>
        contactsApi
          .doSearch({ ...contactRequest, after, limit } as unknown as Parameters<typeof contactsApi.doSearch>[0])
          .catch((error: unknown) => {
            throw toHubSpotApiError(error, "Stage 1 leads");
          }),
      pageSize,
      maxRecords,
    ),
    fetchAllPages(
      (after, limit) =>
        dealsApi
          .doSearch({ ...dealRequest, after, limit } as unknown as Parameters<typeof dealsApi.doSearch>[0])
          .catch((error: unknown) => {
            throw toHubSpotApiError(error, "Stage 1 deals");
          }),
      pageSize,
      maxRecords,
    ),
  ]);

  return {
    leads: contactsFetch.records.map(mapContact),
    leadTotal: contactsFetch.total,
    deals: dealsFetch.records.map(mapDeal),
    dealTotal: dealsFetch.total,
    truncated: contactsFetch.truncated || dealsFetch.truncated,
    fetchedAt: new Date().toISOString(),
  };
}
