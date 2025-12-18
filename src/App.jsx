import { useEffect, useMemo, useRef, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LabelList,
  ReferenceLine,
  Cell,
} from "recharts";
import { toPng } from "html-to-image";

/* ---- CONSTANTS ---- */
const BASE_H = 20;
const BASE_B = 10;
const FIT_EXTRA = -27;
const WF_TOP_LABEL_Y = 62;

/* ---------- UTILS ---------- */
const clamp = (n, min = 0) => (Number.isFinite(n) ? Math.max(min, n) : 0);
const safe = (n) => (Number.isFinite(n) ? n : 0);
const P = (v) => {
  let s = String(v ?? "").trim().replace(/\s/g, "");
  const hasDot = s.includes(".");
  const c = (s.match(/,/g) || []).length;
  s = !hasDot && c === 1 ? s.replace(",", ".") : s.replace(/,/g, "");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};
const F = (n, d = 2) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  }).format(Number.isFinite(n) ? n : 0);
const FCUR = (n) =>
  (Number.isFinite(n) ? n : 0).toLocaleString("en-US", {
    style: "currency",
    currency: "EUR",
  });
const FCUR0 = (n) =>
  (Number.isFinite(n) ? n : 0).toLocaleString("en-US", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

/* ---------- COMPONENTS ---------- */
function Money({ value }) {
  const cls = value < 0 ? "text-red-600 font-medium" : "text-gray-900 font-medium";
  return <span className={cls}>{FCUR(value)}</span>;
}

function Delta({ base, val }) {
  const pct = base > 0 ? ((val - base) / base) * 100 : 0;
  const up = pct > 0, down = pct < 0, sign = pct > 0 ? "+" : "";
  return (
    <span className={`${down ? "text-red-600" : up ? "text-green-600" : "text-gray-500"} font-medium ml-2`}>
      {down ? "▼" : up ? "▲" : "■"} {sign}{F(pct, 2)}%
    </span>
  );
}

function NumericField({
  label,
  value,
  onChange,
  format = "2dec",
  step = 1,
  min = 0,
  readOnly = false,
  onCommit,
  suffix,
}) {
  const [focus, setFocus] = useState(false);
  const inputRef = useRef(null);
  const num = P(value);
  const show = focus ? value : format === "int" ? F(num, 0) : format === "1dec" ? F(num, 1) : F(num, 2);

  return (
    <label className="block">
      <span className="text-gray-700">{label}</span>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={show}
          readOnly={readOnly}
          onFocus={() => {
            setFocus(true);
            requestAnimationFrame(() => {
              inputRef.current?.select();
            });
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
              e.preventDefault();
              const delta = e.key === "ArrowUp" ? step : -step;
              const next = clamp(P(value) + delta, min);
              onChange(String(next));
            }
          }}
          onBlur={(e) => {
            setFocus(false);
            const n = clamp(P(e.target.value), min);
            onChange(String(n));
            onCommit?.(n);
          }}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.,-]/g, ""))}
          className={`mt-1 block w-full border rounded-md p-2 pr-16 ${readOnly ? "bg-gray-100 text-gray-600" : ""}`}
        />
        {suffix && (
          <span className="absolute inset-y-0 right-3 top-1/2 -translate-y-1/2 text-gray-500">
            {suffix}
          </span>
        )}
      </div>
    </label>
  );
}

function ScenarioField({ value, onChange, readOnly = false, bold = false }) {
  const [focus, setFocus] = useState(false);
  const inputRef = useRef(null);
  const num = P(value);
  const show = focus ? value : F(num, 2);

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={show}
      readOnly={readOnly}
      onFocus={() => {
        setFocus(true);
        requestAnimationFrame(() => inputRef.current?.select());
      }}
      onBlur={(e) => {
        setFocus(false);
        const n = clamp(P(e.target.value));
        onChange?.(String(n));
      }}
      onChange={(e) => onChange?.(e.target.value.replace(/[^\d.,-]/g, ""))}
      className={`w-full border rounded-md p-2 text-right tabular-nums ${readOnly ? "bg-gray-100 text-gray-800" : ""} ${bold ? "font-bold" : ""}`}
    />
  );
}

/* ---------- CHART LABELS ---------- */
const PercentLabel = ({ x, y, width, value }) => {
  if (!Number.isFinite(value)) return null;
  const cx = x + width / 2;
  const fill = value < 0 ? "#dc2626" : "#16a34a";
  const sign = value > 0 ? "+" : "";
  return (
    <text x={cx} y={y - 18} textAnchor="middle" fill={fill} fontSize={12} fontWeight="700">
      {sign}{F(value, 2)}%
    </text>
  );
};

const BarNumberLabel = ({ x, y, width, height, value }) => {
  if (!Number.isFinite(value)) return null;
  const cx = x + width / 2, cy = y + height / 2;
  return (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fill="#ffffff" fontSize={12} fontWeight="800">
      {F(value, 2)}
    </text>
  );
};

const VerticalMoneyLabel0 = ({ x, y, width, height, value }) => {
  if (!Number.isFinite(value)) return null;
  const cx = x + width / 2, cy = y + height / 2;
  return (
    <text x={cx} y={cy} transform={`rotate(-90, ${cx}, ${cy})`} textAnchor="middle" dominantBaseline="middle" fill="#000000" fontSize={16} fontWeight="800">
      {FCUR0(value)}
    </text>
  );
};

const makeWFLabelTop = (data, fixedY) => (props) => {
  const { x = 0, width = 0, index, value, payload } = props || {};
  const d = Array.isArray(data) && Number.isInteger(index) ? data[index] : {};
  const cx = x + width / 2;
  const raw = Number.isFinite(d?.delta) ? d.delta : Number.isFinite(payload?.delta) ? payload.delta : Number.isFinite(value) ? value : 0;
  const v = Math.round(raw * 100) / 100;
  const abs = Math.abs(v);
  if (d?.isTotal) {
    const pos = v >= 0;
    return (
      <text x={cx} y={fixedY} textAnchor="middle" fill={pos ? "#16a34a" : "#dc2626"} fontSize={12} fontWeight="800">
        {pos ? "" : "−"}{F(Math.abs(v), 2)}
      </text>
    );
  }
  if (abs < 0.005) return null;
  return (
    <text x={cx} y={fixedY} textAnchor="middle" fill="#dc2626" fontSize={12} fontWeight="800">
      −{F(abs, 2)}
    </text>
  );
};

/* ---------- CHARTS ---------- */
function BarsChart({ data, isExporting }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart key="bars" data={data} barCategoryGap={18} barGap={4} margin={{ top: 28, right: 6, bottom: Math.max(0, BASE_B), left: 6 }}>
        <XAxis dataKey="name" height={Math.max(0, BASE_H)} tick={{ fontSize: 12, fontWeight: 700 }} />
        <YAxis hide />
        <Tooltip formatter={(v, n) => (n === "sqm" ? `${F(v, 2)} €/sqm` : `${F(v, 2)}%`)} />
        <ReferenceLine y={0} />
        <Bar dataKey="sqm" barSize={36} isAnimationActive={!isExporting}>
          <LabelList dataKey="pct" content={<PercentLabel />} />
          <LabelList dataKey="sqm" content={<BarNumberLabel />} />
          {data.map((e, i) => (
            <Cell key={i} fill={e.color} stroke={e.name === "Final" ? "#dc2626" : undefined} strokeWidth={e.name === "Final" ? 2 : undefined} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function WaterfallChart({ data, isExporting }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart key="waterfall" data={data} barCategoryGap={8} barGap={6} margin={{ top: 56, right: 12, bottom: Math.max(0, BASE_B), left: 12 }}>
        <XAxis dataKey="name" interval={0} height={Math.max(0, BASE_H)} tick={{ fontSize: 12, fontWeight: 700 }} />
        <YAxis hide domain={["dataMin - 2", "dataMax + 8"]} />
        <Tooltip formatter={(val, _n, ctx) => {
          const p = ctx?.payload || {};
          if (p.isTotal) return [`${F(safe(p.delta), 2)} €/sqm`, "Rent"];
          return [`−${F(Math.abs(safe(p.delta)), 2)} €/sqm`, "Δ"];
        }} />
        <ReferenceLine y={0} />
        <Bar dataKey="base" stackId="wf" fill="rgba(0,0,0,0)" />
        <Bar dataKey="delta" stackId="wf" barSize={44} isAnimationActive={!isExporting}>
          <LabelList dataKey="delta" content={makeWFLabelTop(data, WF_TOP_LABEL_Y)} />
          {data.map((d, i) => (
            <Cell key={i} fill={d.isTotal ? "#16a34a" : "#dc2626"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ---------- APP ---------- */
export default function App() {
  const [f, setF] = useState({
    tenant: "",
    nla: "1000",
    addon: "5.00",
    rent: "15.00",
    duration: "60",
    rf: "5.0",
    agent: "2.0",
    fitMode: "perNLA",
    fitPerNLA: "300.00",
    fitPerGLA: "",
    fitTot: "300000.00",
    unforeseen: "0",
  });
  const S = (k) => (v) => setF((s) => ({ ...s, [k]: v }));
  const [isExporting, setIsExporting] = useState(false);
  const [viewMode, setViewMode] = useState("bars");

  /* Scenarios */
  const [scenarios, setScenarios] = useState([
    { id: 2, overrides: {} },
    { id: 3, overrides: {} },
    { id: 4, overrides: {} },
  ]);

  const setScenarioVal = (id, key, value) => {
    setScenarios((arr) =>
      arr.map((sc) =>
        sc.id === id ? { ...sc, overrides: { ...sc.overrides, [key]: value } } : sc
      )
    );
  };

  const resolveScenario = (sc, key) => {
    const v = sc.overrides[key];
    return v !== undefined ? v : f[key];
  };

  /* URL Data Loading */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const data = params.get("data");
    if (data) {
      try {
        const parsed = JSON.parse(decodeURIComponent(data));
        setF((s) => ({ ...s, ...parsed }));
      } catch (e) {
        console.error("Failed to parse project data:", e);
      }
    }
  }, []);

  /* Calculations */
  const nla = clamp(P(f.nla));
  const addon = clamp(P(f.addon));
  const rent = clamp(P(f.rent));
  const duration = Math.max(0, Math.floor(P(f.duration)));
  const rf = clamp(P(f.rf));
  const agent = clamp(P(f.agent));
  const unforeseen = clamp(P(f.unforeseen));

  const gla = useMemo(() => nla * (1 + addon / 100), [nla, addon]);
  const months = Math.max(0, duration - rf);
  const gross = rent * gla * months;

  const perNLA = clamp(P(f.fitPerNLA));
  const perGLA = clamp(P(f.fitPerGLA));
  const tot = clamp(P(f.fitTot));

  /* Sync Fit-outs */
  useEffect(() => {
    const nNLA = clamp(P(f.fitPerNLA));
    const nGLA = clamp(P(f.fitPerGLA));
    const nTot = clamp(P(f.fitTot));
    if (f.fitMode === "perNLA") {
      const t = nNLA * nla;
      const g = gla > 0 ? t / gla : 0;
      if (Math.abs(t - nTot) > 1e-9) S("fitTot")(String(t));
      if (Math.abs(g - nGLA) > 1e-9) S("fitPerGLA")(String(g));
    } else if (f.fitMode === "perGLA") {
      const t = nGLA * gla;
      const n = nla > 0 ? t / nla : 0;
      if (Math.abs(t - nTot) > 1e-9) S("fitTot")(String(t));
      if (Math.abs(n - nNLA) > 1e-9) S("fitPerNLA")(String(n));
    } else {
      const n = nla > 0 ? nTot / nla : 0;
      const g = gla > 0 ? nTot / gla : 0;
      if (Math.abs(n - nNLA) > 1e-9) S("fitPerNLA")(String(n));
      if (Math.abs(g - nGLA) > 1e-9) S("fitPerGLA")(String(g));
    }
  }, [f.fitMode, f.nla, f.addon, f.fitPerNLA, f.fitPerGLA, f.fitTot, gla, nla]);

  const totalFit = f.fitMode === "perNLA" ? perNLA * nla : f.fitMode === "perGLA" ? perGLA * gla : tot;
  const agentFees = agent * rent * gla;
  const denom = Math.max(1e-9, duration * gla);

  const ner1 = gross / denom;
  const ner2 = (gross - totalFit) / denom;
  const ner3 = (gross - totalFit - agentFees) / denom;
  const ner4 = (gross - totalFit - agentFees - unforeseen) / denom;

  const totalHeadline = rent * gla * duration;
  const totalRentFrees = rent * gla * rf;
  const totalAgentFees = agentFees;
  const totalUnforeseen = unforeseen;

  const calcScenarioNER = (vals) => {
    const nlaS = clamp(P(vals.nla ?? f.nla));
    const addonS = clamp(P(vals.addon ?? f.addon));
    const glaS = nlaS * (1 + addonS / 100);

    const rentS = clamp(P(vals.rent ?? f.rent));
    const durationS = Math.max(0, Math.floor(P(vals.duration ?? f.duration)));
    const rfS = clamp(P(vals.rf ?? f.rf));
    const agentS = clamp(P(vals.agent ?? f.agent));
    const unforeseenS = clamp(P(vals.unforeseen ?? f.unforeseen));

    const monthsS = Math.max(0, durationS - rfS);
    const grossS = rentS * glaS * monthsS;

    const modeS = vals.fitMode ?? f.fitMode;
    const perNLAS = clamp(P(vals.fitPerNLA ?? f.fitPerNLA));
    const perGLAS = clamp(P(vals.fitPerGLA ?? f.fitPerGLA));
    const totalS = clamp(P(vals.fitTot ?? f.fitTot));

    const fitS = modeS === "perNLA" ? perNLAS * nlaS : modeS === "perGLA" ? perGLAS * glaS : totalS;
    const agentFeesS = agentS * rentS * glaS;
    const denomS = Math.max(1e-9, durationS * glaS);

    return (grossS - fitS - agentFeesS - unforeseenS) / denomS;
  };

  const NER_COLORS = ["#1e3a8a", "#2563eb", "#3b82f6", "#60a5fa"];
  const nerBars = [
    { label: "Headline", val: rent, pct: null, color: "#065f46" },
    { label: "NER 1", val: ner1, pct: rent > 0 ? ((ner1 - rent) / rent) * 100 : null, color: NER_COLORS[0] },
    { label: "NER 2", val: ner2, pct: rent > 0 ? ((ner2 - rent) / rent) * 100 : null, color: NER_COLORS[1] },
    { label: "NER 3", val: ner3, pct: rent > 0 ? ((ner3 - rent) / rent) * 100 : null, color: NER_COLORS[2] },
    { label: "Final", val: ner4, pct: rent > 0 ? ((ner4 - rent) / rent) * 100 : null, color: NER_COLORS[3] },
  ].map((d) => ({ name: d.label, sqm: safe(d.val), pct: Number.isFinite(d.pct) ? d.pct : null, color: d.color }));

  /* Waterfall Data */
  const dRF = safe(ner1 - rent);
  const dFO = safe(ner2 - ner1);
  const dAF = safe(ner3 - ner2);
  const dUC = safe(ner4 - ner3);

  let cur = safe(rent);
  const wfData = [];
  wfData.push({ name: "Headline", base: 0, delta: cur, isTotal: true });
  wfData.push({ name: "RF", base: cur, delta: dRF, isTotal: false }); cur += dRF;
  wfData.push({ name: "FO", base: cur, delta: dFO, isTotal: false }); cur += dFO;
  wfData.push({ name: "AF", base: cur, delta: dAF, isTotal: false }); cur += dAF;
  wfData.push({ name: "UC", base: cur, delta: dUC, isTotal: false }); cur += dUC;
  wfData.push({ name: "Final NER", base: 0, delta: cur, isTotal: true });

  const scenarioView = scenarios.map((sc) => {
    const vals = { ...f, ...sc.overrides };
    return { id: sc.id, ner: calcScenarioNER(vals) };
  });

  /* Exports */
  const pageRef = useRef(null);
  const mainContentRef = useRef(null);
  const resultsContentRef = useRef(null);

  const exportNode = async (node, filename) => {
    if (!node) return;
    try {
      setIsExporting(true);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const rect = node.getBoundingClientRect();
      const pad = 24;
      const w = Math.ceil(rect.width) + pad * 2;
      const h = Math.ceil(rect.height) + pad * 2;
      const dataUrl = await toPng(node, {
        cacheBust: true,
        pixelRatio: 3,
        backgroundColor: "#ffffff",
        width: w,
        height: h,
        canvasWidth: w,
        canvasHeight: h,
        style: { padding: `${pad}px`, margin: "0", overflow: "visible", boxShadow: "none", borderRadius: "0" },
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = filename;
      a.click();
    } catch (e) {
      console.error("PNG export failed", e);
    } finally {
      setIsExporting(false);
    }
  };

  const exportResultsPNG = async () => {
    if (!resultsContentRef.current) return;
    const fname = f.tenant?.trim() ? `${f.tenant.trim()}-results.png` : "ner-results.png";
    await exportNode(resultsContentRef.current, fname);
  };

  const exportFullPNG = async () => {
    const fname = f.tenant?.trim() ? `${f.tenant.trim()}-full.png` : "ner-full.png";
    await exportNode(pageRef.current, fname);
  };

  const exportProjectHTML = () => {
    const data = encodeURIComponent(JSON.stringify(f));
    const tenant = f.tenant?.trim() || "ner-project";
    const content = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>NER Project - ${tenant}</title><meta http-equiv="refresh" content="0;url=${window.location.origin}${window.location.pathname}?data=${data}"></head><body><p>Redirecting to NER Calculator...</p></body></html>`;
    const blob = new Blob([content], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${tenant}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ backgroundColor: "#005CA9" }}>
      <div
        ref={pageRef}
        className="p-6 max-w-6xl mx-auto bg-white rounded-xl shadow-md"
        style={{ boxShadow: "0 10px 25px rgba(0,0,0,.08)" }}
      >
        {/* ===== HEADER & TENANT ===== */}
        <div ref={mainContentRef}>
          <h2 className="text-3xl font-bold mb-2 text-center" style={{ color: "#005CA9" }}>
            Net Effective Rent (NER) Calculator
          </h2>
          <div className="mb-4 flex justify-center">
            <div className="w-full md:w-1/2">
              <input
                type="text"
                value={f.tenant}
                onChange={(e) => S("tenant")(e.target.value)}
                placeholder="Tenant"
                className="mt-1 block w-full border rounded-md p-2 text-center"
              />
            </div>
          </div>
        </div>

        {/* ===== MAIN GRID: INPUTS & RESULTS ===== */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* LEFT: Inputs */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <NumericField label="NLA (sqm)" value={f.nla} onChange={S("nla")} />
              <NumericField label="Add-On (%)" value={f.addon} onChange={S("addon")} />
              <label className="block">
                <span className="text-gray-700">GLA (sqm)</span>
                <input
                  readOnly
                  value={F(gla, 2)}
                  className="mt-1 block w-full border rounded-md p-2 bg-gray-100 text-gray-600"
                />
              </label>
              <NumericField label="Headline Rent €/sqm" value={f.rent} onChange={S("rent")} step={0.5} />
              <NumericField label="Lease Term (months)" value={f.duration} onChange={S("duration")} format="int" />
              <NumericField label="Rent-Free (months)" value={f.rf} onChange={S("rf")} />
            </div>

            {/* Fit-Out block */}
            <div className="border rounded-md p-3">
              <div className="flex flex-wrap items-center gap-4 mb-3">
                <span className="text-gray-700 font-medium">Fit-Out Input:</span>
                <label className="inline-flex items-center gap-2">
                  <input type="radio" checked={f.fitMode === "perNLA"} onChange={() => S("fitMode")("perNLA")} />
                  <span>€/sqm (NLA)</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="radio" checked={f.fitMode === "perGLA"} onChange={() => S("fitMode")("perGLA")} />
                  <span>€/sqm (GLA)</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="radio" checked={f.fitMode === "total"} onChange={() => S("fitMode")("total")} />
                  <span>Total (€)</span>
                </label>
              </div>
              <div className="space-y-3">
                <NumericField label="Fit-Out €/sqm (NLA)" value={f.fitPerNLA} onChange={S("fitPerNLA")} readOnly={f.fitMode !== "perNLA"} suffix="€/sqm" />
                <NumericField label="Fit-Out €/sqm (GLA)" value={f.fitPerGLA} onChange={S("fitPerGLA")} readOnly={f.fitMode !== "perGLA"} suffix="€/sqm" />
                <NumericField label="Fit-Out Total (€)" value={f.fitTot} onChange={S("fitTot")} readOnly={f.fitMode !== "total"} suffix="€" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <NumericField label="Agent Fees (months)" value={f.agent} onChange={S("agent")} />
              <NumericField label="Unforeseen Costs (lump sum €)" value={f.unforeseen} onChange={S("unforeseen")} suffix="€" />
            </div>
          </div>

          {/* RIGHT: Results */}
          <div className="md:sticky md:top-6 h-fit">
            <div className="rounded-lg border p-4 space-y-2 bg-white">
              <div ref={resultsContentRef}>
                {f.tenant.trim() && (
                  <div className="mb-3">
                    <span className="text-xl font-bold">
                      Tenant: <u>{f.tenant.trim()}</u>
                    </span>
                  </div>
                )}

                <div className="mt-1 rounded-xl ring-2 ring-blue-300 ring-offset-1 bg-blue-50 px-4 py-2 flex items-center justify-between shadow-sm mb-3">
                  <div className="font-bold text-lg">Headline Rent</div>
                  <div className="text-lg font-extrabold tracking-tight text-gray-900">
                    {F(rent, 2)} €/sqm
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mb-3">
                  <div>Total Headline Rent</div><div className="text-right"><Money value={totalHeadline} /></div>
                  <div>Total Rent Frees</div><div className="text-right"><Money value={-totalRentFrees} /></div>
                  <div>Total Agent Fees</div><div className="text-right"><Money value={-totalAgentFees} /></div>
                  <div>Unforeseen Costs</div><div className="text-right"><Money value={-totalUnforeseen} /></div>
                </div>

                <p className="text-sm font-semibold text-red-500 mb-1">
                  Total Fit Out Costs: {FCUR(totalFit)}
                </p>

                <p>1️⃣ NER incl. Rent Frees: <b>{F(ner1, 2)} €/sqm</b><Delta base={rent} val={ner1} /></p>
                <p>2️⃣ incl. Rent Frees & Fit-Outs: <b>{F(ner2, 2)} €/sqm</b><Delta base={rent} val={ner2} /></p>
                <p>3️⃣ incl. Rent Frees, Fit-Outs & Agent Fees: <b>{F(ner3, 2)} €/sqm</b><Delta base={rent} val={ner3} /></p>

                {/* Charts */}
                <div className="mt-2 grid grid-cols-3 gap-6">
                  <div className="h-60 p-2 col-span-1">
                    <div className="text-sm font-bold text-center mb-1">Total Fit-Outs</div>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[{ name: "Fit-Outs", eur: totalFit }]} margin={{ top: 8, right: 0, bottom: Math.max(0, BASE_B + FIT_EXTRA), left: 0 }}>
                        <XAxis dataKey="name" tick={false} axisLine={false} tickLine={false} />
                        <YAxis hide />
                        <Tooltip formatter={(v) => FCUR0(v)} />
                        <Bar dataKey="eur" fill="#D9D9D9" barSize={40} isAnimationActive={!isExporting}>
                          <LabelList content={<VerticalMoneyLabel0 />} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="h-64 p-2 col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-sm font-bold">
                        {viewMode === "bars" ? "NER vs Headline (€/sqm)" : "Waterfall (€/sqm)"}
                      </div>
                      <div className="text-xs">
                        <label className="mr-2">
                          <input type="radio" checked={viewMode === "bars"} onChange={() => setViewMode("bars")} /> Bars
                        </label>
                        <label>
                          <input type="radio" checked={viewMode === "waterfall"} onChange={() => setViewMode("waterfall")} /> Waterfall
                        </label>
                      </div>
                    </div>

                    {viewMode === "bars"
                      ? <BarsChart data={nerBars} isExporting={isExporting} />
                      : <WaterfallChart data={wfData} isExporting={isExporting} />
                    }
                  </div>
                </div>

                <div className="mt-4 border-t pt-3">
                  <div className="mt-3 rounded-2xl ring-2 ring-sky-500 ring-offset-2 bg-sky-50 px-5 py-3 flex items-center justify-between shadow-md">
                    <div className="text-sky-700 font-extrabold text-base">🏁 Final NER</div>
                    <div className="text-2xl font-extrabold tracking-tight text-gray-900">{F(ner4, 2)} €/sqm</div>
                    <div className="ml-4 text-sm"><Delta base={rent} val={ner4} /></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ===== SCENARIO COMPARISON TABLE ===== */}
        <div className="mt-6 border rounded-lg overflow-hidden">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border px-3 py-2 text-left"></th>
                <th className="border px-3 py-2 text-center">Scenario 1</th>
                <th className="border px-3 py-2 text-center">Scenario 2</th>
                <th className="border px-3 py-2 text-center">Scenario 3</th>
                <th className="border px-3 py-2 text-center">Scenario 4</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border px-3 py-2 font-medium">Headline Rent €/sqm</td>
                <td className="border px-3 py-2 text-right">{F(rent, 2)}</td>
                {scenarios.map((sc) => (
                  <td key={sc.id} className="border px-2 py-1">
                    <ScenarioField value={resolveScenario(sc, "rent")} onChange={(v) => setScenarioVal(sc.id, "rent", v)} />
                  </td>
                ))}
              </tr>
              <tr>
                <td className="border px-3 py-2 font-medium">Lease Term (months)</td>
                <td className="border px-3 py-2 text-right">{duration}</td>
                {scenarios.map((sc) => (
                  <td key={sc.id} className="border px-2 py-1">
                    <ScenarioField value={resolveScenario(sc, "duration")} onChange={(v) => setScenarioVal(sc.id, "duration", v)} />
                  </td>
                ))}
              </tr>
              <tr>
                <td className="border px-3 py-2 font-medium">RF-Months</td>
                <td className="border px-3 py-2 text-right">{rf}</td>
                {scenarios.map((sc) => (
                  <td key={sc.id} className="border px-2 py-1">
                    <ScenarioField value={resolveScenario(sc, "rf")} onChange={(v) => setScenarioVal(sc.id, "rf", v)} />
                  </td>
                ))}
              </tr>
              <tr>
                <td className="border px-3 py-2 font-medium">Fit-Outs €/sqm (NLA)</td>
                <td className="border px-3 py-2 text-right">{F(perNLA, 0)}</td>
                {scenarios.map((sc) => (
                  <td key={sc.id} className="border px-2 py-1">
                    <ScenarioField value={resolveScenario(sc, "fitPerNLA")} onChange={(v) => setScenarioVal(sc.id, "fitPerNLA", v)} />
                  </td>
                ))}
              </tr>
              <tr>
                <td className="border px-3 py-2 font-medium">Agent Fees (months)</td>
                <td className="border px-3 py-2 text-right">{agent}</td>
                {scenarios.map((sc) => (
                  <td key={sc.id} className="border px-2 py-1">
                    <ScenarioField value={resolveScenario(sc, "agent")} onChange={(v) => setScenarioVal(sc.id, "agent", v)} />
                  </td>
                ))}
              </tr>
              <tr className="bg-blue-50 font-bold">
                <td className="border px-3 py-2">NER €/sqm</td>
                <td className="border px-3 py-2 text-right">{F(ner4, 2)}</td>
                {scenarioView.map((s) => (
                  <td key={s.id} className="border px-3 py-2 text-right">
                    {F(s.ner, 2)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* ===== FOOTER EXPORTS ===== */}
        <div className="flex gap-2 justify-end mt-4">
          <button onClick={exportResultsPNG} className="px-3 py-1.5 rounded border bg-gray-50 hover:bg-gray-100 text-sm">Export Results PNG</button>
          <button onClick={exportFullPNG} className="px-3 py-1.5 rounded border bg-gray-50 hover:bg-gray-100 text-sm">Export Full PNG</button>
          <button onClick={exportProjectHTML} className="px-3 py-1.5 rounded border bg-blue-50 hover:bg-blue-100 text-sm text-blue-700">Save Project File</button>
        </div>
      </div>
    </div>
  );
}
