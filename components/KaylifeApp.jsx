"use client";
import React, { useEffect, useMemo, useState, memo } from "react";
import { Bell, Activity, Droplets, Thermometer, Waves, Gauge, Settings, ChevronRight, ChevronLeft, Fan, AlertTriangle, Shield, Power, Wrench } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import Image from "next/image";

// Usa el archivo provisto en /public
const LOGO_URL = "/logo k.png";

// Use a fixed locale and 12-hour clock to avoid SSR/CSR mismatch
const fmtTime = (d) => new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }).format(d);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const HISTORY_MINUTES = 24 * 60; // keep 24h of minute-resolution data

const PARAMETERS = [
  { key: "temp", label: "Temperatura", unit: "°C", min: 17, max: 32, icon: Thermometer },
  { key: "ph", label: "pH", unit: "", min: 6.5, max: 8.5, icon: Activity },
  { key: "o2", label: "Oxígeno disuelto", unit: "mg/L", min: 4, max: 10, icon: Droplets },
  { key: "turb", label: "Turbidez", unit: "NTU", min: 0, max: 50, icon: Waves },
  { key: "cond", label: "Conductividad", unit: "µS/cm", min: 100, max: 1200, icon: Gauge },
  { key: "ss", label: "Sólidos suspendidos", unit: "mg/L", min: 0, max: 100, icon: Waves },
  { key: "nh3", label: "Amonia (NH3)", unit: "mg/L", min: 0, max: 2, icon: Droplets },
];
const SENSORS = Array.from({ length: 10 }, (_, i) => `Sensor ${i + 1}`);
const FARMS = Array.from({ length: 10 }, (_, i) => `Granja ${i + 1}`);
// Generadores (cada uno con 2 granjas vinculadas)
const GENERATORS = [
  { id: "Generador A", farms: ["Granja 1", "Granja 2"], pos: { left: "22%", top: "48%" } },
  { id: "Generador B", farms: ["Granja 3", "Granja 4"], pos: { left: "35%", top: "36%" } },
  { id: "Generador C", farms: ["Granja 5", "Granja 6"], pos: { left: "58%", top: "42%" } },
  { id: "Generador D", farms: ["Granja 7", "Granja 8"], pos: { left: "72%", top: "55%" } },
];
const ELECTRIC_COLS = [
  { key: "gm1", label: "GM1" },
  { key: "gm2", label: "GM2" },
  { key: "gm3", label: "GM3" },
  { key: "gm4", label: "GM4" },
  { key: "ol1", label: "OL1" },
  { key: "ol2", label: "OL2" },
  { key: "ol3", label: "OL3" },
  { key: "ol4", label: "OL4" },
  { key: "aire1", label: "Aireador 1" },
  { key: "aire2", label: "Aireador 2" },
  { key: "aire3", label: "Aireador 3" },
  { key: "aire4", label: "Aireador 4" },
  { key: "op1", label: "OP Mod 1" },
  { key: "op2", label: "OP Mod 2" },
  { key: "op3", label: "OP Mod 3" },
  { key: "op4", label: "OP Mod 4" },
  { key: "esd", label: "ESD" },
  { key: "tc", label: "TC" },
];

function makeInitialSeries({ min, max }, points = 60) {
  const arr = [];
  let v = (min + max) / 2 + (Math.random() - 0.5) * (max - min) * 0.2;
  for (let i = points - 1; i >= 0; i--) {
    v += (Math.random() - 0.5) * (max - min) * 0.03;
    v = clamp(v, min - (max - min) * 0.25, max + (max - min) * 0.25);
    arr.push({ t: new Date(Date.now() - i * 60_000), v: +v.toFixed(2) });
  }
  return arr;
}
function step(prev, { min, max }) {
  let v = prev.v + (Math.random() - 0.5) * (max - min) * 0.04;
  v = clamp(v, min - (max - min) * 0.25, max + (max - min) * 0.25);
  return { t: new Date(), v: +v.toFixed(2) };
}
function statusFor(key, value) {
  const p = PARAMETERS.find((x) => x.key === key);
  const warn = (p.max - p.min) * 0.1;
  if (value < p.min - warn || value > p.max + warn) return "critical"; // rojo
  if (value < p.min || value > p.max) return "alert"; // amarillo (solo para vista Agua)
  return "ok"; // verde
}

const MetricCard = memo(function MetricCard({ p, data }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-slate-500">{p.label}</div>
        <p.icon className="w-4 h-4 text-slate-400" />
      </div>
      <div className="h-12 mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id={`grad-${p.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="v" strokeWidth={2} stroke="#60a5fa" fill={`url(#grad-${p.key})`} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

function MatrixDots({ rows, cols, data }) {
  return (
    <div className="overflow-auto">
      {/* Tabla con spacing uniforme y celdas centradas para mayor simetría */}
      <table className="min-w-full text-sm table-fixed border-separate border-spacing-x-3 border-spacing-y-3">
        <thead>
          <tr className="text-left text-slate-500">
            <th className="py-1 pr-4 w-40">Nombre</th>
            {cols.map((c) => {
              const iconForKey = (key) => {
                if (key.startsWith("aire")) return Fan; // Aireadores
                if (key.startsWith("ol")) return AlertTriangle; // Overload
                if (key.startsWith("gm")) return Shield; // Guardamotor
                if (key.startsWith("op")) return Wrench; // Operación/Modo
                if (key === "esd") return Power; // Emergency Shutdown
                if (key === "tc") return Gauge; // Transformador de corriente
                return Activity; // Fallback
              };
              const Icon = iconForKey(c.key);
              const num = (c.key.match(/\d+$/) || [""])[0];
              return (
                <th key={c.key} className="py-1 text-center font-normal w-10" title={c.label}>
                  <div className="flex items-center justify-center gap-1">
                    <Icon className="w-4 h-4 text-slate-400" />
                    {num && <span className="text-xs text-slate-400">{num}</span>}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={r} className={idx % 2 ? "bg-slate-50/60" : "bg-white/40"}>
              <td className="py-1 pr-4 font-medium whitespace-nowrap w-40">{r}</td>
              {cols.map((c) => {
                const st = data[r]?.[c.key];
                const cls = st === "ok" ? "bg-emerald-500" : "bg-rose-500";
                return (
                  <td key={c.key} className="p-0 text-center">
                    <div suppressHydrationWarning className={`w-5 h-5 rounded-md mx-auto ${cls}`}></div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MatrixWaterDetailed({ rows, cols, data, onCellClick }) {
  return (
    <div className="overflow-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-slate-500">
            <th className="py-2 pr-4">Sensor</th>
            {cols.map((c) => (
              <th key={c.key} className="py-2 px-2 whitespace-nowrap">{c.label}{c.unit ? ` (${c.unit})` : ""}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={r} className={idx % 2 ? "bg-slate-50/60" : "bg-white/40"}>
              <td className="py-2 pr-4 font-medium whitespace-nowrap">{r}</td>
              {cols.map((c) => {
                const v = data[r]?.[c.key];
                const st = statusFor(c.key, v);
                const cls = st === "ok"
                  ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                  : st === "alert"
                  ? "bg-amber-100 text-amber-800 border-amber-200"
                  : "bg-rose-100 text-rose-700 border-rose-300";
              return (
                <td key={c.key} className="py-2 px-2">
                    <button suppressHydrationWarning onClick={() => onCellClick?.(r, c.key)} className={`w-full px-2 py-1 rounded-lg border ${cls} text-center transition shadow-sm hover:shadow`}>{typeof v === "number" ? v : ""}</button>
                </td>
              );
            })}
          </tr>
        ))}
        </tbody>
      </table>
    </div>
  );
}

export default function KaylifeApp() {
  const [collapsed, setCollapsed] = useState(false);
  const [page, setPage] = useState("dashboard"); // "dashboard" | "agua"

  const [series, setSeries] = useState(() => {
    const o = {}; PARAMETERS.forEach((p) => (o[p.key] = makeInitialSeries(p, HISTORY_MINUTES))); return o;
  });
  // Per-sensor time series for each parameter
  const [seriesBySensor, setSeriesBySensor] = useState(() => {
    const obj = {};
    SENSORS.forEach((sid) => {
      obj[sid] = {};
      PARAMETERS.forEach((p) => {
        obj[sid][p.key] = makeInitialSeries(p, HISTORY_MINUTES);
      });
    });
    return obj;
  });
  useEffect(() => {
    const id = setInterval(() => {
      setSeries((prev) => {
        const n = { ...prev };
        PARAMETERS.forEach((p) => {
          const arr = prev[p.key];
          n[p.key] = [...arr.slice(1), step(arr[arr.length - 1], p)];
        });
        return n;
      });
      // Update per-sensor series
      setSeriesBySensor((prev) => {
        const next = {};
        SENSORS.forEach((sid) => {
          next[sid] = {};
          PARAMETERS.forEach((p) => {
            const arr = prev[sid][p.key];
            next[sid][p.key] = [...arr.slice(1), step(arr[arr.length - 1], p)];
          });
        });
        return next;
      });
    }, 3000);
    return () => clearInterval(id);
  }, []);

  const latest = useMemo(() => Object.fromEntries(
    PARAMETERS.map((p) => [p.key, series[p.key]?.[series[p.key].length - 1]?.v ?? 0])
  ), [series]);

  const CHART_POINTS = 120; // reduce points for smoother charts
  const chartSeries = useMemo(() => {
    const o = {};
    PARAMETERS.forEach((p) => {
      const arr = series[p.key] ?? [];
      o[p.key] = arr.slice(Math.max(0, arr.length - CHART_POINTS));
    });
    return o;
  }, [series]);

  const waterMatrixColors = useMemo(() => {
    const m = {};
    SENSORS.forEach((sid, i) => {
      m[sid] = {};
      PARAMETERS.forEach((p) => {
        const jitter = (Math.sin(i + latest[p.key]) + 1) * 0.02 * (p.max - p.min);
        const val = clamp(latest[p.key] + (Math.random() - 0.5) * jitter, p.min - (p.max - p.min) * 0.2, p.max + (p.max - p.min) * 0.2);
        m[sid][p.key] = statusFor(p.key, val) === "critical" ? "critical" : "ok";
      });
    });
    return m;
  }, [latest]);

  // Latest values per sensor and parameter
  const latestBySensor = useMemo(() => {
    const m = {};
    SENSORS.forEach((sid) => {
      m[sid] = {};
      PARAMETERS.forEach((p) => {
        const arr = seriesBySensor[sid]?.[p.key] ?? [];
        m[sid][p.key] = arr[arr.length - 1]?.v ?? 0;
      });
    });
    return m;
  }, [seriesBySensor]);

  const [electricMatrixColors, setElectricMatrixColors] = useState(() => {
    const m = {};
    FARMS.forEach((g) => {
      m[g] = {};
      ELECTRIC_COLS.forEach((c) => {
        m[g][c.key] = "ok"; // deterministic initial state for SSR/CSR match
      });
    });
    return m;
  });

  useEffect(() => {
    const states = ["ok", "ok", "ok", "critical"];
    const generate = () => {
      const m = {};
      FARMS.forEach((g) => {
        m[g] = {};
        ELECTRIC_COLS.forEach((c) => {
          m[g][c.key] = states[Math.floor(Math.random() * states.length)];
        });
      });
      return m;
    };
    // generate once after mount to avoid hydration mismatch
    setElectricMatrixColors(generate());
    // Optional: update periodically to simulate live changes
    const id = setInterval(() => setElectricMatrixColors(generate()), 8000);
    return () => clearInterval(id);
  }, []);

  const waterDetailed = useMemo(() => {
    const m = {};
    SENSORS.forEach((sid) => {
      m[sid] = {};
      PARAMETERS.forEach((p) => {
        const val = latestBySensor[sid]?.[p.key] ?? latest[p.key];
        m[sid][p.key] = +Number(val).toFixed(p.key === "ph" ? 2 : 1);
      });
    });
    return m;
  }, [latestBySensor, latest]);

  const MAP_PLACEHOLDER =
    "data:image/svg+xml;base64," +
    btoa(`<?xml version='1.0'?>
<svg xmlns='http://www.w3.org/2000/svg' width='800' height='260'>
 <defs>
  <linearGradient id='bg' x1='0' y1='0' x2='0' y2='1'>
   <stop offset='0' stop-color='#e0f2fe'/>
   <stop offset='1' stop-color='#e2e8f0'/>
  </linearGradient>
 </defs>
 <rect width='100%' height='100%' fill='url(#bg)'/>
 <g opacity='0.35' stroke='#64748b'>
  <path d='M0 40 H800 M0 100 H800 M0 160 H800 M0 220 H800'/>
  <path d='M100 0 V260 M260 0 V260 M420 0 V260 M580 0 V260'/>
 </g>
 <circle cx='220' cy='120' r='8' fill='#22c55e'/>
 <circle cx='260' cy='80' r='8' fill='#22c55e'/>
 <circle cx='300' cy='140' r='8' fill='#f59e0b'/>
 <circle cx='460' cy='110' r='8' fill='#ef4444'/>
 <text x='20' y='30' fill='#334155' font-family='sans-serif' font-size='14'>Mapbox (placeholder)</text>
</svg>`);

  const TopMetrics = () => {
    const [startIndex, setStartIndex] = useState(0);
    const visibleCount = 4; // Changed from 5 to 4
    
    const goPrevMetric = () => {
      setStartIndex((prev) => (prev - 1 + PARAMETERS.length) % PARAMETERS.length);
    };
    
    const goNextMetric = () => {
      setStartIndex((prev) => (prev + 1) % PARAMETERS.length);
    };
    
    const visibleParams = [];
    for (let i = 0; i < visibleCount; i++) {
      visibleParams.push(PARAMETERS[(startIndex + i) % PARAMETERS.length]);
    }
    
    return (
      <section className="space-y-2">
        <div className="flex justify-end gap-2">
          <button onClick={goPrevMetric} className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-100" aria-label="Anterior">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={goNextMetric} className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-100" aria-label="Siguiente">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {visibleParams.map((p) => (
            <MetricCard key={p.key} p={p} data={chartSeries[p.key]} />
          ))}
        </div>
      </section>
    );
  };

  const [weather, setWeather] = useState(() => ({
    temp: 27,
    wind: 6,
    rain: (0).toFixed(2),
    humidity: 70,
    pressure: 1014,
  }));

  useEffect(() => {
    setWeather({
      temp: Math.round((latest.temp ?? 24) + 3),
      wind: 5 + Math.floor((latest.o2 ?? 6) % 4),
      rain: Number(((latest.turb ?? 10) % 2)).toFixed(2),
      humidity: 60 + Math.round(((latest.cond ?? 200) % 25)),
      pressure: 1010 + Math.round(((latest.ph ?? 7) % 8)),
    });
  }, [latest]);

  const DashboardView = () => (
    <main className="flex-1 p-4 sm:p-6 space-y-6">
      <TopMetrics />
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <img src={MAP_PLACEHOLDER} alt="Mapbox placeholder" className="w-full h-[260px] object-cover" />
        </div>
         <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
           <div className="flex items-center justify-between mb-3">
             <h3 className="font-semibold">Matriz de sensores de calidad de agua</h3>
             <div className="text-xs text-slate-500 flex gap-3">
               <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"/> Normal</span>
               <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"/> Alerta</span>
               <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-rose-500"/> Crítico</span>
             </div>
           </div>
           <MatrixWaterDetailed rows={SENSORS} cols={PARAMETERS} data={waterDetailed} />
         </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Matriz de alarmas eléctricas</h3>
            <div className="text-xs text-slate-500 flex gap-3">
              <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"/> Normal</span>
              <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-rose-500"/> Falla</span>
            </div>
          </div>
          <MatrixDots rows={FARMS} cols={ELECTRIC_COLS} data={electricMatrixColors} />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
          <h3 className="font-semibold mb-2">Weather conditions</h3>
          <div className="divide-y divide-slate-200 text-sm">
            <div className="flex items-center justify-between py-2"><span>Temperatura ambiente</span><strong>{weather.temp} °C</strong></div>
            <div className="flex items-center justify-between py-2"><span>Viento</span><strong>{weather.wind} km/h</strong></div>
            <div className="flex items-center justify-between py-2"><span>Lluvia (24h)</span><strong>{weather.rain} mm</strong></div>
            <div className="flex items-center justify-between py-2"><span>Humedad</span><strong>{weather.humidity} %</strong></div>
            <div className="flex items-center justify-between py-2"><span>Presión</span><strong>{weather.pressure} hPa</strong></div>
          </div>
        </div>
      </section>

      {/* Sección inferior: leyenda debajo de la matriz */}
      <section className="grid grid-cols-1 gap-6">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
          <h3 className="font-semibold mb-2">Leyenda</h3>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2"><Shield className="w-4 h-4 text-slate-500" /> Guardamotor (GM)</li>
            <li className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-slate-500" /> Overload (OL)</li>
            <li className="flex items-center gap-2"><Fan className="w-4 h-4 text-slate-500" /> Aireador</li>
            <li className="flex items-center gap-2"><Wrench className="w-4 h-4 text-slate-500" /> Modo de Operación (OP)</li>
            <li className="flex items-center gap-2"><Power className="w-4 h-4 text-slate-500" /> ESD (Emergencia)</li>
            <li className="flex items-center gap-2"><Gauge className="w-4 h-4 text-slate-500" /> TC (Transformador de Corriente)</li>
          </ul>
          <div className="text-xs text-slate-500 mt-3 flex gap-3">
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"/> Normal</span>
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-rose-500"/> Falla</span>
          </div>
        </div>
      </section>
    </main>
  );

  const [selectedParam, setSelectedParam] = useState(PARAMETERS[0].key);
  const [selectedSensor, setSelectedSensor] = useState(SENSORS[0]);
  const [selectedRangeHours, setSelectedRangeHours] = useState(2);
  const [electroNav, setElectroNav] = useState(null); // navegación dirigida desde Notificaciones
  const sel = PARAMETERS.find((p) => p.key === selectedParam);
  const goPrevParam = () => {
    const i = PARAMETERS.findIndex((p) => p.key === selectedParam);
    const prev = (i - 1 + PARAMETERS.length) % PARAMETERS.length;
    setSelectedParam(PARAMETERS[prev].key);
  };
  const goNextParam = () => {
    const i = PARAMETERS.findIndex((p) => p.key === selectedParam);
    const next = (i + 1) % PARAMETERS.length;
    setSelectedParam(PARAMETERS[next].key);
  };

  const WaterView = () => {
    const source = seriesBySensor[selectedSensor]?.[selectedParam] ?? series[selectedParam];
    const cutoff = Date.now() - selectedRangeHours * 3600 * 1000;
    const chartData = (source ?? []).filter((d) => new Date(d.t).getTime() >= cutoff);
    const ranges = [2, 4, 8, 12, 24];
    return (
    <main className="flex-1 p-4 sm:p-6 space-y-6">
      <TopMetrics />
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Tendencia en tiempo real — {sel.label} — {selectedSensor}</h2>
          <div className="flex items-center gap-2">
            <button onClick={goPrevParam} className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-100" aria-label="Anterior"><ChevronLeft className="w-4 h-4"/></button>
            {PARAMETERS.map((p) => (
              <button key={p.key} onClick={() => setSelectedParam(p.key)} className={`px-3 py-1.5 rounded-lg text-sm border transition ${selectedParam === p.key ? "bg-slate-900 text-white border-slate-900" : "bg-white hover:bg-slate-100 border-slate-200"}`}>
                {p.label}
              </button>
            ))}
            <button onClick={goNextParam} className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-100" aria-label="Siguiente"><ChevronRight className="w-4 h-4"/></button>
          </div>
        </div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs text-slate-500">Rango:</span>
          {ranges.map((h) => (
            <button key={h} onClick={() => setSelectedRangeHours(h)} className={`px-2 py-1 rounded-md text-xs border transition ${selectedRangeHours === h ? "bg-slate-900 text-white border-slate-900" : "bg-white hover:bg-slate-100 border-slate-200"}`}>
              {h}h
            </button>
          ))}
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey={(d) => fmtTime(new Date(d.t))} tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip labelFormatter={(l) => `Hora: ${l}`} formatter={(v) => [v, sel.unit ? `${sel.label} (${sel.unit})` : sel.label]} />
              <Line type="monotone" dataKey="v" stroke="#2563eb" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Matriz de sensores de calidad de agua</h3>
          <div className="text-xs text-slate-500 flex gap-3">
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"/> Normal</span>
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"/> Alerta</span>
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-rose-500"/> Crítico</span>
          </div>
        </div>
        <MatrixWaterDetailed rows={SENSORS} cols={PARAMETERS} data={waterDetailed} onCellClick={(sensorId, key) => { setSelectedSensor(sensorId); setSelectedParam(key); }} />
      </section>
    </main>
    );
  };

  const ElectricalView = ({ initialGenIndex = 0, highlight }) => {
    const [selectedGenIndex, setSelectedGenIndex] = useState(initialGenIndex);
    useEffect(() => { setSelectedGenIndex(initialGenIndex); }, [initialGenIndex]);
    const gen = GENERATORS[selectedGenIndex];
    const farmA = gen.farms[0];
    const farmB = gen.farms[1];
    const onColor = "bg-emerald-500";
    const offColor = "bg-rose-500";
    const stateLabel = (st) => (st === "ok" ? "ON" : "OFF");

    // Utilizamos electricMatrixColors para poblar estados por granja
    const statesA = electricMatrixColors[farmA] || {};
    const statesB = electricMatrixColors[farmB] || {};
    const Aireadores = ({ title, states, highlight }) => (
      <div className="rounded-2xl border border-slate-200 bg-white/80 backdrop-blur shadow-sm p-4">
        <h3 className="font-semibold mb-2">{title}</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500"><th className="py-2">Aireador</th><th className="py-2">Estado</th></tr>
          </thead>
          <tbody>
            {[1,2,3,4].map((i) => {
              const k = `aire${i}`;
              const st = states[k] || "ok";
              const isHi = highlight && highlight.farm === title && highlight.key === k;
              return (
                <tr key={k} className={`border-t border-slate-100 ${isHi ? "ring-2 ring-indigo-400" : ""}`}>
                  <td className="py-2 flex items-center gap-2"><span className={`w-3 h-3 rounded-full ${st === "ok" ? onColor : offColor} ${isHi ? "animate-pulse" : ""}`}></span> Aireador {i}</td>
                  <td className="py-2"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${st === "ok" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"}`}>{stateLabel(st)}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );

    const deriveMotorMode = (index, states) => {
      const aireKey = `aire${index}`;
      const opKey = `op${index}`; // OP Mod i
      const aireOn = (states[aireKey] || "ok") === "ok";
      const opOk = (states[opKey] || "ok") === "ok";
      if (!aireOn) return "Apagado"; // aireador OFF
      if (aireOn && opOk) return "Automático"; // aireador ON y modo OK
      return "Manual"; // aireador ON pero OP en falla
    };
    const ModoOperacion = ({ states, title, highlight }) => {
      const colorFor = (m) => m === "Automático" ? "bg-emerald-500" : m === "Apagado" ? "bg-slate-400" : "bg-amber-400";
      return (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
          <h3 className="font-semibold mb-2">{title}</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500"><th className="py-2">Motor</th><th className="py-2">Estatus</th></tr>
            </thead>
            <tbody>
              {[1,2,3,4].map((i) => {
                const m = deriveMotorMode(i, states);
                const k = `op${i}`;
                const isHi = highlight && highlight.farm === title && highlight.key === k;
                return (
                  <tr key={i} className={`border-t border-slate-100 ${isHi ? "ring-2 ring-indigo-400" : ""}`}>
                    <td className="py-2 flex items-center gap-2"><span className={`w-3 h-3 rounded-full ${colorFor(m)} ${isHi ? "animate-pulse" : ""}`}></span> Motor {i}</td>
                    <td className="py-2">{m}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    };

    const Protecciones = ({ states, title, highlight }) => (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
        <h3 className="font-semibold mb-2">{title}</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500"><th className="py-2">Elemento</th><th className="py-2">Estado</th></tr>
          </thead>
          <tbody>
            {[1,2,3,4].map((i) => {
              const ok = (states[`ol${i}`] || "ok") === "ok";
              const k1 = `Overload ${i}`;
              const isHi = highlight && highlight.farm === title && highlight.key === `ol${i}`;
              return (
                <tr key={k1} className={`border-t border-slate-100 ${isHi ? "ring-2 ring-indigo-400" : ""}`}>
                  <td className="py-2 flex items-center gap-2"><span className={`w-3 h-3 rounded-full ${ok ? onColor : offColor} ${isHi ? "animate-pulse" : ""}`}></span> {k1}</td>
                  <td className="py-2"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${ok ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"}`}>{ok ? "ON" : "OFF"}</span></td>
                </tr>
              );
            })}
            {[1,2,3,4].map((i) => {
              const ok = (states[`gm${i}`] || "ok") === "ok";
              const k2 = `Guardamotor ${i}`;
              const isHi = highlight && highlight.farm === title && highlight.key === `gm${i}`;
              return (
                <tr key={k2} className={`border-t border-slate-100 ${isHi ? "ring-2 ring-indigo-400" : ""}`}>
                  <td className="py-2 flex items-center gap-2"><span className={`w-3 h-3 rounded-full ${ok ? onColor : offColor} ${isHi ? "animate-pulse" : ""}`}></span> {k2}</td>
                  <td className="py-2"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${ok ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"}`}>{ok ? "ON" : "OFF"}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );

    const GenParams = () => (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[
            { k: "pinst", label: "Total watts/hora", v: `${(90 + Math.round(Math.random()*50))} kW/h` },
            { k: "pact", label: "Potencia Activa", v: `${(40 + Math.round(Math.random()*15))} kW` },
            { k: "papp", label: "Potencia Aparente", v: `${(50 + Math.round(Math.random()*20))} kVA` },
            { k: "preact", label: "Potencia Reactiva", v: `${(20 + Math.round(Math.random()*10))} kVAR` },
            { k: "pf", label: "Factor de Potencia (PF)", v: `${(0.85 + Math.random()*0.1).toFixed(2)}` },
            { k: "volt", label: "Voltaje [V] L-L / L-N / Batería", v: `${300 + Math.round(Math.random()*30)} / ${200 + Math.round(Math.random()*20)} / ${440 + Math.round(Math.random()*20)}` },
            { k: "freq", label: "Frecuencia (Hz)", v: `${(150 + Math.round(Math.random()*5))} Hz` },
            { k: "curr", label: "Corriente (A) — TC", v: `${(900 + Math.round(Math.random()*400))} A` },
            { k: "fuel", label: "Nivel Combustible (%)", v: `${(20 + Math.round(Math.random()*70))} %` },
            { k: "rpm", label: "Velocidad (RPM)", v: `${(2800 + Math.round(Math.random()*400))} RPM` },
            { k: "press", label: "Presión Aceite", v: `${(10 + Math.round(Math.random()*6))} kPa` },
            { k: "temp", label: "Temperatura del motor", v: `${(250 + Math.round(Math.random()*40))} °C` },
            { k: "op", label: "Horas de operación acumuladas", v: `${(20 + Math.round(Math.random()*40))} H` },
          ].map((i) => (
            <div key={i.k} className="rounded-xl border border-slate-200 bg-white p-2 text-center">
              <div className="text-xs text-slate-500">{i.label}</div>
              <div className="text-sm font-semibold mt-1">{i.v}</div>
            </div>
          ))}
        </div>
      </div>
    );

    return (
      <main className="flex-1 p-4 sm:p-6 space-y-6">
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden relative">
            <img src={MAP_PLACEHOLDER} alt="Mapbox placeholder" className="w-full h-[260px] object-cover" />
            {GENERATORS.map((g, idx) => (
              <button key={g.id} onClick={() => setSelectedGenIndex(idx)}
                style={{ position: "absolute", left: g.pos.left, top: g.pos.top }}
                className={`w-6 h-6 rounded-full border-2 ${idx === selectedGenIndex ? "border-slate-900" : "border-slate-300"} bg-emerald-500 shadow hover:scale-105 transition`}
                aria-label={`Seleccionar ${g.id}`}>
              </button>
            ))}
            <div className="absolute bottom-2 left-2 text-xs px-2 py-1 rounded bg-white/80 border border-slate-200">{gen.id}</div>
          </div>
          <GenParams />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Aireadores title={farmA} states={statesA} highlight={highlight} />
          <Aireadores title={farmB} states={statesB} highlight={highlight} />
        </section>
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ModoOperacion title={farmA} states={statesA} highlight={highlight} />
          <ModoOperacion title={farmB} states={statesB} highlight={highlight} />
        </section>
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Protecciones title={farmA} states={statesA} highlight={highlight} />
          <Protecciones title={farmB} states={statesB} highlight={highlight} />
        </section>
      </main>
    );
  };

  // Notificaciones / Alarmas
  const NotificationsView = () => {
    const alarms = [
      { id: 1, section: "agua", caja: 3, fecha: "7/10/2025", hora: "11:32 am", desc: "Concentración baja de oxígeno", paramKey: "o2" },
      { id: 2, section: "electrico", caja: 7, fecha: "7/10/2025", hora: "8:00 am", desc: "Motor 3 se cambió a Manual", highlightKey: "op3" },
      { id: 3, section: "electrico", caja: 2, fecha: "7/10/2025", hora: "4:30 am", desc: "Overload 3 se activó", highlightKey: "ol3" },
      { id: 4, section: "agua", caja: 5, fecha: "6/10/2025", hora: "4:30 am", desc: "pH en niveles altos", paramKey: "ph" },
      { id: 5, section: "electrico", caja: 4, fecha: "6/10/2025", hora: "10:27 pm", desc: "Guardamotor 2 se activó", highlightKey: "gm2" },
      { id: 6, section: "electrico", caja: 1, fecha: "6/10/2025", hora: "8:15 pm", desc: "Aireador 4 se activó", highlightKey: "aire4" },
    ];
    const countAgua = alarms.filter(a => a.section === "agua").length;
    const countElec = alarms.filter(a => a.section === "electrico").length;

    const navigateToIssue = (a) => {
      if (a.section === "agua") {
        setSelectedSensor(`Sensor ${a.caja}`);
        setSelectedParam(a.paramKey || PARAMETERS[0].key);
        setPage("agua");
        return;
      }
      // eléctrico: mapear caja (granja) → índice de generador
      const genIdx = Math.max(0, Math.min(GENERATORS.length - 1, Math.floor((a.caja - 1) / 2)));
      setElectroNav({ initialGenIndex: genIdx, highlight: { farm: `Granja ${a.caja}`, key: a.highlightKey } });
      setPage("electrico");
    };

    return (
      <main className="flex-1 p-4 sm:p-6 space-y-6">
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 text-center">
            <div className="text-xs text-slate-500">Notificaciones eléctricas</div>
            <div className="text-3xl font-semibold mt-1">{countElec}</div>
          </div>
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 text-center">
            <div className="text-xs text-slate-500">Notificaciones Calidad de Agua</div>
            <div className="text-3xl font-semibold mt-1">{countAgua}</div>
          </div>
        </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="p-4">
            <h3 className="font-semibold">Notificaciones de alarmas</h3>
          </div>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-2 px-4">Sección</th>
                  <th className="py-2 px-4">Caja</th>
                  <th className="py-2 px-4">Fecha</th>
                  <th className="py-2 px-4">Hora</th>
                  <th className="py-2 px-4">Descripción</th>
                </tr>
              </thead>
              <tbody>
                {alarms.map((a, i) => (
                  <tr key={a.id} className={i % 2 ? "bg-violet-100/40" : "bg-violet-200/30"}>
                    <td className="py-3 px-4 whitespace-nowrap">{a.section === "agua" ? "Monitoreo agua" : "Eléctrico"}</td>
                    <td className="py-3 px-4">{a.caja}</td>
                    <td className="py-3 px-4">{a.fecha}</td>
                    <td className="py-3 px-4">{a.hora}</td>
                    <td className="py-3 px-4">
                      <button onClick={() => navigateToIssue(a)} className="underline text-indigo-600 hover:text-indigo-800">
                        {a.desc}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 text-xs text-slate-500 flex items-center justify-between">
            <span>1-6 de {alarms.length}</span>
            <div className="flex gap-2">
              <button className="px-2 py-1 rounded border border-slate-200 bg-white">‹</button>
              <button className="px-2 py-1 rounded border border-slate-200 bg-white">›</button>
            </div>
          </div>
        </section>
      </main>
    );
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-sky-50 via-cyan-50 to-teal-100 text-slate-800 flex flex-col">
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
        <div className="flex items-center gap-2 px-4 sm:px-6 h-14">
          <button className="p-2 rounded-xl hover:bg-slate-100 transition" onClick={() => setCollapsed((v) => !v)} aria-label="Toggle menu">
            <ChevronRight className={`w-5 h-5 transition-transform ${collapsed ? "rotate-180" : ""}`} />
          </button>
          <div className="flex items-center">
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 animate-pulse">Live Data</span>
          </div>
          <div className="ml-auto flex items-center gap-3 text-slate-500">
            <div className="text-xs">Actualizado: {fmtTime(new Date())}</div>
            <button className="p-2 rounded-xl hover:bg-slate-100 transition" aria-label="Notificaciones"><Bell className="w-5 h-5"/></button>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-400 to-indigo-500" />
          </div>
        </div>
      </header>

      <div className="flex flex-1 items-stretch">
        <aside className={`relative shrink-0 transition-all duration-300 ease-in-out border-r border-slate-800 bg-slate-900 ${collapsed ? "w-16" : "w-64"}`}>
          {/* Brand inside sidebar */}
          <div className="px-3 py-3 border-b border-slate-800 text-slate-100">
            <div className="flex items-center gap-2">
              <Image src={LOGO_URL} width={24} height={24} alt="Kaylife logo" className="object-contain" />
              <span className={`font-semibold tracking-wide ${collapsed ? "hidden" : "inline"}`}>Kaylife</span>
            </div>
          </div>
          <nav className="p-3">
            {[{ label: "Dashboard", icon: Activity, key: "dashboard" }, { label: "Calidad de Agua", icon: Droplets, key: "agua" }, { label: "Eléctrico", icon: Gauge, key: "electrico" }, { label: "Alarmas", icon: Activity, key: "alarmas" }, { label: "Configuración", icon: Settings, key: "config" },].map((item) => (
              <button
                key={item.key}
                title={item.label}
                onClick={() => setPage(item.key)}
                className={`w-full flex items-center ${collapsed ? "justify-center gap-0" : "gap-3"} px-3 py-2 rounded-xl hover:bg-slate-800 mb-1 transition ${page === item.key ? "bg-slate-800" : ""}`}
              >
                <item.icon className="w-5 h-5 text-slate-200" />
                <span className={`text-sm text-slate-200 ${collapsed ? "hidden" : "inline"}`}>{item.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        {page === "dashboard" ? <DashboardView /> : page === "agua" ? <WaterView /> : page === "electrico" ? <ElectricalView initialGenIndex={electroNav?.initialGenIndex ?? 0} highlight={electroNav?.highlight} /> : page === "alarmas" ? <NotificationsView /> : (
          <main className="flex-1 p-6"><div className="rounded-2xl border border-slate-200 bg-white/80 p-6">Sección en construcción</div></main>
        )}
      </div>

      <footer className="text-xs text-slate-500 px-6 py-4">© {new Date().getFullYear()} Kaylife — Demo SPA (Dashboard + Calidad de agua)</footer>
    </div>
  );
}
