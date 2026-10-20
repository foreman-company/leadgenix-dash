import { useState } from "react";
import { useContacts, useDeals } from "../hooks/useHubSpot.js";
import { HubSpotAuthError, HubSpotValidationError } from "../services/hubspot.js";

const ENV_TOKEN = import.meta.env?.VITE_HUBSPOT_ACCESS_TOKEN || "";

function describeError(error) {
  if (!error) return "Unknown error.";
  if (error instanceof HubSpotAuthError) {
    return "HubSpot authentication failed. Check your access token.";
  }
  if (error instanceof HubSpotValidationError) {
    return `Unexpected data from HubSpot: ${error.message}`;
  }
  return error.message || "Failed to load data from HubSpot.";
}

function WidgetCard({ title, children }) {
  return (
    <section
      style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: "12px",
        padding: "1.25rem",
        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
        textAlign: "left",
      }}
    >
      <h2 style={{ margin: "0 0 1rem", fontSize: "1.05rem", color: "#0f172a" }}>{title}</h2>
      {children}
    </section>
  );
}

function LoadingState({ label }) {
  return (
    <p data-testid="loading" style={{ color: "#64748b" }}>
      Loading {label}…
    </p>
  );
}

function ErrorState({ error }) {
  return (
    <p data-testid="error" role="alert" style={{ color: "#b91c1c" }}>
      {describeError(error)}
    </p>
  );
}

function EmptyState({ label }) {
  return (
    <p data-testid="empty" style={{ color: "#64748b" }}>
      No {label} found in HubSpot.
    </p>
  );
}

export function ContactsWidget({ accessToken }) {
  const { data: contacts, isLoading, error } = useContacts(accessToken);

  return (
    <WidgetCard title="Contacts">
      {isLoading ? (
        <LoadingState label="contacts" />
      ) : error ? (
        <ErrorState error={error} />
      ) : !contacts || contacts.length === 0 ? (
        <EmptyState label="contacts" />
      ) : (
        <ul data-testid="contacts-list" style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {contacts.map((contact) => (
            <li
              key={contact.id}
              data-testid="contact-item"
              style={{
                padding: "0.6rem 0",
                borderBottom: "1px solid #f1f5f9",
              }}
            >
              <div style={{ fontWeight: 600, color: "#0f172a" }}>
                {[contact.firstName, contact.lastName].filter(Boolean).join(" ") || "Unnamed contact"}
              </div>
              <div style={{ fontSize: "0.85rem", color: "#64748b" }}>
                {contact.email || "No email"}
                {contact.company ? ` · ${contact.company}` : ""}
              </div>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}

export function DealsWidget({ accessToken }) {
  const { data: deals, isLoading, error } = useDeals(accessToken);

  return (
    <WidgetCard title="Deals">
      {isLoading ? (
        <LoadingState label="deals" />
      ) : error ? (
        <ErrorState error={error} />
      ) : !deals || deals.length === 0 ? (
        <EmptyState label="deals" />
      ) : (
        <ul data-testid="deals-list" style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {deals.map((deal) => (
            <li
              key={deal.id}
              data-testid="deal-item"
              style={{
                padding: "0.6rem 0",
                borderBottom: "1px solid #f1f5f9",
                display: "flex",
                justifyContent: "space-between",
                gap: "1rem",
              }}
            >
              <div>
                <div style={{ fontWeight: 600, color: "#0f172a" }}>{deal.name || "Untitled deal"}</div>
                <div style={{ fontSize: "0.85rem", color: "#64748b" }}>
                  {deal.stage || "No stage"}
                  {deal.pipeline ? ` · ${deal.pipeline}` : ""}
                </div>
              </div>
              <div style={{ fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap" }}>
                {new Intl.NumberFormat(undefined, {
                  style: "currency",
                  currency: "USD",
                  maximumFractionDigits: 0,
                }).format(deal.amount)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}

export default function Dashboard() {
  const [manualToken, setManualToken] = useState("");
  const accessToken = (ENV_TOKEN || manualToken).trim();

  return (
    <div style={{ maxWidth: "960px", margin: "0 auto" }}>
      {!ENV_TOKEN && (
        <div
          style={{
            marginBottom: "1.5rem",
            padding: "1rem",
            background: "#fffbeb",
            border: "1px solid #fde68a",
            borderRadius: "12px",
            textAlign: "left",
          }}
        >
          <label htmlFor="hubspot-token" style={{ display: "block", fontWeight: 600, color: "#92400e" }}>
            HubSpot private app access token
          </label>
          <p style={{ margin: "0.35rem 0 0.6rem", fontSize: "0.85rem", color: "#92400e" }}>
            Set <code>VITE_HUBSPOT_ACCESS_TOKEN</code> in the project env, or paste a token here to connect.
          </p>
          <input
            id="hubspot-token"
            type="password"
            value={manualToken}
            onChange={(event) => setManualToken(event.target.value)}
            placeholder="pat-na1-…"
            style={{
              width: "100%",
              padding: "0.5rem 0.6rem",
              borderRadius: "8px",
              border: "1px solid #fde68a",
              boxSizing: "border-box",
            }}
          />
        </div>
      )}

      {!accessToken ? (
        <p data-testid="awaiting-token" style={{ color: "#64748b" }}>
          Enter a HubSpot access token to load your contacts and deals.
        </p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "1.25rem",
          }}
        >
          <ContactsWidget accessToken={accessToken} />
          <DealsWidget accessToken={accessToken} />
        </div>
      )}
    </div>
  );
}
