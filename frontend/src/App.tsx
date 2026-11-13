import { useState, useEffect, useMemo } from "react";
import ReactECharts from "echarts-for-react";
import {
  runOptimization,
  getTelemetry,
  getForecasts,
  getLiveStatus,
  getLiveTelemetry,
  getLiveHistory
} from "./services/api";

import {
  Activity, Cpu, Database, Gauge, Layers3, Network,
  Settings2, ShieldAlert, Zap, ChevronDown, ArrowUpRight,
  CircleDot, Command, BrainCircuit, Server, Clock3,
  HardDrive, TrendingUp, Play, RefreshCw
} from "lucide-react";

const navigation = [
  { label: "Command Center", icon: Command },
  { label: "Live Monitoring", icon: Activity },
  { label: "Telemetry", icon: Activity },
  { label: "Forecasting", icon: BrainCircuit },
  { label: "Diagnostics", icon: ShieldAlert },
  { label: "Optimizer", icon: Gauge },
  { label: "Simulation", icon: Layers3 },
  { label: "Experiments", icon: Database }
];



function Metric({ label, value, unit, icon: Icon, note }: any) {
  return (
    <div className="metric panel">
      <div className="metric-top">
        <span>{label}</span>
        <Icon size={16} />
      </div>
      <div className="metric-value">
        {value}<small>{unit}</small>
      </div>
      <div className="metric-note">{note}</div>
    </div>
  );
}

function SectionHeading({ eyebrow, title }: any) {
  return (
    <div className="section-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h2>{title}</h2>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <div className="empty-state">{message}</div>;
}

function App() {
  const [active, setActive] = useState("Command Center");

  const [budget, setBudget] = useState(10);
  const [allocation, setAllocation] = useState(4);

  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");

  const [telemetry, setTelemetry] = useState<any>(null);
  const [telemetryLoading, setTelemetryLoading] = useState(true);
  const [telemetryError, setTelemetryError] = useState("");

  const [forecasts, setForecasts] = useState<any[]>([]);
  const [forecastLoading, setForecastLoading] = useState(true);
  const [forecastError, setForecastError] = useState("");


const [liveStatus, setLiveStatus] = useState<any>(null);
const [liveTelemetry, setLiveTelemetry] = useState<any>(null);
const [liveLoading, setLiveLoading] = useState(true);
const [liveError, setLiveError] = useState("");
const [lastLiveUpdated, setLastLiveUpdated] = useState<Date | null>(null);
const [liveHistory, setLiveHistory] = useState<any>({
  sglang: [],
  gpu: []
});

  useEffect(() => {
    async function loadData() {
      try {
        const data = await getTelemetry();
        setTelemetry(data);
        setTelemetryError("");
      } catch (error) {
        setTelemetryError(
          error instanceof Error ? error.message : "Telemetry unavailable"
        );
      } finally {
        setTelemetryLoading(false);
      }

      try {
        const data = await getForecasts();
        setForecasts(Array.isArray(data) ? data : []);
        setForecastError("");
      } catch (error) {
        setForecastError(
          error instanceof Error ? error.message : "Forecasts unavailable"
        );
      } finally {
        setForecastLoading(false);
      }
    }

    loadData();
  }, []);


useEffect(() => {
  let cancelled = false;

  async function loadLiveData() {
    try {
      const [status, telemetry, sglangHistory, gpuHistory] =
  await Promise.all([
    getLiveStatus(),
    getLiveTelemetry(),
    getLiveHistory("sglang", 500),
    getLiveHistory("gpu", 500)
  ]);

      if (cancelled) return;

      setLiveStatus(status);
      setLiveTelemetry(telemetry);
      setLiveHistory({
  sglang: sglangHistory.records ?? [],
  gpu: gpuHistory.records ?? []
});
      setLiveError("");
      setLastLiveUpdated(new Date());
    } catch (error) {
      if (cancelled) return;

      setLiveError(
        error instanceof Error
          ? error.message
          : "Live telemetry unavailable"
      );
    } finally {
      if (!cancelled) {
        setLiveLoading(false);
      }
    }
  }

  loadLiveData();

  const interval = window.setInterval(loadLiveData, 60_000);

  return () => {
    cancelled = true;
    window.clearInterval(interval);
  };
}, []);


  async function handleOptimize() {
    setLoading(true);
    setApiError("");

    try {
      const data = await runOptimization(budget, allocation);
      setResult(data);
      setActive("Optimizer");
    } catch (error) {
      setApiError(
        error instanceof Error ? error.message : "Optimization failed"
      );
    } finally {
      setLoading(false);
    }
  }

  const inference = telemetry?.inference ?? [];
  const gpu = telemetry?.gpu ?? [];
  const cpu = telemetry?.cpu ?? [];


const liveInference = liveTelemetry?.sglang ?? [];
const liveGpu = liveTelemetry?.gpu ?? [];
const liveCpu = liveTelemetry?.cpu ?? [];

const liveThroughput = liveInference.reduce(
  (sum: number, record: any) =>
    sum + (Number(record.gen_throughput) || 0),
  0
);

const liveGpuUtil = average(liveGpu, "utilization_pct");
const liveVram = average(liveGpu, "memory_pct");
const liveCpuUtil = average(liveCpu, "cpu_util_pct");

const liveActiveServers = liveInference.filter(
  (record: any) => Number(record.gen_throughput) > 0
).length;

const liveFreshness = liveStatus?.latest_metrics ?? {};

function buildLiveSeries(
  records: any[],
  field: string,
  mode: "sum" | "average"
) {
  const buckets = new Map<
    number,
    Map<string, { timestamp: number; value: number }>
  >();

  records.forEach((record: any) => {
    if (
      record[field] === null ||
      record[field] === undefined ||
      record[field] === ""
    ) {
      return;
    }

    const timestamp = Number(record.ts);
    const value = Number(record[field]);

    if (!Number.isFinite(timestamp) || !Number.isFinite(value)) {
      return;
    }

    // Group samples into one-minute buckets.
    const bucket = Math.floor(timestamp / 60000) * 60000;

    // Keep the latest sample for each entity in each bucket.
    const entity =
      record._entity_id ??
      record.gpu_id ??
      record.node_id ??
      "unknown";

    if (!buckets.has(bucket)) {
      buckets.set(bucket, new Map());
    }

    const entities = buckets.get(bucket)!;
    const existing = entities.get(entity);

    if (!existing || timestamp > existing.timestamp) {
      entities.set(entity, { timestamp, value });
    }
  });

  return Array.from(buckets.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([timestamp, entities]) => {
      const values = Array.from(entities.values()).map(item => item.value);

      return {
        time: new Date(timestamp).toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit"
        }),
        value:
          mode === "sum"
            ? values.reduce((sum, value) => sum + value, 0)
            : values.reduce((sum, value) => sum + value, 0) / values.length
      };
    });
}


  const liveThroughputSeries = useMemo(
    () => buildLiveSeries(liveHistory.sglang, "gen_throughput", "sum"),
    [liveHistory]
  );

  const liveLatencySeries = useMemo(
    () => buildLiveSeries(liveHistory.sglang, "e2e_latency_avg_s", "average"),
    [liveHistory]
  );

  const liveGpuUtilSeries = useMemo(
    () => buildLiveSeries(liveHistory.gpu, "utilization_pct", "average"),
    [liveHistory]
  );

  const liveGpuMemorySeries = useMemo(
    () => buildLiveSeries(liveHistory.gpu, "memory_pct", "average"),
    [liveHistory]
  );

  function makeLiveChart(title: string, unit: string, series: any[]) {
    return {
      backgroundColor: "transparent",
      tooltip: { trigger: "axis" },
      grid: { left: 55, right: 15, top: 20, bottom: 35 },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: series.map((point: any) => point.time),
        axisLabel: { color: "#748291", fontSize: 10 },
        axisLine: { lineStyle: { color: "#283440" } }
      },
      yAxis: {
        type: "value",
        name: unit,
        axisLabel: { color: "#748291", fontSize: 10 },
        nameTextStyle: { color: "#748291" },
        splitLine: {
          lineStyle: { color: "#202B35", type: "dashed" }
        }
      },
      series: [{
        name: title,
        type: "line",
        smooth: 0.3,
        symbol: "none",
        connectNulls: false,
        data: series.map((point: any) => point.value),
        lineStyle: { color: "#C7F36B", width: 2 },
        areaStyle: { color: "rgba(199,243,107,0.08)" }
      }]
    };
  }

  const liveThroughputChart = useMemo(
    () => makeLiveChart("Throughput", "tokens/s", liveThroughputSeries),
    [liveThroughputSeries]
  );

  const liveLatencyChart = useMemo(
    () => makeLiveChart("Latency", "seconds", liveLatencySeries),
    [liveLatencySeries]
  );

  const liveGpuUtilChart = useMemo(
    () => makeLiveChart("GPU utilization", "%", liveGpuUtilSeries),
    [liveGpuUtilSeries]
  );

  const liveGpuMemoryChart = useMemo(
    () => makeLiveChart("GPU memory", "%", liveGpuMemorySeries),
    [liveGpuMemorySeries]
  );

const liveGpuMemoryByDeviceChart = useMemo(() => {
  const buckets = new Map<
    number,
    Map<string, { timestamp: number; value: number }>
  >();

  liveHistory.gpu.forEach((record: any) => {
    if (record.memory_pct == null) return;

    const timestamp = Number(record.ts);
    const value = Number(record.memory_pct);

    if (!Number.isFinite(timestamp) || !Number.isFinite(value)) return;

    const bucket = Math.floor(timestamp / 60000) * 60000;
    const entity = record.gpu_id ?? record._entity_id ?? record.node_id;

    if (!buckets.has(bucket)) buckets.set(bucket, new Map());

    const devices = buckets.get(bucket)!;
    const previous = devices.get(entity);

    if (!previous || timestamp > previous.timestamp) {
      devices.set(entity, { timestamp, value });
    }
  });

  const times = Array.from(buckets.keys()).sort((a, b) => a - b);

  const devices = Array.from(
    new Set(
      Array.from(buckets.values()).flatMap(bucket =>
        Array.from(bucket.keys())
      )
    )
  ).sort();

  return {
    backgroundColor: "transparent",
    tooltip: { trigger: "axis" },
    legend: {
      type: "scroll",
      textStyle: { color: "#9AA8B8", fontSize: 10 }
    },
    grid: { left: 55, right: 15, top: 45, bottom: 35 },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: times.map(timestamp =>
        new Date(timestamp).toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit"
        })
      ),
      axisLabel: { color: "#748291", fontSize: 10 },
      axisLine: { lineStyle: { color: "#283440" } }
    },
    yAxis: {
      type: "value",
      name: "%",
      min: 0,
      max: 100,
      axisLabel: { color: "#748291", fontSize: 10 },
      splitLine: {
        lineStyle: { color: "#202B35", type: "dashed" }
      }
    },
    series: devices.map(device => ({
      name: device,
      type: "line",
      smooth: 0.2,
      symbol: "none",
      connectNulls: false,
      data: times.map(timestamp =>
        buckets.get(timestamp)?.get(device)?.value ?? null
      )
    }))
  };
}, [liveHistory]);

const liveGpuMemoryActivityByDeviceChart = useMemo(() => {
  const buckets = new Map<
    number,
    Map<string, { timestamp: number; value: number }>
  >();

  liveHistory.gpu.forEach((record: any) => {
    if (record.memory_util_pct == null) return;

    const timestamp = Number(record.ts);
    const value = Number(record.memory_util_pct);

    if (!Number.isFinite(timestamp) || !Number.isFinite(value)) return;

    const bucket = Math.floor(timestamp / 60000) * 60000;
    const entity = record.gpu_id ?? record._entity_id ?? record.node_id;

    if (!buckets.has(bucket)) buckets.set(bucket, new Map());

    const devices = buckets.get(bucket)!;
    const previous = devices.get(entity);

    if (!previous || timestamp > previous.timestamp) {
      devices.set(entity, { timestamp, value });
    }
  });

  const times = Array.from(buckets.keys()).sort((a, b) => a - b);

  const devices = Array.from(
    new Set(
      Array.from(buckets.values()).flatMap(bucket =>
        Array.from(bucket.keys())
      )
    )
  ).sort();

  return {
    backgroundColor: "transparent",
    tooltip: { trigger: "axis" },
    legend: {
      type: "scroll",
      textStyle: { color: "#9AA8B8", fontSize: 10 }
    },
    grid: { left: 55, right: 15, top: 45, bottom: 35 },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: times.map(timestamp =>
        new Date(timestamp).toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit"
        })
      ),
      axisLabel: { color: "#748291", fontSize: 10 },
      axisLine: { lineStyle: { color: "#283440" } }
    },
    yAxis: {
      type: "value",
      name: "%",
      min: 0,
      max: 100,
      axisLabel: { color: "#748291", fontSize: 10 },
      splitLine: {
        lineStyle: { color: "#202B35", type: "dashed" }
      }
    },
    series: devices.map(device => ({
      name: device,
      type: "line",
      smooth: 0.2,
      symbol: "none",
      connectNulls: false,
      data: times.map(timestamp =>
        buckets.get(timestamp)?.get(device)?.value ?? null
      )
    }))
  };
}, [liveHistory]);


  const latestInference = useMemo(() => {
    const latest = new Map<string, any>();

    inference.forEach((record: any) => {
      const previous = latest.get(record.server_id);

      if (!previous || new Date(record.ts) > new Date(previous.ts)) {
        latest.set(record.server_id, record);
      }
    });

    return Array.from(latest.values());
  }, [inference]);

  const latestGpu = useMemo(() => {
    const latest = new Map<string, any>();

    gpu.forEach((record: any) => {
      const key = record.gpu_id ?? record.node_id;
      const previous = latest.get(key);

      if (!previous || new Date(record.ts) > new Date(previous.ts)) {
        latest.set(key, record);
      }
    });

    return Array.from(latest.values());
  }, [gpu]);

  const latestCpu = useMemo(() => {
    const latest = new Map<string, any>();

    cpu.forEach((record: any) => {
      const previous = latest.get(record.node_id);

      if (!previous || new Date(record.ts) > new Date(previous.ts)) {
        latest.set(record.node_id, record);
      }
    });

    return Array.from(latest.values());
  }, [cpu]);

  function average(records: any[], field: string) {
    const values = records
      .map((record) => record[field])
      .filter((value) => value !== null && value !== undefined && Number.isFinite(Number(value)))
      .map(Number);

    return values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : null;
  }

  const aggregateThroughput = latestInference.reduce(
    (sum: number, record: any) => {
      const value = Number(record.gen_throughput);
      return sum + (Number.isFinite(value) ? value : 0);
    },
    0
  );

  const averageGpuUtil = average(latestGpu, "utilization_pct");
  const averageVram = average(latestGpu, "memory_pct");
  const averageCpuUtil = average(latestCpu, "cpu_util_pct");

  const activeServers = latestInference.filter(
    (record: any) => Number(record.gen_throughput) > 0
  ).length;

  const chartOption = useMemo(() => {
    const records = inference
      .filter((record: any) =>
        record.gen_throughput !== null &&
        record.gen_throughput !== undefined &&
        Number.isFinite(Number(record.gen_throughput))
      )
      .sort(
        (a: any, b: any) =>
          new Date(a.ts).getTime() - new Date(b.ts).getTime()
      );

    const totals = new Map<string, number>();

    records.forEach((record: any) => {
      totals.set(
        record.ts,
        (totals.get(record.ts) ?? 0) + Number(record.gen_throughput)
      );
    });

    const timestamps = Array.from(totals.keys());

    return {
      backgroundColor: "transparent",
      tooltip: { trigger: "axis" },
      grid: { left: 45, right: 15, top: 20, bottom: 35 },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: timestamps.map((ts) =>
          new Date(ts).toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
            timeZone: "UTC"
          })
        ),
        axisLabel: { color: "#748291", fontSize: 10 },
        axisLine: { lineStyle: { color: "#283440" } }
      },
      yAxis: {
        type: "value",
        name: "tokens/s",
        nameTextStyle: { color: "#748291" },
        axisLabel: { color: "#748291", fontSize: 10 },
        splitLine: {
          lineStyle: { color: "#202B35", type: "dashed" }
        }
      },
      series: [{
        name: "Measured throughput",
        type: "line",
        smooth: 0.35,
        symbol: "none",
        data: timestamps.map((ts) => totals.get(ts)),
        lineStyle: { color: "#C7F36B", width: 2.5 },
        areaStyle: { color: "rgba(199,243,107,0.09)" }
      }]
    };
  }, [inference]);

  const forecastChartOption = useMemo(() => ({
    backgroundColor: "transparent",
    tooltip: { trigger: "axis" },
    grid: { left: 45, right: 15, top: 20, bottom: 35 },
    xAxis: {
      type: "category",
      data: forecasts.map((item) => item.server_id),
      axisLabel: { color: "#748291", fontSize: 10 },
      axisLine: { lineStyle: { color: "#283440" } }
    },
    yAxis: {
      type: "value",
      name: "tokens/s",
      axisLabel: { color: "#748291", fontSize: 10 },
      splitLine: { lineStyle: { color: "#202B35", type: "dashed" } }
    },
    series: [
      {
        name: "Observed",
        type: "bar",
        data: forecasts.map((item) => item.gen_throughput),
        itemStyle: { color: "#C7F36B" }
      },
      {
        name: "Predicted next observation",
        type: "bar",
        data: forecasts.map((item) => item.predicted_next_throughput),
        itemStyle: { color: "#79A9FF" }
      }
    ]
  }), [forecasts]);

  const diagnosis = result?.diagnosis ?? [];
  const simulationResults = result?.simulation_results ?? [];

  const vramWarning =
    averageVram !== null && averageVram >= 90;

  function renderCommandCenter() {
    return (
      <>
        <section className="metrics-grid">
          <Metric
            label="AGGREGATE THROUGHPUT"
            value={telemetryLoading ? "..." : aggregateThroughput.toLocaleString("en-IN", { maximumFractionDigits: 1 })}
            unit=" tok/s"
            icon={Zap}
            note="Latest observed server throughput"
          />
          <Metric
            label="GPU COMPUTE"
            value={averageGpuUtil === null ? "—" : averageGpuUtil.toFixed(1)}
            unit="%"
            icon={Cpu}
            note="Mean latest GPU utilization"
          />
          <Metric
            label="ACTIVE SERVERS"
            value={String(activeServers).padStart(2, "0")}
            unit={` / ${latestInference.length.toString().padStart(2, "0")}`}
            icon={Server}
            note="Servers with positive throughput"
          />
          <Metric
            label="CPU UTILIZATION"
            value={averageCpuUtil === null ? "—" : averageCpuUtil.toFixed(1)}
            unit="%"
            icon={ShieldAlert}
            note="Mean latest node CPU utilization"
          />
        </section>

        <section className="primary-grid">
          <div className="panel chart-panel">
            <SectionHeading eyebrow="PERFORMANCE / 001" title="Inference throughput" />
            <ReactECharts option={chartOption} style={{ height: 260 }} notMerge />
            <div className="chart-foot">
              <span>HISTORICAL OBSERVATIONS</span>
              <span>UNIT: TOKENS / SECOND</span>
            </div>
          </div>

          <div className="panel health-panel">
            <div className="eyebrow">RESOURCE HEALTH / 002</div>
            <h2>Compute overview</h2>

            {[
              { label: "GPU utilization", value: averageGpuUtil },
              { label: "VRAM occupancy", value: averageVram },
              { label: "CPU utilization", value: averageCpuUtil }
            ].map((item) => (
              <div className="health-item" key={item.label}>
                <div className="health-title">
                  <span>{item.label}</span>
                  <b>{item.value === null ? "—" : `${item.value.toFixed(1)}%`}</b>
                </div>
                <div className="progress">
                  <i style={{ width: `${item.value === null ? 0 : Math.min(100, item.value)}%` }} />
                </div>
              </div>
            ))}

            <div className="health-foot">
              <ShieldAlert size={15} />
              {vramWarning
                ? "High observed VRAM occupancy. Investigate capacity headroom."
                : "Resource indicators are based on the latest available samples."}
            </div>
          </div>
        </section>

        <section className="bottom-grid">
          <div className="panel nodes-panel">
            <SectionHeading eyebrow="INFRASTRUCTURE / 003" title="Inference nodes" />
            <div className="node-table">
              <div className="table-head">
                <span>SERVER</span>
                <span>THROUGHPUT</span>
                <span>STATUS</span>
              </div>
              {latestInference.map((record: any) => {
                const throughput = Number(record.gen_throughput);
                const isActive = Number.isFinite(throughput) && throughput > 0;

                return (
                  <div className="table-row" key={record.server_id}>
                    <span className="node-name">
                      <CircleDot size={13} />
                      {record.server_id?.toUpperCase()}
                    </span>
                    <span className="mono">
                      {Number.isFinite(throughput) ? throughput.toFixed(1) : "—"}
                      <small> tok/s</small>
                    </span>
                    <span className={`node-status ${isActive ? "good" : "muted"}`}>
                      {isActive ? "ACTIVE" : "INACTIVE"}
                    </span>
                  </div>
                );
              })}
              {!latestInference.length && <EmptyState message="No inference telemetry available." />}
            </div>
          </div>

          {renderOptimizerWorkbench()}
        </section>
      </>
    );
  }

  function renderOptimizerWorkbench() {
    return (
      <div className="panel optimizer-panel">
        <div className="eyebrow">DECISION ENGINE</div>
        <h2>Allocation workbench</h2>
        <p>Configure constraints for a hypothetical optimization run.</p>

        <div className="slider-label">
          <span>Capacity budget</span>
          <b>{budget} units</b>
        </div>
        <input
          type="range"
          min="1"
          max="20"
          value={budget}
          onChange={(event) => setBudget(Number(event.target.value))}
        />

        <div className="slider-label">
          <span>Maximum per node</span>
          <b>{allocation} units</b>
        </div>
        <input
          type="range"
          min="1"
          max="10"
          value={allocation}
          onChange={(event) => setAllocation(Number(event.target.value))}
        />

        <button className="optimize-button" onClick={handleOptimize} disabled={loading}>
          {loading ? "RUNNING OPTIMIZATION..." : "RUN OPTIMIZATION"}
          <ArrowUpRight size={15} />
        </button>

        {apiError && <div className="api-error">{apiError}</div>}

        {result && (
          <div className="api-results">
            <div className="result-heading">WORKFLOW RESULT</div>
            <div className="result-line">
              <span>Validation</span>
              <b>{result.validation?.valid ? "PASSED" : "FAILED"}</b>
            </div>
            <div className="result-line">
              <span>Allocated units</span>
              <b>{result.validation?.total_allocated ?? "—"}</b>
            </div>
            <div className="result-heading">SIMULATION OUTPUT</div>
            {simulationResults.map((item: any) => (
              <div className="result-line" key={item.server_id}>
                <span>{item.server_id}</span>
                <b>{Number(item.simulated_throughput).toFixed(1)} tok/s</b>
              </div>
            ))}
            <pre className="report-output">{result.explanation}</pre>
          </div>
        )}

        <div className="optimizer-note">
          <Network size={13} />
          SIMULATION ONLY · NO INFRASTRUCTURE CHANGES
        </div>
      </div>
    );
  }


function renderLiveMonitoring() {
  return (
    <>
      <section className="metrics-grid">
        <Metric
          label="LIVE THROUGHPUT"
          value={liveLoading ? "..." : liveThroughput.toFixed(1)}
          unit=" tok/s"
          icon={Zap}
          note="Latest observed SGLang throughput"
        />

        <Metric
          label="ACTIVE SERVERS"
          value={liveActiveServers}
          unit={` / ${liveInference.length}`}
          icon={Server}
          note="Servers with positive observed throughput"
        />

        <Metric
          label="GPU UTILIZATION"
          value={liveGpuUtil === null ? "—" : liveGpuUtil.toFixed(1)}
          unit="%"
          icon={Cpu}
          note="Mean latest GPU utilization"
        />

        <Metric
          label="CPU UTILIZATION"
          value={liveCpuUtil === null ? "—" : liveCpuUtil.toFixed(1)}
          unit="%"
          icon={Activity}
          note="Mean latest node CPU utilization"
        />
      </section>

            <section className="primary-grid">
        <div className="panel chart-panel">
          <SectionHeading
            eyebrow="LIVE HISTORY / 001"
            title="Inference throughput"
          />
          <ReactECharts
            option={liveThroughputChart}
            style={{ height: 260 }}
            notMerge
          />
        </div>

        <div className="panel chart-panel">
          <SectionHeading
            eyebrow="LIVE HISTORY / 002"
            title="Inference latency"
          />
          <ReactECharts
            option={liveLatencyChart}
            style={{ height: 260 }}
            notMerge
          />
        </div>

        <div className="panel chart-panel">
          <SectionHeading
            eyebrow="LIVE HISTORY / 003"
            title="GPU utilization"
          />
          <ReactECharts
            option={liveGpuUtilChart}
            style={{ height: 260 }}
            notMerge
          />
        </div>

        <div className="panel chart-panel">
          <SectionHeading
            eyebrow="LIVE HISTORY / 004"
            title="GPU memory usage"
          />
          <ReactECharts
            option={liveGpuMemoryChart}
            style={{ height: 260 }}
            notMerge
          />
        </div>

        <div className="panel chart-panel">
          <SectionHeading
            eyebrow="LIVE HISTORY / 005"
            title="Per-GPU memory utilization"
          />
          <ReactECharts
            option={liveGpuMemoryByDeviceChart}
            style={{ height: 300 }}
            notMerge
          />
        </div>

        <div className="panel chart-panel">
          <SectionHeading
            eyebrow="LIVE HISTORY / 006"
            title="Per-GPU memory activity"
          />
          <ReactECharts
            option={liveGpuMemoryActivityByDeviceChart}
            style={{ height: 300 }}
            notMerge
          />
        </div>
      </section>

      {liveError && (
        <div className="api-error">
          Live telemetry unavailable: {liveError}
        </div>
      )}

      <section className="primary-grid">
        <div className="panel health-panel">
          <SectionHeading
            eyebrow="LIVE INFRASTRUCTURE / 001"
            title="Resource utilization"
          />

          {[
            { label: "GPU compute", value: liveGpuUtil },
            { label: "GPU memory", value: liveVram },
            { label: "CPU utilization", value: liveCpuUtil }
          ].map((item) => (
            <div className="health-item" key={item.label}>
              <div className="health-title">
                <span>{item.label}</span>
                <b>
                  {item.value === null
                    ? "—"
                    : `${item.value.toFixed(1)}%`}
                </b>
              </div>
              <div className="progress">
                <i
                  style={{
                    width: `${item.value === null
                      ? 0
                      : Math.min(100, Math.max(0, item.value))}%`
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="panel health-panel">
          <SectionHeading
            eyebrow="COLLECTOR / 002"
            title="Data freshness"
          />

          {["sglang", "gpu", "cpu"].map((type) => {
            const metric = liveFreshness[type];

            return (
              <div className="result-line" key={type}>
                <span>{type.toUpperCase()}</span>
                <b>
                  {metric
                    ? `${metric.age_seconds.toFixed(1)}s`
                    : "Unavailable"}
                </b>
                <span className={`node-status ${
                  metric?.fresh ? "good" : "warn"
                }`}>
                  {metric?.fresh ? "FRESH" : "STALE"}
                </span>
              </div>
            );
          })}

          <p className="optimizer-note">
            Freshness is based on the timestamp of the latest
            recorded sample.
          </p>

          <div className="result-line">
            <span>Last frontend fetch</span>
            <b>
              {lastLiveUpdated
                ? lastLiveUpdated.toLocaleTimeString()
                : "Waiting"}
            </b>
          </div>
        </div>
      </section>

      <div className="panel nodes-panel">
        <SectionHeading
          eyebrow="INFERENCE / 003"
          title="Live inference servers"
        />

        <div className="node-table">
          <div className="table-head">
            <span>SERVER</span>
            <span>THROUGHPUT</span>
            <span>LATENCY</span>
          </div>

          {liveInference.map((record: any) => (
            <div className="table-row" key={record.server_id}>
              <span className="node-name">
                {record.server_id}
              </span>
              <span className="mono">
                {Number(record.gen_throughput).toFixed(1)} tok/s
              </span>
              <span className="mono">
                {record.e2e_latency_avg_s == null
                  ? "—"
                  : `${Number(record.e2e_latency_avg_s).toFixed(3)} s`}
              </span>
            </div>
          ))}

          {!liveInference.length && (
            <EmptyState message="No live inference records available." />
          )}
        </div>
      </div>

      <div className="panel nodes-panel">
        <SectionHeading
          eyebrow="GPU / 004"
          title="Live GPU measurements"
        />

        <div className="node-table">
          <div className="table-head">
            <span>GPU</span>
            <span>UTILIZATION</span>
            <span>VRAM</span>
          </div>

          {liveGpu.map((record: any) => (
            <div className="table-row" key={record.gpu_id}>
              <span className="node-name">{record.gpu_id}</span>
              <span className="mono">
                {record.utilization_pct ?? "—"}%
              </span>
              <span className="mono">
                {record.memory_pct == null
                  ? "—"
                  : `${Number(record.memory_pct).toFixed(1)}%`}
              </span>
            </div>
          ))}

          {!liveGpu.length && (
            <EmptyState message="No live GPU records available." />
          )}
        </div>
      </div>
    </>
  );
}


  function renderTelemetry() {
    return (
      <>
        <section className="metrics-grid">
          <Metric label="INFERENCE RECORDS" value={inference.length} unit="" icon={Activity} note="Historical samples" />
          <Metric label="GPU RECORDS" value={gpu.length} unit="" icon={Cpu} note="Historical GPU samples" />
          <Metric label="CPU RECORDS" value={cpu.length} unit="" icon={Server} note="Historical CPU samples" />
          <Metric label="INFERENCE SERVERS" value={latestInference.length} unit="" icon={Database} note="Distinct servers" />
        </section>

        <div className="panel chart-panel">
          <SectionHeading eyebrow="TELEMETRY / 001" title="Historical throughput" />
          <ReactECharts option={chartOption} style={{ height: 280 }} notMerge />
        </div>

        <div className="panel nodes-panel">
          <SectionHeading eyebrow="INFERENCE / 002" title="Latest server measurements" />
          <div className="node-table">
            <div className="table-head">
              <span>SERVER</span><span>THROUGHPUT</span><span>QUEUE</span>
            </div>
            {latestInference.map((record: any) => (
              <div className="table-row" key={record.server_id}>
                <span className="node-name">{record.server_id}</span>
                <span className="mono">{Number(record.gen_throughput).toFixed(1)} tok/s</span>
                <span className="mono">{record.queued ?? "—"}</span>
              </div>
            ))}
            {!latestInference.length && <EmptyState message="No inference data available." />}
          </div>
        </div>

        <div className="panel nodes-panel">
          <SectionHeading eyebrow="GPU / 003" title="Latest GPU measurements" />
          <div className="node-table">
            <div className="table-head">
              <span>GPU</span><span>COMPUTE</span><span>VRAM</span>
            </div>
            {latestGpu.map((record: any, index: number) => (
              <div className="table-row" key={record.gpu_id ?? index}>
                <span className="node-name">{record.gpu_id ?? record.node_id}</span>
                <span className="mono">{record.utilization_pct ?? "—"}%</span>
                <span className="mono">{record.memory_pct ?? "—"}%</span>
              </div>
            ))}
            {!latestGpu.length && <EmptyState message="No GPU data available." />}
          </div>
        </div>
      </>
    );
  }

  function renderForecasting() {
    return (
      <>
        <section className="metrics-grid">
          <Metric label="FORECAST RECORDS" value={forecasts.length} unit="" icon={BrainCircuit} note="One-step-ahead predictions" />
          <Metric label="FORECAST METHOD" value="Selected" unit="" icon={TrendingUp} note="Chosen using validation results" />
          <Metric label="PREDICTION HORIZON" value="Next" unit="" icon={Clock3} note="Next telemetry observation" />
          <Metric label="MODEL STATUS" value={forecastLoading ? "Loading" : forecastError ? "Unavailable" : "Ready"} unit="" icon={Activity} note="Forecast data endpoint" />
        </section>

        {forecastError && <div className="api-error">{forecastError}</div>}

        <div className="panel chart-panel">
          <SectionHeading eyebrow="FORECASTING / 001" title="Observed vs predicted throughput" />
          {forecasts.length
            ? <ReactECharts option={forecastChartOption} style={{ height: 300 }} notMerge />
            : <EmptyState message="No forecast records are available." />}
          <div className="chart-foot">
            <span>OBSERVED AND NEXT-OBSERVATION PREDICTIONS</span>
            <span>TOKENS / SECOND</span>
          </div>
        </div>

        <div className="panel nodes-panel">
          <SectionHeading eyebrow="FORECASTING / 002" title="Server-level predictions" />
          <div className="node-table">
            <div className="table-head">
              <span>SERVER</span><span>OBSERVED</span><span>PREDICTED</span>
            </div>
            {forecasts.map((item: any) => (
              <div className="table-row" key={item.server_id}>
                <span className="node-name">{item.server_id}</span>
                <span className="mono">{item.gen_throughput ?? "—"}</span>
                <span className="mono">{item.predicted_next_throughput ?? "—"}</span>
              </div>
            ))}
            {!forecasts.length && <EmptyState message="Forecasts will appear here when the API returns data." />}
          </div>
          <p className="optimizer-note">
            Predictions refer to the next available telemetry observation, not a long-term forecast.
          </p>
        </div>
      </>
    );
  }

  function renderDiagnostics() {
    return (
      <>
        <section className="metrics-grid">
          <Metric label="DIAGNOSED SERVERS" value={diagnosis.length} unit="" icon={ShieldAlert} note="From the latest workflow run" />
          <Metric label="HIGH PRIORITY" value={diagnosis.filter((item: any) => String(item.recommended_action).includes("Prioritize")).length} unit="" icon={HardDrive} note="Latency and memory investigation" />
          <Metric label="MONITOR" value={diagnosis.filter((item: any) => String(item.recommended_action).includes("Monitor")).length} unit="" icon={Activity} note="Monitoring recommendations" />
          <Metric label="INACTIVE WORKLOADS" value={diagnosis.filter((item: any) => String(item.recommended_action).includes("inactive")).length} unit="" icon={Server} note="Workload investigation" />
        </section>

        <div className="panel nodes-panel">
          <SectionHeading eyebrow="DIAGNOSTICS / 001" title="Server diagnostic report" />
          {diagnosis.length ? (
            <div className="node-table">
              <div className="table-head">
                <span>SERVER</span><span>SCORE</span><span>RECOMMENDATION</span>
              </div>
              {diagnosis.map((item: any) => (
                <div className="table-row" key={item.server_id}>
                  <span className="node-name">{item.server_id}</span>
                  <span className="mono">{Number(item.diagnostic_score).toFixed(2)}</span>
                  <span className="node-status warn">{item.recommended_action}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="Run the optimizer to load the latest workflow diagnosis." />
          )}
          <p className="optimizer-note">
            Diagnostic scores are prioritization heuristics based on observed latency violations, not proof of a physical bottleneck.
          </p>
        </div>
      </>
    );
  }

  function renderOptimizer() {
    return (
      <>
        <section className="metrics-grid">
          <Metric label="CAPACITY BUDGET" value={budget} unit=" units" icon={Gauge} note="Configured optimization budget" />
          <Metric label="PER-SERVER LIMIT" value={allocation} unit=" units" icon={Server} note="Maximum allocation per server" />
          <Metric label="WORKFLOW STATUS" value={result ? (result.validation?.valid ? "Valid" : "Invalid") : "Pending"} unit="" icon={Activity} note="Latest optimization run" />
          <Metric label="ALLOCATED UNITS" value={result?.validation?.total_allocated ?? "—"} unit="" icon={Layers3} note="Latest validated allocation" />
        </section>
        <section className="bottom-grid">
          {renderOptimizerWorkbench()}
          <div className="panel nodes-panel">
            <SectionHeading eyebrow="OPTIMIZER / 002" title="Allocation decisions" />
            {result?.allocations ? (
              Object.entries(result.allocations).map(([server, units]: any) => (
                <div className="result-line" key={server}>
                  <span>{server}</span><b>{String(units)} units</b>
                </div>
              ))
            ) : (
              <EmptyState message="Run an optimization to see allocation decisions." />
            )}
          </div>
        </section>
      </>
    );
  }

  function renderSimulation() {
    const baseline = simulationResults.reduce(
      (sum: number, item: any) => sum + Number(item.baseline_throughput ?? 0),
      0
    );
    const simulated = simulationResults.reduce(
      (sum: number, item: any) => sum + Number(item.simulated_throughput ?? 0),
      0
    );

    return (
      <>
        <section className="metrics-grid">
          <Metric label="SIMULATED SERVERS" value={simulationResults.length} unit="" icon={Server} note="Latest simulation run" />
          <Metric label="BASELINE TOTAL" value={baseline.toFixed(1)} unit=" tok/s" icon={Activity} note="Baseline throughput in simulation" />
          <Metric label="SIMULATED TOTAL" value={simulated.toFixed(1)} unit=" tok/s" icon={Zap} note="Hypothetical simulated throughput" />
          <Metric label="VALIDATION" value={result ? (result.validation?.valid ? "PASSED" : "FAILED") : "Pending"} unit="" icon={ShieldAlert} note="Allocation constraint validation" />
        </section>

        <div className="panel nodes-panel">
          <SectionHeading eyebrow="SIMULATION / 001" title="Scenario results" />
          {simulationResults.length ? (
            <div className="node-table">
              <div className="table-head">
                <span>SERVER</span><span>BASELINE</span><span>SIMULATED</span>
              </div>
              {simulationResults.map((item: any) => (
                <div className="table-row" key={item.server_id}>
                  <span className="node-name">{item.server_id}</span>
                  <span className="mono">{Number(item.baseline_throughput).toFixed(1)}</span>
                  <span className="mono">{Number(item.simulated_throughput).toFixed(1)}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="Run the optimizer to generate a simulation scenario." />
          )}
          <p className="optimizer-note">
            Hypothetical simulation using configured gain assumptions. These are not measured production improvements.
          </p>
        </div>
      </>
    );
  }

  function renderExperiments() {
    return (
      <>
        <section className="metrics-grid">
          <Metric label="DATA SOURCES" value="3" unit="" icon={Database} note="Inference, GPU and CPU telemetry" />
          <Metric label="FORECAST SPLIT" value="60 / 20 / 20" unit="" icon={TrendingUp} note="Chronological train / validation / test" />
          <Metric label="SELECTED BASELINE" value="Persistence" unit="" icon={BrainCircuit} note="Selected using validation results" />
          <Metric label="DECISION MODE" value="Simulation" unit="" icon={Layers3} note="No live infrastructure control" />
        </section>

        <div className="panel nodes-panel">
          <SectionHeading eyebrow="EXPERIMENTS / 001" title="Experiment methodology" />
          <div className="result-line">
            <span>Telemetry</span>
            <b>Historical OpenInfra samples</b>
          </div>
          <div className="result-line">
            <span>Forecast target</span>
            <b>Next observed throughput</b>
          </div>
          <div className="result-line">
            <span>Validation strategy</span>
            <b>Chronological per-server split</b>
          </div>
          <div className="result-line">
            <span>Forecast selection</span>
            <b>Validation comparison</b>
          </div>
          <div className="result-line">
            <span>Optimization</span>
            <b>Linear programming</b>
          </div>
          <div className="result-line">
            <span>Simulation</span>
            <b>Hypothetical gain assumptions</b>
          </div>
        </div>

        <div className="panel nodes-panel">
          <SectionHeading eyebrow="EXPERIMENTS / 002" title="Interpretation and limitations" />
          <p>
            The forecasting experiment compared persistence, rolling-average
            and XGBoost predictions. Persistence was selected based on the
            available validation results.
          </p>
          <p>
            The optimization and simulation stages evaluate hypothetical
            capacity allocations. Simulated gains are assumption-based and
            should not be presented as measured infrastructure improvements.
          </p>
          <p>
            The current telemetry endpoint serves a collected historical
            snapshot. It is not a live streaming connection.
          </p>
        </div>
      </>
    );
  }

  const pageRenderers: Record<string, () => any> = {
    "Command Center": renderCommandCenter,
    "Live Monitoring": renderLiveMonitoring,
    "Telemetry": renderTelemetry,
    "Forecasting": renderForecasting,
    "Diagnostics": renderDiagnostics,
    "Optimizer": renderOptimizer,
    "Simulation": renderSimulation,
    "Experiments": renderExperiments
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon"><Activity size={21} /></div>
          <div>
            <div className="brand-name">TOKENSCALE</div>
            <div className="brand-sub">INFERENCE CONTROL</div>
          </div>
        </div>

        <div className="nav-caption">WORKSPACE</div>
        <nav>
          {navigation.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={`nav-item ${active === label ? "active" : ""}`}
              onClick={() => setActive(label)}
            >
              <Icon size={17} />
              <span>{label}</span>
              {active === label && <span className="nav-indicator" />}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="connection">
            <span className="live-dot" />
            API CONNECTION
          </div>
          <div className="connection-detail">
            {telemetryLoading || forecastLoading
              ? "Connecting..."
              : telemetryError
                ? "Connection failed"
                : "Backend connected"}
          </div>
          <button className="nav-item settings">
            <Settings2 size={17} /> Settings
          </button>
          <div className="version">TOKENSCALE / BUILD 0.2.0</div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            WORKSPACE <span>/</span> {active.toUpperCase()}
          </div>
          <div className="top-actions">
            <div className="environment">
              <span className="live-dot" /> SIMULATION ENVIRONMENT
            </div>
            <div className="avatar">TS</div>
          </div>
        </header>

        <div className="content">
          <section className="page-heading">
            <div>
              <div className="eyebrow">INFRASTRUCTURE / TOKENSCALE</div>
              <h1>{active}</h1>
              <p>Monitor, diagnose and optimize LLM inference infrastructure.</p>
            </div>
            <button
              className="date-button"
              onClick={() => window.location.reload()}
            >
              <RefreshCw size={14} /> Refresh snapshot
            </button>
          </section>

          <section className="status-strip">
            <div>
              <span className="live-dot" />
              {telemetryError ? "TELEMETRY UNAVAILABLE" : "TELEMETRY SNAPSHOT"}
            </div>
            <span>{latestInference.length} INFERENCE SERVERS</span>
            <span>HISTORICAL DATA</span>
            <span className="status-right">
              DECISION ENGINE <b>{result ? "EXECUTED" : "READY"}</b>
            </span>
          </section>

          {telemetryError && (
            <div className="api-error">
              Telemetry unavailable: {telemetryError}
            </div>
          )}

          {pageRenderers[active]?.()}

          <footer>
            <span>TOKENSCALE © 2026</span>
            <span>MEASURED TELEMETRY + EXPERIMENTAL SIMULATION</span>
            <span>ENGINE STATUS: READY</span>
          </footer>
        </div>
      </main>
    </div>
  );
}

export default App;