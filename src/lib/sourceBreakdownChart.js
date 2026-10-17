import { Chart, registerables } from "chart.js";

// Chart.js v4 requires explicit registration of the components a chart uses
// (per the v4 docs "Getting Started" integration registration section).
Chart.register(...registerables);

export const LEAD_SOURCE_COLORS = [
  "#2563eb", // blue
  "#0ea5e9", // sky
  "#10b981", // emerald
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#ec4899", // pink
];

export const CHART_BORDER_COLOR = "#ffffff";

/** Assign each lead source a stable color from the widget palette. */
export function scaleColorsFromCounts(counts) {
  const palette = [...LEAD_SOURCE_COLORS];
  return counts.map((_, index) => palette[index % palette.length]);
}

/**
 * Push a new config's data/options into an existing Chart.js instance and
 * re-render it. Called by the widget's effect whenever new lead-source data
 * arrives (HubSpot pull, poll, or manual refresh), which is what makes the
 * chart update dynamically without recreating the canvas.
 */
export function applyChartData(chart, config) {
  chart.data = config.data;
  chart.options = config.options;
  chart.update();
}

/**
 * Build the Chart.js v4 config for the lead-source breakdown doughnut.
 *
 * Accessibility & responsiveness (per the v4 docs): the canvas is left to
 * Chart.js's responsive engine (it observes its container) with
 * maintainAspectRatio + aspectRatio, so the widget scales fluidly from phone
 * widths up. Chart.js v4 renders its own off-screen canvas for assistive tech
 * (ARIA/a11y enhancements), and the widget pairs it with a visible legend,
 * an aria-label, and a data table for non-visual access.
 */
export function buildLeadSourceChartConfig(sources) {
  const labels = sources.map((s) => s.source);
  const counts = sources.map((s) => s.count);
  const total = counts.reduce((sum, count) => sum + count, 0);

  return {
    type: "doughnut",
    data: {
      labels,
      datasets: [
        {
          data: counts,
          backgroundColor: scaleColorsFromCounts(counts),
          borderColor: CHART_BORDER_COLOR,
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 1.4,
      cutout: "58%",
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: "#334155", usePointStyle: true, padding: 14 },
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const count = context.parsed;
              const percent = total > 0 ? ((count / total) * 100).toFixed(1) : "0.0";
              return ` ${context.label}: ${count} leads (${percent}%)`;
            },
          },
        },
      },
    },
  };
}
