// Tests for the SourceBreakdownWidget data visualization.
//
// Runs on plain Node (node --test) with jsdom supplying a DOM, so the real
// React effects and the real Chart.js instance execute:
//   - the widget mounts and builds a Chart.js doughnut on the canvas
//   - a new HubSpot pull swaps the chart data in place (dynamic update)
//   - the accessible table / aria-label mirror the chart data
//   - responsive options let Chart.js follow its container size
//   - loading / error / empty states render
//
// jsdom ships no 2D canvas and no ResizeObserver, so the suite installs
// small stubs before Chart.js renders; Chart.js's observable behaviour
// (type, data, options, update) is asserted on the live Chart instance.

import test, { after } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

register(new URL("./jsx-loader.mjs", import.meta.url));

const { JSDOM } = await import("jsdom");

// ---------------------------------------------------------------------------
// DOM globals (needed by Chart.js and react-dom/client)
// ---------------------------------------------------------------------------

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  pretendToBeVisual: true,
  url: "http://localhost/",
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, "navigator", {
  value: dom.window.navigator,
  configurable: true,
  writable: true,
});
for (const key of [
  "HTMLElement",
  "HTMLCanvasElement",
  "Element",
  "Node",
  "Event",
  "MouseEvent",
  "MutationObserver",
  "getComputedStyle",
]) {
  if (dom.window[key] !== undefined) globalThis[key] = dom.window[key];
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 16);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);

// Chart.js's responsive engine observes its container; jsdom ships no
// ResizeObserver, so provide a no-op one (jsdom reports 0x0 sizes anyway).
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverStub;
dom.window.ResizeObserver = ResizeObserverStub;

// jsdom's `pretendToBeVisual` mode runs an internal requestAnimationFrame
// timer loop; per the installed jsdom README, outstanding jsdom timers keep
// the Node process alive. Close the window once every test has finished so
// `node --test` can exit cleanly instead of hanging until a timeout kills it.
after(() => {
  dom.window.close();
});

// jsdom ships no 2D canvas; record that paint calls happened.
let drawCallCount = 0;
dom.window.HTMLCanvasElement.prototype.getContext = function getContext(type) {
  if (type !== "2d") return null;
  drawCallCount += 1;
  if (this.__stub2d) return this.__stub2d;
  this.__stub2d = new Proxy(
    {},
    {
      get: (target, prop) => {
        if (prop === "canvas") return this;
        if (prop === "measureText") return () => ({ width: 10 });
        if (prop === "createLinearGradient" || prop === "createRadialGradient")
          return () => ({ addColorStop: () => {} });
        return typeof prop === "string" ? () => {} : undefined;
      },
      set: () => true,
    },
  );
  return this.__stub2d;
};

// ---------------------------------------------------------------------------
// Modules under test (imported AFTER globals exist)
// ---------------------------------------------------------------------------

const chartjsModule = await import("chart.js");
const reactModule = await import("react");
const reactDomClient = await import("react-dom/client");
const WidgetModule = await import("../src/components/SourceBreakdownWidget.jsx");
const chartLib = await import("../src/lib/sourceBreakdownChart.js");
const hubspot = await import("../src/services/hubspotLeadSources.js");
const { useLeadSourceData } = await import("../src/hooks/useLeadSourceData.js");

const { Chart } = chartjsModule;
const React = reactModule;
const { createRoot } = reactDomClient;
const { act } = reactModule;
const Widget = WidgetModule.default;

const DASHBOARD_CSS = readFileSync(
  fileURLToPath(new URL("../src/styles/dashboard.css", import.meta.url)),
  "utf8",
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function render(element) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(element);
  });
  return {
    container,
    async rerender(nextElement) {
      await act(async () => {
        root.render(nextElement);
      });
    },
    unmount() {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

function liveCharts() {
  return Object.values(Chart.instances || {});
}

function liveChartInstance() {
  const instances = liveCharts();
  assert.ok(
    instances.length > 0,
    "expected a live Chart.js instance attached to the widget canvas",
  );
  return instances[instances.length - 1];
}

const DEMO_SOURCES = [
  { source: "Organic Search", count: 184 },
  { source: "Paid Search", count: 97 },
  { source: "Referrals", count: 63 },
];

const PULL_1 = [
  { source: "Organic Search", count: 20 },
  { source: "Paid Search", count: 10 },
];

const PULL_2 = [
  { source: "Organic Search", count: 44 },
  { source: "Paid Search", count: 10 },
  { source: "Email Marketing", count: 6 },
];

// ---------------------------------------------------------------------------
// 1. Chart.js rendering (acceptance: renders a visual chart with Chart.js)
// ---------------------------------------------------------------------------

test("widget renders a Chart.js doughnut chart from lead source data", async () => {
  const view = await render(React.createElement(Widget, { leadSources: DEMO_SOURCES }));
  const canvas = view.container.querySelector("canvas");
  assert.ok(canvas, "widget must render a <canvas> for the chart");

  const chart = liveChartInstance();
  assert.equal(
    chart.canvas,
    canvas,
    "Chart.js instance must be bound to the widget's canvas",
  );
  assert.equal(chart.config.type, "doughnut", "chart type must be doughnut");
  assert.deepEqual(chart.data.labels, [
    "Organic Search",
    "Paid Search",
    "Referrals",
  ]);
  assert.deepEqual(chart.data.datasets[0].data, [184, 97, 63]);
  assert.ok(drawCallCount > 0, "Chart.js drew onto the canvas 2D context");
  view.unmount();
});

test("chart draws with one distinct color per lead source", async () => {
  const view = await render(React.createElement(Widget, { leadSources: DEMO_SOURCES }));
  const chart = liveChartInstance();
  const bg = chart.data.datasets[0].backgroundColor;
  assert.equal(bg.length, DEMO_SOURCES.length, "one palette color per lead source");
  assert.ok(new Set(bg).size === DEMO_SOURCES.length, "colors distinct per source");
  view.unmount();
});

test("unmount destroys the chart and removes the canvas", async () => {
  const view = await render(React.createElement(Widget, { leadSources: DEMO_SOURCES }));
  assert.equal(liveCharts().length, 1);
  view.unmount();
  assert.equal(liveCharts().length, 0, "Chart.js instance destroyed on unmount");
  assert.equal(view.container.querySelector("canvas"), null, "canvas removed");
});

// ---------------------------------------------------------------------------
// 2. Accessibility + widget integration
// ---------------------------------------------------------------------------

test("widget exposes an accessible table mirroring the chart data", async () => {
  const view = await render(React.createElement(Widget, { leadSources: DEMO_SOURCES }));
  const table = view.container.querySelector("table");
  assert.ok(table, "widget must render the accessible data table");
  assert.match(table.className, /visually-hidden/);
  assert.equal(table.querySelector("caption").textContent, "Lead sources data");
  const headerCells = [...table.querySelectorAll("th[scope='col']")].map(
    (th) => th.textContent,
  );
  assert.deepEqual(headerCells, ["Source", "Leads", "Share"]);
  const rows = [...table.querySelectorAll("tbody tr")];
  assert.equal(rows.length, DEMO_SOURCES.length);
  assert.equal(
    rows[0].querySelector("th[scope='row']").textContent,
    "Organic Search",
  );
  assert.equal(rows[0].querySelector("td").textContent, "184");
  assert.equal(rows[0].querySelector("td + td").textContent, "53.5%"); // 184/344
  assert.ok(
    view.container.querySelector("section[aria-labelledby]"),
    "widget stays a labelled section inside the widget structure",
  );
  view.unmount();
});

test("chart figure carries an aria-label with every source and value", async () => {
  const view = await render(React.createElement(Widget, { leadSources: DEMO_SOURCES }));
  const figure = view.container.querySelector("figure[role='img']");
  assert.ok(figure, "chart figure has role=img for assistive tech");
  const label = figure.getAttribute("aria-label");
  assert.match(label, /Organic Search 184 leads/);
  assert.match(label, /Paid Search 97 leads/);
  assert.match(label, /Referrals 63 leads/);
  const caption = figure.querySelector("figcaption");
  assert.ok(caption, "figure has a figcaption fallback");
  assert.match(caption.textContent, /Organic Search 184 leads/);
  view.unmount();
});

test("chart options make Chart.js responsive to its container", async () => {
  const view = await render(React.createElement(Widget, { leadSources: DEMO_SOURCES }));
  const chart = liveChartInstance();
  assert.equal(chart.options.responsive, true, "responsive: true");
  assert.equal(
    chart.options.maintainAspectRatio,
    true,
    "maintainAspectRatio true so height follows width",
  );
  assert.ok(
    typeof chart.options.aspectRatio === "number" && chart.options.aspectRatio > 0,
    "aspectRatio is a positive number",
  );
  assert.match(DASHBOARD_CSS, /\.source-breakdown-chart\s*{/, "container CSS exists");
  assert.match(
    DASHBOARD_CSS,
    /\.source-breakdown-chart canvas\s*{[^}]*width:\s*100%/,
    "canvas CSS width 100% so the chart fluidly resizes",
  );
  view.unmount();
});

test("details disclosure stays keyboard operable with aria-expanded", async () => {
  const view = await render(React.createElement(Widget, { leadSources: DEMO_SOURCES }));
  const button = view.container.querySelector("button.widget-button");
  assert.ok(button, "details button rendered");
  assert.equal(button.getAttribute("aria-expanded"), "false");
  assert.equal(
    view.container.querySelector(".source-breakdown-details"),
    null,
    "details hidden initially",
  );
  await act(async () => {
    button.dispatchEvent(
      new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }),
    );
  });
  assert.equal(button.getAttribute("aria-expanded"), "true");
  const list = view.container.querySelector(".source-breakdown-details");
  assert.ok(list, "details list rendered after activation");
  assert.match(list.textContent, /Organic Search — 184 leads/);
  view.unmount();
});

// ---------------------------------------------------------------------------
// 3. Dynamic update on new HubSpot data
// ---------------------------------------------------------------------------

test("chart updates in place when a new HubSpot pull lands", async () => {
  const view = await render(React.createElement(Widget, { leadSources: PULL_1 }));
  const canvas = view.container.querySelector("canvas");
  const first = liveChartInstance();
  assert.deepEqual(first.data.datasets[0].data, [20, 10], "initial pull rendered");

  await view.rerender(React.createElement(Widget, { leadSources: PULL_2 }));

  const second = liveChartInstance();
  assert.equal(second.id, first.id, "chart instance reused (not recreated)");
  assert.equal(second.canvas, canvas, "canvas element reused");
  assert.deepEqual(second.data.labels, [
    "Organic Search",
    "Paid Search",
    "Email Marketing",
  ]);
  assert.deepEqual(
    second.data.datasets[0].data,
    [44, 10, 6],
    "chart data replaced with the new pull",
  );
  const rowText = [...view.container.querySelectorAll("tbody tr")].map(
    (tr) => tr.querySelector("th").textContent,
  );
  assert.deepEqual(rowText, ["Organic Search", "Paid Search", "Email Marketing"]);
  view.unmount();
});

test("empty interlude then data rebuilds the chart on the live canvas", async () => {
  const view = await render(React.createElement(Widget, { leadSources: PULL_1 }));
  const first = liveChartInstance();

  await view.rerender(React.createElement(Widget, { leadSources: [] }));
  assert.match(
    view.container.textContent,
    /No lead source data available yet\./,
    "empty state shown",
  );

  await view.rerender(React.createElement(Widget, { leadSources: PULL_2 }));
  const canvas = view.container.querySelector("canvas");
  assert.ok(canvas, "canvas remounted after empty interlude");
  const chart = liveChartInstance();
  assert.equal(
    chart.canvas,
    canvas,
    "chart must be rebuilt on the mounted canvas (regression)",
  );
  assert.notEqual(chart.id, first.id, "stale chart replaced by a fresh instance");
  assert.deepEqual(chart.data.datasets[0].data, [44, 10, 6]);
  view.unmount();
});

test("hook loads a pull, then refresh picks up the next HubSpot pull", async () => {
  // Without a token the connector (correctly) returns labeled demo data, so
  // pass an explicit token and inject fetch to exercise the live pull path.
  const pulls = [
    {
      results: [
        { id: "1", properties: { hs_analytics_source: "ORGANIC_SEARCH" } },
        { id: "2", properties: { hs_analytics_source: "ORGANIC_SEARCH" } },
        { id: "3", properties: { hs_analytics_source: "PAID_SEARCH" } },
      ],
    },
    {
      results: [
        { id: "1", properties: { hs_analytics_source: "ORGANIC_SEARCH" } },
        { id: "2", properties: { hs_analytics_source: "PAID_SEARCH" } },
        { id: "3", properties: { hs_analytics_source: "EMAIL_MARKETING" } },
      ],
    },
  ];
  let call = 0;
  const fetchImpl = async () => ({
    ok: true,
    json: async () => pulls[Math.min(call++, pulls.length - 1)],
  });
  const captures = [];
  function Probe() {
    const state = useLeadSourceData({ fetchImpl, token: "test-token" });
    captures.push(state);
    return null;
  }
  const view = await render(React.createElement(Probe));
  assert.equal(captures[0].isLoading, true, "starts loading");
  const loaded = captures.find((s) => !s.isLoading);
  assert.ok(loaded, "hook finished loading");
  assert.equal(loaded.sources.length, 2, "first pull loaded");
  assert.deepEqual(
    loaded.sources.map((s) => s.source),
    ["Organic Search", "Paid Search"],
  );
  assert.equal(loaded.origin, "hubspot");
  assert.equal(typeof loaded.refresh, "function", "hook exposes refresh");

  await act(async () => {
    await loaded.refresh();
  });

  const refreshed = captures[captures.length - 1];
  assert.deepEqual(
    refreshed.sources.map((s) => s.source),
    ["Email Marketing", "Organic Search", "Paid Search"],
    "second HubSpot pull replaced the data (ties sorted alphabetically)",
  );
  assert.notEqual(
    refreshed.lastUpdated.getTime(),
    loaded.lastUpdated.getTime(),
    "lastUpdated advanced",
  );
  view.unmount();
});

// ---------------------------------------------------------------------------
// 4. HubSpot data layer feeding the chart
// ---------------------------------------------------------------------------

test("hubspot connector aggregates contacts into lead sources", () => {
  const contacts = [
    { id: "1", properties: { hs_analytics_source: "PAID_SEARCH" } },
    { id: "2", properties: { hs_analytics_source: "PAID_SEARCH" } },
    { id: "3", properties: { hs_analytics_source: "DIRECT_TRAFFIC" } },
    { id: "4", properties: {} },
    { id: "5" },
  ];
  const aggregated = hubspot.mapContactsToLeadSources(contacts);
  assert.deepEqual(aggregated, [
    { source: "Paid Search", count: 2 },
    { source: "Unknown", count: 2 },
    { source: "Direct Traffic", count: 1 },
  ]);
  assert.equal(hubspot.mapContactsToLeadSources([]).length, 0);
  assert.equal(hubspot.mapContactsToLeadSources(undefined).length, 0);
});

test("hubspot connector pages through the contacts API", async () => {
  const seen = [];
  const fetchImpl = async (url, init) => {
    seen.push({ url: String(url), auth: init?.headers?.Authorization });
    if (seen.length === 1) {
      return {
        ok: true,
        json: async () => ({
          results: [{ id: "1", properties: { hs_analytics_source: "PAID_SEARCH" } }],
          paging: { next: { after: "42" } },
        }),
      };
    }
    return {
      ok: true,
      json: async () => ({
        results: [{ id: "2", properties: { hs_analytics_source: "REFERRALS" } }],
      }),
    };
  };
  const result = await hubspot.fetchLeadSources({ fetchImpl, token: "test-token" });
    assert.equal(result.origin, "hubspot");
    assert.equal(seen.length, 2, "both pages requested");
    assert.match(seen[0].url, /properties=hs_analytics_source/);
    assert.match(seen[0].url, /limit=100/);
    assert.match(seen[1].url, /after=42/, "second page uses the cursor");
    assert.equal(seen[0].auth, "Bearer test-token");
    assert.deepEqual(result.sources, [
      { source: "Paid Search", count: 1 },
      { source: "Referrals", count: 1 },
    ]);
});

test("hubspot connector surfaces API errors instead of fake data", async () => {
  const fetchImpl = async () => ({ ok: false, status: 401 });
  await assert.rejects(
    () => hubspot.fetchLeadSources({ fetchImpl, token: "test-token" }),
    /status 401/,
  );
});

test("without a token the connector returns labeled demo data", async () => {
  // The connector reads its token from import.meta.env.VITE_HUBSPOT_API_TOKEN
  // (Vite-replaced at build time); in plain Node tests import.meta.env is
  // undefined, so this exercises the real "no token configured" path.
  const result = await hubspot.fetchLeadSources({
    fetchImpl: async () => {
      throw new Error("must not fetch without a token");
    },
  });
  assert.equal(result.origin, "demo");
  assert.ok(result.sources.length > 0);
});

test("widget renders loading, error and empty states", async () => {
  const errorView = await render(
    React.createElement(Widget, {
      leadSources: [],
      isLoading: false,
      error: "status 401",
      onRefresh: () => {},
    }),
  );
  assert.match(
    errorView.container.textContent,
    /Failed to load lead source data: status 401/,
  );
  assert.ok(errorView.container.querySelector("button"), "retry button offered");
  errorView.unmount();

  const emptyView = await render(
    React.createElement(Widget, { leadSources: [], isLoading: false }),
  );
  assert.match(emptyView.container.textContent, /No lead source data available yet\./);
  emptyView.unmount();

  const loadingView = await render(
    React.createElement(Widget, { leadSources: [], isLoading: true }),
  );
  assert.match(loadingView.container.textContent, /Loading lead sources…/);
  loadingView.unmount();
});

// ---------------------------------------------------------------------------
// 5. Chart config helpers
// ---------------------------------------------------------------------------

test("chart config helper produces a doughnut config with palette + tooltips", () => {
  const config = chartLib.buildLeadSourceChartConfig(DEMO_SOURCES);
  assert.equal(config.type, "doughnut");
  assert.deepEqual(config.data.labels, [
    "Organic Search",
    "Paid Search",
    "Referrals",
  ]);
  assert.deepEqual(config.data.datasets[0].data, [184, 97, 63]);
  assert.equal(config.options.responsive, true);
  assert.ok(config.options.aspectRatio > 0);
  const label = config.options.plugins.tooltip.callbacks.label({
    parsed: 184,
    label: "Organic Search",
  });
  assert.match(label, /Organic Search: 184 leads \(53\.5%\)/);
});

test("applyChartData updates an existing chart instance in place", () => {
  const canvas = document.createElement("canvas");
  const chart = new Chart(canvas, {
    type: "doughnut",
    data: { labels: ["A"], datasets: [{ data: [1] }] },
    options: { responsive: false, animation: false },
  });
  let updateCalls = 0;
  const originalUpdate = chart.update.bind(chart);
  chart.update = (...args) => {
    updateCalls += 1;
    return originalUpdate(...args);
  };
  const config = chartLib.buildLeadSourceChartConfig(PULL_2);
  chartLib.applyChartData(chart, config);
  assert.equal(updateCalls, 1, "chart.update() invoked exactly once");
  assert.deepEqual(chart.data.datasets[0].data, [44, 10, 6]);
  assert.equal(chart.options.plugins.legend.position, "bottom");
  chart.destroy();
});
