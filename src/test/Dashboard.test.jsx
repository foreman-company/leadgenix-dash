import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ContactsWidget, DealsWidget } from "../components/Dashboard.jsx";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderWithClient(ui) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

function mockFetch(payload, { ok = true, status = 200 } = {}) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => payload,
  });
}

describe("ContactsWidget", () => {
  it("shows a loading state then renders contacts", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        results: [
          {
            id: "1",
            properties: {
              firstname: "Ada",
              lastname: "Lovelace",
              email: "ada@example.com",
              company: "Analytical Engines",
            },
          },
        ],
      }),
    );
    renderWithClient(<ContactsWidget accessToken="token" />);
    expect(screen.getByTestId("loading")).toBeInTheDocument();

    await waitFor(() => expect(screen.getByTestId("contacts-list")).toBeInTheDocument());
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText(/ada@example\.com/)).toBeInTheDocument();
  });

  it("shows an empty state when there are no contacts", async () => {
    vi.stubGlobal("fetch", mockFetch({ results: [] }));
    renderWithClient(<ContactsWidget accessToken="token" />);
    await waitFor(() => expect(screen.getByTestId("empty")).toBeInTheDocument());
  });

  it("shows an error state when the request fails", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({ message: "unauthorized", category: "UNAUTHORIZED" }, { ok: false, status: 401 }),
    );
    renderWithClient(<ContactsWidget accessToken="token" />);
    await waitFor(() => expect(screen.getByTestId("error")).toBeInTheDocument());
    expect(screen.getByTestId("error")).toHaveTextContent(/authentication failed/i);
  });
});

describe("DealsWidget", () => {
  it("renders deals with formatted amounts", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        results: [
          {
            id: "10",
            properties: {
              dealname: "Big Deal",
              amount: "5000",
              dealstage: "closedwon",
              pipeline: "default",
            },
          },
        ],
      }),
    );
    renderWithClient(<DealsWidget accessToken="token" />);
    await waitFor(() => expect(screen.getByTestId("deals-list")).toBeInTheDocument());
    expect(screen.getByText("Big Deal")).toBeInTheDocument();
    expect(screen.getByText("$5,000")).toBeInTheDocument();
  });

  it("shows an empty state when there are no deals", async () => {
    vi.stubGlobal("fetch", mockFetch({ results: [] }));
    renderWithClient(<DealsWidget accessToken="token" />);
    await waitFor(() => expect(screen.getByTestId("empty")).toBeInTheDocument());
  });
});
