/**
 * Dashboard base page — the Leadgenix starter view.
 *
 * Scaffold only: the widgets below are rendered data-free, so they show their
 * friendly empty states. Connecting them to HubSpot (src/hubspot.ts) is open
 * sibling work (#2028835877 / #2028835873) and deliberately not started here.
 */
import { LeadVolumeWidget, SourceBreakdownWidget } from "../../components";

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  backgroundColor: "#f9fafb",
  color: "#111827",
  fontFamily:
    "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  display: "flex",
  flexDirection: "column",
  gap: "1.5rem",
  padding: "2rem",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.375rem",
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "1.5rem",
  fontWeight: 600,
  color: "#111827",
};

const introStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "0.9375rem",
  lineHeight: 1.5,
  color: "#6b7280",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "1rem",
  alignItems: "start",
};

/**
 * The dashboard itself: one friendly line telling the team what this page is,
 * plus the two starter widget shells. No data fetching happens here yet.
 */
export default function DashboardPage(): React.JSX.Element {
  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <h1 style={titleStyle}>Your Leadgenix Dashboard</h1>
        <p style={introStyle}>
          We&apos;re still setting things up — once HubSpot is connected, your lead
          activity will show up right here.
        </p>
      </header>

      <div style={gridStyle}>
        <LeadVolumeWidget />
        <SourceBreakdownWidget />
      </div>
    </main>
  );
}
