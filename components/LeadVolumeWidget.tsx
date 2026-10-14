/**
 * Lead Volume widget — starter shell for the Leadgenix lead dashboard.
 *
 * Scaffold only: no HubSpot calls and no charting live here yet. The HubSpot
 * wiring (#2028835877 / #2028835873) will pass real numbers in through these
 * props, so keep them simple and typed.
 */
export interface LeadVolumeWidgetProps {
  /** How many Stage 1 leads came in during the selected period. Omit while unloaded. */
  leadCount?: number;
  /** Short, human label for the period the number covers, e.g. "Last 30 days". */
  periodLabel?: string;
  /** Extra class name for the card, so the page that mounts it can handle layout. */
  className?: string;
}

const cardStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
  padding: "1.25rem",
  borderRadius: "12px",
  border: "1px solid #e5e7eb",
  backgroundColor: "#ffffff",
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "1rem",
  fontWeight: 600,
  color: "#111827",
};

const periodStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "0.8125rem",
  color: "#6b7280",
};

const emptyMessageStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "0.875rem",
  lineHeight: 1.5,
  color: "#6b7280",
};

const valueStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "1.75rem",
  fontWeight: 600,
  color: "#111827",
};

/**
 * Shows how many Stage 1 leads arrived in a period. Renders a friendly
 * empty-state card until `leadCount` is supplied.
 */
export default function LeadVolumeWidget({
  leadCount,
  periodLabel,
  className,
}: LeadVolumeWidgetProps): React.JSX.Element {
  const hasData = typeof leadCount === "number";

  return (
    <section className={className} style={cardStyle} aria-labelledby="lead-volume-title">
      <header>
        <h2 id="lead-volume-title" style={titleStyle}>
          Lead Volume
        </h2>
        {periodLabel ? <p style={periodStyle}>{periodLabel}</p> : null}
      </header>

      {hasData ? (
        <p style={valueStyle}>{leadCount} leads</p>
      ) : (
        <p style={emptyMessageStyle}>
          No lead data yet. Connect HubSpot and your Stage 1 leads will show up right
          here.
        </p>
      )}
    </section>
  );
}
