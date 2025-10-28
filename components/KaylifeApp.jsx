"use client";
import React, { useEffect, useMemo, useState } from "react";
import { Bell, Activity, Droplets, Thermometer, Waves, Gauge, Settings, ChevronRight } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import Image from "next/image";

const LOGO_URL = "/log_or.svg";

const fmtTime = (d) => new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(d);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const PARAMETERS = [
  { key: "temp", label: "Temperatura", unit: "°C", min: 17, max: 32, icon: Thermometer },
  { key: "ph", label: "pH", unit: "", min: 6.5, max: 8.5, icon: Activity },
  { key: "o2", label: "Oxígeno disuelto", unit: "mg/L", min: 4, max: 10, icon: Droplets },
  { key: "turb", label: "Turbidez", unit: "NTU", min: 0, max: 50, icon: Waves },
  { key: "cond", label: "Conductividad", unit: "µS/cm", min: 100, max: 1200, icon: Gauge },
];
const SENSORS = Array.from({ length: 10 }, (_, i) => `Sensor ${i + 1}`);
const FARMS = Array.from({ length: 10 }, (_, i) => `Granja ${i + 1}`);
const ELECTRIC_COLS = [
  { key: "gm1", label: "GM1" },
  { key: "gm2", label: "GM2" },
  { key: "ol1", label: "OL1" },
  { key: "ol2", label: "OL2" },
  { key: "aire1", label: "Aireador 1" },
  { key: "aire2", label: "Aireador 2" },
  { key: "op1", label: "Op. Mod 1" },
  { key: "op2", label: "Op. Mod 2" },
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

function MetricCard({ p, data }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 backdrop-blur p-4 shadow-sm hover:shadow-md transition">
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
}

function MatrixDots({ rows, cols, data }) {
  return (
    <div className="overflow-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-slate-500">
            <th className="py-2 pr-4">Nombre</th>
            {cols.map((c) => (
              <th key={c.key} className="py-2 px-2 whitespace-nowrap">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={r} className={idx % 2 ? "bg-slate-50/60" : "bg-white/40"}>
              <td className="py-2 pr-4 font-medium whitespace-nowrap">{r}</td>
              {cols.map((c) => {
                const st = data[r]?.[c.key];
                const cls = st === "ok" ? "bg-emerald-500" : "bg-rose-500";
                return (
                  <td key={c.key} className="py-2 px-2">
                    <div className={`w-6 h-6 rounded ${cls}`}></div>
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
                  : "bg-rose-100 text-rose-700 border-rose-300 animate-[pulse_1.2s_ease-in-out_infinite]";
                return (
                  <td key={c.key} className="py-2 px-2">
                    <button onClick={() => onCellClick?.(c.key)} className={`w-full px-2 py-1 rounded-lg border ${cls} text-center transition shadow-sm hover:shadow`}>{typeof v === "number" ? v : ""}</button>
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
    const o = {}; PARAMETERS.forEach((p) => (o[p.key] = makeInitialSeries(p))); return o;
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
    }, 3000);
    return () => clearInterval(id);
  }, []);

  const latest = useMemo(() => Object.fromEntries(
    PARAMETERS.map((p) => [p.key, series[p.key]?.[series[p.key].length - 1]?.v ?? 0])
  ), [series]);

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

  const electricMatrixColors = useMemo(() => {
    const states = ["ok", "ok", "ok", "critical"];
    const m = {};
    FARMS.forEach((g) => {
      m[g] = {};
      ELECTRIC_COLS.forEach((c) => {
        m[g][c.key] = states[Math.floor(Math.random() * states.length)];
      });
    });
    return m;
  }, [latest.temp]);

  const waterDetailed = useMemo(() => {
    const m = {};
    SENSORS.forEach((sid, i) => {
      m[sid] = {};
      PARAMETERS.forEach((p) => {
        const jitter = (Math.sin(i + latest[p.key]) + 1) * 0.02 * (p.max - p.min);
        const val = clamp(latest[p.key] + (Math.random() - 0.5) * jitter, p.min - (p.max - p.min) * 0.2, p.max + (p.max - p.min) * 0.2);
        m[sid][p.key] = +val.toFixed(p.key === "ph" ? 2 : 1);
      });
    });
    return m;
  }, [latest]);

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

  const TopMetrics = () => (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {PARAMETERS.map((p) => (
        <MetricCard key={p.key} p={p} data={series[p.key]} />
      ))}
    </section>
  );

  const DashboardView = () => (
    <main className="flex-1 p-4 sm:p-6 space-y-6">
      <TopMetrics />
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-slate-200 bg-white/80 backdrop-blur shadow-sm overflow-hidden">
          <img src={MAP_PLACEHOLDER} alt="Mapbox placeholder" className="w-full h-[260px] object-cover" />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white/80 backdrop-blur shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Matriz de sensores de calidad de agua</h3>
            <div className="text-xs text-slate-500 flex gap-3">
              <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"/> Normal</span>
              <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-rose-500"/> Crítico</span>
            </div>
          </div>
          <MatrixDots rows={SENSORS} cols={PARAMETERS} data={waterMatrixColors} />
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white/80 backdrop-blur shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Matriz de alarmas eléctricas</h3>
            <div className="text-xs text-slate-500 flex gap-3">
              <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"/> Normal</span>
              <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-rose-500"/> Falla</span>
            </div>
          </div>
          <MatrixDots rows={FARMS} cols={ELECTRIC_COLS} data={electricMatrixColors} />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white/80 backdrop-blur shadow-sm p-4">
          <h3 className="font-semibold mb-2">Weather conditions</h3>
          <div className="divide-y divide-slate-200 text-sm">
            <div className="flex items-center justify-between py-2"><span>Temperatura ambiente</span><strong>{Math.round((latest.temp ?? 24) + 3)} °C</strong></div>
            <div className="flex items-center justify-between py-2"><span>Viento</span><strong>{5 + (Math.floor((latest.o2 ?? 6) % 4))} km/h</strong></div>
            <div className="flex items-center justify-between py-2"><span>Lluvia (24h)</span><strong>{(Math.random() * 2).toFixed(2)} mm</strong></div>
            <div className="flex items-center justify-between py-2"><span>Humedad</span><strong>{(60 + Math.round(Math.random() * 25))} %</strong></div>
            <div className="flex items-center justify-between py-2"><span>Presión</span><strong>{(1010 + Math.round(Math.random() * 8))} hPa</strong></div>
          </div>
        </div>
      </section>
    </main>
  );

  const [selectedParam, setSelectedParam] = useState(PARAMETERS[0].key);
  const sel = PARAMETERS.find((p) => p.key === selectedParam);

  const WaterView = () => (
    <main className="flex-1 p-4 sm:p-6 space-y-6">
      <TopMetrics />
      <section className="rounded-2xl border border-slate-200 bg-white/80 backdrop-blur p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Tendencia en tiempo real — {sel.label}</h2>
          <div className="flex gap-2">
            {PARAMETERS.map((p) => (
              <button key={p.key} onClick={() => setSelectedParam(p.key)} className={`px-3 py-1.5 rounded-lg text-sm border transition ${selectedParam === p.key ? "bg-slate-900 text-white border-slate-900" : "bg-white hover:bg-slate-100 border-slate-200"}`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series[selectedParam]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey={(d) => fmtTime(new Date(d.t))} tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip labelFormatter={(l) => `Hora: ${l}`} formatter={(v) => [v, sel.unit ? `${sel.label} (${sel.unit})` : sel.label]} />
              <Line type="monotone" dataKey="v" stroke="#2563eb" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white/80 backdrop-blur p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Matriz de sensores de calidad de agua</h3>
          <div className="text-xs text-slate-500 flex gap-3">
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"/> Normal</span>
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"/> Alerta</span>
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-rose-500"/> Crítico</span>
          </div>
        </div>
        <MatrixWaterDetailed rows={SENSORS} cols={PARAMETERS} data={waterDetailed} onCellClick={(key) => setSelectedParam(key)} />
      </section>
    </main>
  );

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 to-slate-100 text-slate-800">
      <header className="sticky top-0 z-40 backdrop-blur bg-white/70 border-b border-slate-200">
        <div className="flex items-center gap-3 px-4 sm:px-6 h-14">
          <button className="p-2 rounded-xl hover:bg-slate-100 transition" onClick={() => setCollapsed((v) => !v)} aria-label="Toggle menu">
            <ChevronRight className={`w-5 h-5 transition-transform ${collapsed ? "rotate-180" : ""}`} />
          </button>
          <div className="flex items-center gap-3">
            <Image src={LOGO_URL} width={32} height={32} alt="Kaylife" className="rounded" />
            <div className="font-semibold tracking-wide">Kaylife</div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 animate-pulse">Live Data</span>
          </div>
          <div className="ml-auto flex items-center gap-3 text-slate-500">
            <div className="text-xs">Actualizado: {fmtTime(new Date())}</div>
            <button className="p-2 rounded-xl hover:bg-slate-100 transition" aria-label="Notificaciones"><Bell className="w-5 h-5"/></button>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-400 to-indigo-500" />
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className={`relative shrink-0 transition-all duration-300 ease-in-out border-r border-slate-200 bg-white/80 backdrop-blur ${collapsed ? "w-16" : "w-64"}`}>
          <nav className="p-3">
            {[{ label: "Dashboard", icon: Activity, key: "dashboard" }, { label: "Calidad de Agua", icon: Droplets, key: "agua" }, { label: "Alarmas", icon: Activity, key: "alarmas" }, { label: "Histórico", icon: Waves, key: "historico" }, { label: "Configuración", icon: Settings, key: "config" },].map((item) => (
              <button key={item.key} onClick={() => setPage(item.key)} className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-100 mb-1 transition ${page === item.key ? "bg-slate-100" : ""}`}>
                <item.icon className="w-5 h-5 text-slate-600" />
                <span className={`text-sm text-slate-700 transition-opacity ${collapsed ? "opacity-0 w-0" : "opacity-100"}`}>{item.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        {page === "dashboard" ? <DashboardView /> : page === "agua" ? <WaterView /> : (
          <main className="flex-1 p-6"><div className="rounded-2xl border border-slate-200 bg-white/80 p-6">Sección en construcción</div></main>
        )}
      </div>

      <footer className="text-xs text-slate-500 px-6 py-4">© {new Date().getFullYear()} Kaylife — Demo SPA (Dashboard + Calidad de agua)</footer>
    </div>
  );
}
