import { useEffect, useRef, useState } from "react";
import { Chart, registerables } from "chart.js";
import {
  applyChartData,
  buildLeadSourceChartConfig,
} from "../lib/sourceBreakdownChart.js";

Chart.register(...registerables);

function formatTime(date) {
  return date instanceof Date ? date.toLocaleTimeString() : String(date ?? "");
}

/**
 * Lead-source breakdown widget — a Chart.js doughnut of contacts per
 * original source (Organic Search, Paid Search, …), fed by
 * useLeadSourceData. The chart re-renders from its canvas ref whenever
 * `sources` changes, so a new HubSpot pull updates it live.
 *
 * Chart.js's responsive engine sizes the canvas from its container (the
 * widget body), so the chart fluidly adapts from phone widths up. The
 * widget exposes accessible alternatives in parallel: a visually-hidden
 * data table (source, leads, share) and an aria-label that carries the
 * values. The details button and all chart controls stay keyboard operable.
 */
export default function SourceBreakdownWidget({
  leadSources,
  isLoading,
  error,
  origin,
  lastUpdated,
  onRefresh,
}) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const [expanded, setExpanded] = useState(false);

  // Build (or update) the chart whenever the data identity changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    if (!Array.isArray(leadSources) || leadSources.length === 0) return undefined;

    const config = buildLeadSourceChartConfig(leadSources);
    // The canvas is only mounted while data exists, so an empty interlude
    // unmounts it; if the Chart instance still points at the previous
    // (detached) canvas, rebuild it against the current one instead of
    // silently updating a chart that is no longer on screen.
    if (chartRef.current && chartRef.current.canvas === canvas) {
      applyChartData(chartRef.current, config);
    } else {
      chartRef.current?.destroy();
      chartRef.current = new Chart(canvas, config);
    }
    return undefined;
  }, [leadSources]);

  // Destroy the Chart.js instance so it stops its ResizeObserver + animation
  // timers before React removes the canvas from the DOM.
  useEffect(() => {
    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, []);

  const totalLeads = Array.isArray(leadSources)
    ? leadSources.reduce((sum, item) => sum + item.count, 0)
    : 0;
  const hasData = Array.isArray(leadSources) && leadSources.length > 0;
  const ariaLabel = hasData
    ? `Doughnut chart of lead sources: ${leadSources
        .map((s) => `${s.source} ${s.count} leads`)
        .join(", ")}`
    : "Doughnut chart of lead sources";

  return (
    <section
      aria-labelledby="source-breakdown-heading"
      className="widget source-breakdown-widget"
      data-widget="source-breakdown"
      data-origin={origin ?? ""}
    >
      <header className="widget-header">
        <h2 id="source-breakdown-heading">Lead Sources</h2>
        <p className="widget-subtitle">
          Contacts by original source
          {origin
            ? origin === "hubspot"
              ? " · HubSpot"
              : " · demo data (set VITE_HUBSPOT_API_TOKEN for live)"
            : null}
        </p>
        {lastUpdated ? (
          <p className="widget-meta">Last updated {formatTime(lastUpdated)}</p>
        ) : null}
      </header>

      <div className="widget-body">
        {isLoading ? (
          <p role="status" className="widget-loading">
            Loading lead sources…
          </p>
        ) : null}

        {!isLoading && error ? (
          <div role="alert" className="widget-error">
            <p>Failed to load lead source data: {error}</p>
            {onRefresh ? (
              <button type="button" onClick={onRefresh} className="widget-button">
                Try again
              </button>
            ) : null}
          </div>
        ) : null}

        {!isLoading && !error && !hasData ? (
          <p className="widget-empty">No lead source data available yet.</p>
        ) : null}

        {!isLoading && !error && hasData ? (
          <>
            <figure
              className="source-breakdown-chart"
              role="img"
              aria-label={ariaLabel}
            >
              <canvas ref={canvasRef} />
              <figcaption className="visually-hidden">{ariaLabel}</figcaption>
            </figure>

            {/* Data table: the accessible, keyboard-friendly representation
                of the chart, and what the tests assert against. */}
            <table className="visually-hidden source-breakdown-table">
              <caption>Lead sources data</caption>
              <thead>
                <tr>
                  <th scope="col">Source</th>
                  <th scope="col">Leads</th>
                  <th scope="col">Share</th>
                </tr>
              </thead>
              <tbody>
                {leadSources.map((item) => {
                  const share =
                    totalLeads > 0
                      ? `${((item.count / totalLeads) * 100).toFixed(1)}%`
                      : "0.0%";
                  return (
                    <tr key={item.source}>
                      <th scope="row">{item.source}</th>
                      <td>{item.count}</td>
                      <td>{share}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <button
              type="button"
              className="widget-button"
              aria-expanded={expanded}
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded ? "Hide details" : "Show details"}
            </button>
            {expanded ? (
              <ul className="source-breakdown-details">
                {leadSources.map((item) => (
                  <li key={item.source}>
                    {item.source} — {item.count} leads
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  );
}
