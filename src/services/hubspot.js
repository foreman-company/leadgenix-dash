const HUBSPOT_API_BASE = "https://api.hubapi.com";

export class HubSpotError extends Error {
  constructor(message, { status, code, response } = {}) {
    super(message);
    this.name = "HubSpotError";
    this.status = status;
    this.code = code;
    this.response = response;
  }
}

export class HubSpotAuthError extends HubSpotError {
  constructor(message, meta) {
    super(message, meta);
    this.name = "HubSpotAuthError";
  }
}

export class HubSpotValidationError extends HubSpotError {
  constructor(message, meta) {
    super(message, meta);
    this.name = "HubSpotValidationError";
  }
}

function assertToken(accessToken) {
  if (!accessToken || typeof accessToken !== "string") {
    throw new HubSpotAuthError("Missing or invalid HubSpot access token.", {
      status: 401,
      code: "MISSING_TOKEN",
    });
  }
}

async function hubspotFetch(path, accessToken, { searchParams = {} } = {}) {
  assertToken(accessToken);

  const url = new URL(path, HUBSPOT_API_BASE);
  Object.entries(searchParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, value);
    }
  });

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  let body;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const meta = { status: response.status, code: body?.category, response: body };
    if (response.status === 401) {
      throw new HubSpotAuthError("HubSpot authentication failed.", meta);
    }
    throw new HubSpotError(
      body?.message || `HubSpot request failed with status ${response.status}`,
      meta,
    );
  }

  return body;
}

export function validateContactsResponse(data) {
  if (!data || typeof data !== "object") {
    throw new HubSpotValidationError("Invalid contacts response: expected object.");
  }
  if (!Array.isArray(data.results)) {
    throw new HubSpotValidationError("Invalid contacts response: missing results array.");
  }
  return data.results.map((contact) => ({
    id: contact.id,
    firstName: contact.properties?.firstname || "",
    lastName: contact.properties?.lastname || "",
    email: contact.properties?.email || "",
    company: contact.properties?.company || "",
    createdAt: contact.createdAt,
    updatedAt: contact.updatedAt,
  }));
}

export function validateDealsResponse(data) {
  if (!data || typeof data !== "object") {
    throw new HubSpotValidationError("Invalid deals response: expected object.");
  }
  if (!Array.isArray(data.results)) {
    throw new HubSpotValidationError("Invalid deals response: missing results array.");
  }
  return data.results.map((deal) => ({
    id: deal.id,
    name: deal.properties?.dealname || "",
    amount: Number(deal.properties?.amount) || 0,
    stage: deal.properties?.dealstage || "",
    pipeline: deal.properties?.pipeline || "",
    closeDate: deal.properties?.closedate || "",
    createdAt: deal.createdAt,
    updatedAt: deal.updatedAt,
  }));
}

export async function fetchContacts(accessToken, { limit = 10 } = {}) {
  const data = await hubspotFetch("/crm/v3/objects/contacts", accessToken, {
    searchParams: {
      properties: "firstname,lastname,email,company",
      limit: String(limit),
    },
  });
  return validateContactsResponse(data);
}

export async function fetchDeals(accessToken, { limit = 10 } = {}) {
  const data = await hubspotFetch("/crm/v3/objects/deals", accessToken, {
    searchParams: {
      properties: "dealname,amount,dealstage,pipeline,closedate",
      limit: String(limit),
    },
  });
  return validateDealsResponse(data);
}
