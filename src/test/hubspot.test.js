import { describe, it, expect, vi, afterEach } from "vitest";
import {
  validateContactsResponse,
  validateDealsResponse,
  fetchContacts,
  fetchDeals,
  HubSpotAuthError,
  HubSpotValidationError,
  HubSpotError,
} from "../services/hubspot.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("validateContactsResponse", () => {
  it("maps a valid HubSpot contacts response to domain objects", () => {
    const raw = {
      results: [
        {
          id: "1",
          properties: {
            firstname: "Ada",
            lastname: "Lovelace",
            email: "ada@example.com",
            company: "Analytical Engines",
          },
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-02T00:00:00Z",
        },
      ],
    };
    expect(validateContactsResponse(raw)).toEqual([
      {
        id: "1",
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@example.com",
        company: "Analytical Engines",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-02T00:00:00Z",
      },
    ]);
  });

  it("defaults missing properties to empty strings", () => {
    const raw = { results: [{ id: "2", properties: {} }] };
    expect(validateContactsResponse(raw)[0]).toMatchObject({
      id: "2",
      firstName: "",
      lastName: "",
      email: "",
      company: "",
    });
  });

  it("throws a validation error when results is missing", () => {
    expect(() => validateContactsResponse({})).toThrow(HubSpotValidationError);
  });

  it("throws a validation error for non-object input", () => {
    expect(() => validateContactsResponse(null)).toThrow(HubSpotValidationError);
    expect(() => validateContactsResponse("nope")).toThrow(HubSpotValidationError);
  });
});

describe("validateDealsResponse", () => {
  it("maps a valid HubSpot deals response to domain objects", () => {
    const raw = {
      results: [
        {
          id: "10",
          properties: {
            dealname: "Big Deal",
            amount: "5000",
            dealstage: "closedwon",
            pipeline: "default",
            closedate: "2024-03-01",
          },
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-02T00:00:00Z",
        },
      ],
    };
    expect(validateDealsResponse(raw)).toEqual([
      {
        id: "10",
        name: "Big Deal",
        amount: 5000,
        stage: "closedwon",
        pipeline: "default",
        closeDate: "2024-03-01",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-02T00:00:00Z",
      },
    ]);
  });

  it("coerces a missing/invalid amount to 0", () => {
    const raw = { results: [{ id: "11", properties: { dealname: "No amount" } }] };
    expect(validateDealsResponse(raw)[0].amount).toBe(0);
  });

  it("throws a validation error when results is missing", () => {
    expect(() => validateDealsResponse({})).toThrow(HubSpotValidationError);
  });
});

describe("fetch wrappers", () => {
  it("throws an auth error when no token is provided", async () => {
    await expect(fetchContacts("")).rejects.toThrow(HubSpotAuthError);
    await expect(fetchDeals(undefined)).rejects.toThrow(HubSpotAuthError);
  });

  it("calls the contacts endpoint with properties and Bearer auth", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await fetchContacts("token-123", { limit: 5 });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain("/crm/v3/objects/contacts");
    expect(url).toContain("properties=firstname%2Clastname%2Cemail%2Ccompany");
    expect(url).toContain("limit=5");
    expect(options.headers.Authorization).toBe("Bearer token-123");
  });

  it("throws a HubSpotError on a non-OK response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ message: "boom", category: "SERVER_ERROR" }),
      }),
    );
    await expect(fetchContacts("token-123")).rejects.toThrow(HubSpotError);
  });

  it("throws an auth error on a 401 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ message: "unauthorized", category: "UNAUTHORIZED" }),
      }),
    );
    await expect(fetchDeals("token-123")).rejects.toThrow(HubSpotAuthError);
  });
});
