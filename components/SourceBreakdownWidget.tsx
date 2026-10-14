/**
 * Source Breakdown widget — starter shell for the Leadgenix lead dashboard.
 *
 * Scaffold only: no HubSpot calls and no charting live here yet. The
 * visualization (#2028835872 / #2028835876) and the HubSpot wiring
 * (#2028835877 / #2028835873) build directly on this file, so keep the props
 * simple and typed.
 */
export interface SourceBreakdownEntry {
  /** Where the leads came from, e.g. "Organic search". */
  name: string;
  /** How many leads came from that source. */
  count: number;
}

export interface SourceBreakdownWidgetProps {
  /** One entry per lead source. Omit while no data is loaded. */
  sources?: SourceBreakdownEntry[];
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

const emptyMessageStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "0.875rem",
  lineHeight: 1.5,
  color: "#6b7280",
};

const listStyle: React.CSSProperties = {
  margin: 0,
  padding: 0,
  listStyle: "none",
  display: "flex",
  flexDirection: "column",
  gap: "0.375rem",
};

const entryNameStyle: React.CSSProperties = {
  fontSize: "0.875rem",
  color: "#111827",
};

const entryCountStyle: React.CSSProperties = {
  fontSize: "0.875rem",
  color: "#6b7280",
};

/**
 * Shows where leads came from. Renders a friendly empty-state card until
 * `sources` is supplied. Deliberately plain text for now — no charting.
 */
export default function SourceBreakdownWidget({
  sources,
  className,
}: SourceBreakdownWidgetProps): React.JSX.Element {
  const hasData = Array.isArray(sources) && sources.length > 0;

  return (
    <section className={className} style={cardStyle} aria-labelledby="source-breakdown-title">
      <h2 id="source-breakdown-title" style={titleStyle}>
        Source Breakdown
      </h2>

      {hasData ? (
        <ul style={listStyle}>
          {sources.map((source) => (
            <li key={source.name} style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
              <span style={entryNameStyle}>{source.name}</span>
              <span style={entryCountStyle}>{source.count}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p style={emptyMessageStyle}>
          Nothing to break down yet. Once HubSpot is connected, you&apos;ll see where
          your leads are coming from.
        </p>
      )}
    </section>
  );
}
