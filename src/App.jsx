import { useEffect, useRef, useState } from "react";
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
import { NumericField, ScenarioField } from "./components/NumericFields";
import { calculateNER, calculateScenarioNER, getFitOutSyncUpdates } from "./utils/calculations";
import { F, FCUR, FCUR0, P, safe } from "./utils/format";

/* ---- CONSTANTS ---- */
const BASE_H = 20;
const BASE_B = 10;
const FIT_EXTRA = -27;
const WF_TOP_LABEL_Y = 62;

/* ---------- COMPONENTS ---------- */
function Delta({ base, val }) {
  const pct = base > 0 ? ((val - base) / base) * 100 : 0;
  const up = pct > 0, down = pct < 0, sign = pct > 0 ? "+" : "";
  return (
    <span className={`${down ? "text-red-600" : up ? "text-green-600" : "text-gray-500"} font-medium ml-2`}>
      {down ? "▼" : up ? "▲" : "■"} {sign}{F(pct, 2)}%
    </span>
  );
}

function ScenarioDelta({ base, val }) {
  const pct = Math.abs(base) > 1e-9 ? ((val - base) / Math.abs(base)) * 100 : 0;
  const up = pct > 0;
  const down = pct < 0;
  const sign = up ? "+" : "";

  return (
    <span className={`${up ? "text-green-600" : down ? "text-red-600" : "text-gray-500"} font-bold tabular-nums`}>
      {up ? "▲" : down ? "▼" : "■"} {sign}{F(pct, 2)}%
    </span>
  );
}

const scenarioResultCellStyle = (scenario, allScenarios, base) => {
  const diff = scenario.ner - base;
  if (Math.abs(diff) < 0.005) return { backgroundColor: "#2563eb", color: "#ffffff" };

  const greenSteps = [
    { backgroundColor: "#bbf7d0", color: "#052e16" },
    { backgroundColor: "#22c55e", color: "#052e16" },
    { backgroundColor: "#15803d", color: "#ffffff" },
  ];
  const redSteps = [
    { backgroundColor: "#fecaca", color: "#450a0a" },
    { backgroundColor: "#ef4444", color: "#ffffff" },
    { backgroundColor: "#b91c1c", color: "#ffffff" },
  ];

  const isBetter = diff > 0;
  const group = allScenarios.filter((sv) =>
    isBetter ? sv.ner - base > 0.005 : base - sv.ner > 0.005
  );
  const sortedValues = [...new Set(group.map((sv) => F(sv.ner, 4)))].sort((a, b) =>
    isBetter ? Number(a) - Number(b) : Number(b) - Number(a)
  );
  const rank = Math.max(0, sortedValues.indexOf(F(scenario.ner, 4)));
  const step = sortedValues.length === 1 ? 2 : sortedValues.length === 2 ? rank + 1 : Math.min(rank, 2);

  return isBetter ? greenSteps[step] : redSteps[step];
};

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

/* ---------- Charts ---------- */
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
  const isAppleSupport =
  window.location.pathname === "/apple-support";
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
  const [isLoaded, setIsLoaded] = useState(false);
  const S = (k) => (v) => setF((s) => ({ ...s, [k]: v }));
  const [isExporting, setIsExporting] = useState(false);
  const [viewMode, setViewMode] = useState("bars");

  /* Scenarios */
  const [scenarios, setScenarios] = useState([
  { id: 2, overrides: {},  },
  { id: 3, overrides: {},  },
  { id: 4, overrides: {},  },
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

      if (parsed.f) {
        setF((s) => ({ ...s, ...parsed.f }));
        if (parsed.scenarios) setScenarios(parsed.scenarios);
      } else {
        setF((s) => ({ ...s, ...parsed }));
      }

    } catch (e) {
      console.error("Failed to parse project data:", e);
    }
  }

  setIsLoaded(true);   // ✅ DAS HIER HINZUFÜGEN

}, []);

  const {
    nla,
    gla,
    rent,
    rf,
    perNLA,
    perGLA,
    totalFit,
    ner1,
    ner2,
    ner3,
    ner4,
    totalHeadline,
    totalRentFrees,
    totalAgentFees,
    totalUnforeseen,
  } = calculateNER(f);

  /* Sync Fit-outs */
useEffect(() => {

  if (!isLoaded) return;   // ✅ verhindert falsches Überschreiben beim Laden

  const updates = getFitOutSyncUpdates(f);
  if (Object.keys(updates).length > 0) {
    setF((s) => ({ ...s, ...updates }));
  }

}, [isLoaded, f.fitMode, f.nla, f.addon, f.fitPerNLA, f.fitPerGLA, f.fitTot]);

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

  const scenarioView = scenarios.map((sc) => ({
    id: sc.id,
    ner: calculateScenarioNER(f, sc.overrides),
  }));

  /* Exports */
  const pageRef = useRef(null);
  const mainContentRef = useRef(null);
  const resultsContentRef = useRef(null);
  const calculatorRef = useRef(null);

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
  const fname = f.tenant?.trim() ? `${f.tenant.trim()}-calculator.png` : "ner-calculator.png";
  // Change pageRef.current to calculatorRef.current
  await exportNode(calculatorRef.current, fname); 
};

  const exportProjectHTML = () => {
    const data = encodeURIComponent(  JSON.stringify({    f,    scenarios,  }));
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

if (isAppleSupport) {
  return (
    <div
      style={{
        maxWidth: "700px",
        margin: "60px auto",
        padding: "30px",
        fontFamily: "Arial, sans-serif",
        backgroundColor: "#ffffff",
        borderRadius: "12px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
      }}
    >
      <h1
        style={{
          color: "#005CA9",
          marginBottom: "25px",
        }}
      >
        NER Calculator Support
      </h1>

      <p style={{ lineHeight: "1.6" }}>
        For support, questions, bug reports or feature requests please contact:
      </p>

      <p>
        <a
          href="mailto:andriy.ivchenko@gmx.at"
          style={{
            color: "#005CA9",
            fontWeight: "bold",
            textDecoration: "none",
          }}
        >
          andriy.ivchenko@gmx.at
        </a>
      </p>

      <p style={{ color: "#555" }}>
        We usually respond within 2 business days.
      </p>

      <hr style={{ margin: "25px 0" }} />

      <p>
        <strong>Application:</strong> NER – Net Effective Rent Calculator
      </p>

      <p>
        <strong>Developer:</strong> Andriy Ivchenko
      </p>
    </div>
  );
}
return (
    <div style={{ backgroundColor: "#005CA9" }} className="min-h-screen pb-10">
      <div
        ref={pageRef}
        className="p-6 max-w-6xl mx-auto bg-white rounded-xl shadow-md"
        style={{ boxShadow: "0 10px 25px rgba(0,0,0,.08)" }}
      >
        {/* EXPORT-BEREICH 1: Alles außer der großen Tabelle */}
        <div ref={calculatorRef}>
          {/* HEADER */}
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
                  placeholder="Tenant Name"
                  className="mt-1 block w-full border rounded-md p-2 text-center font-medium"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* LINKS: INPUTS */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <NumericField label="NLA (sqm)" value={f.nla} onChange={S("nla")} />
                <NumericField label="Add-On (%)" value={f.addon} onChange={S("addon")} />
                <label className="block">
                  <span className="text-gray-700 text-sm font-semibold">GLA (sqm)</span>
                  <input readOnly value={F(gla, 2)} className="mt-1 block w-full border rounded-md p-2 bg-gray-100 text-gray-600" />
                </label>
                <NumericField label="Headline Rent €/sqm" value={f.rent} onChange={S("rent")} step={0.5} />
                <NumericField label="Lease Term (months)" value={f.duration} onChange={S("duration")} format="int" />
                <NumericField label="Rent-Free (months)" value={f.rf} onChange={S("rf")} />
              </div>

              {/* Fit-Out Block */}
              <div className="border rounded-md p-3 bg-gray-50/50">
                <div className="flex flex-wrap items-center gap-4 mb-3">
                  <span className="text-gray-700 font-bold text-sm">Fit-Out Input:</span>
                  <label className="inline-flex items-center gap-1 text-sm cursor-pointer">
                    <input type="radio" checked={f.fitMode === "perNLA"} onChange={() => S("fitMode")("perNLA")} /> <span>€/NLA</span>
                  </label>
                  <label className="inline-flex items-center gap-1 text-sm cursor-pointer">
                    <input type="radio" checked={f.fitMode === "perGLA"} onChange={() => S("fitMode")("perGLA")} /> <span>€/GLA</span>
                  </label>
                  <label className="inline-flex items-center gap-1 text-sm cursor-pointer">
                    <input type="radio" checked={f.fitMode === "total"} onChange={() => S("fitMode")("total")} /> <span>Total</span>
                  </label>
                </div>
                <div className="space-y-3">
                  <NumericField label="Fit-Out €/sqm (NLA)" value={f.fitPerNLA} onChange={S("fitPerNLA")} readOnly={f.fitMode !== "perNLA"} suffix="€" />
                  <NumericField label="Fit-Out €/sqm (GLA)" value={f.fitPerGLA} onChange={S("fitPerGLA")} readOnly={f.fitMode !== "perGLA"} suffix="€" />
                  <NumericField label="Fit-Out Total (€)" value={f.fitTot} onChange={S("fitTot")} readOnly={f.fitMode !== "total"} suffix="€" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <NumericField label="Agent Fees (months)" value={f.agent} onChange={S("agent")} />
                <NumericField  label={    <>      <span className="text-red-600 text-xs whitespace-nowrap">Lumpsum Costs (-)</span>{" "}      /{" "}      <span className="text-green-600 text-xs whitespace-nowrap">Compensation (+)</span>   </>}
  value={f.unforeseen}
  onChange={S("unforeseen")}
  suffix="€"
  min={-999999999}
  colorize
/>
              </div>
            </div>

            {/* RECHTS: RESULTS */}
            <div className="md:sticky md:top-6 h-fit">
              <div className="rounded-lg border p-4 space-y-2 bg-white shadow-sm">
                <div ref={resultsContentRef}>
                  {f.tenant.trim() && (
                    <div className="mb-3 border-b pb-1">
                      <span className="text-xl font-bold text-gray-800">Tenant: <u>{f.tenant.trim()}</u></span>
                    </div>
                  )}

                  <div className="mt-1 rounded-xl ring-2 ring-blue-300 ring-offset-1 bg-blue-50 px-4 py-2 flex items-center justify-between shadow-sm mb-3">
                  <div className="font-bold text-lg text-blue-900">Headline Rent</div>
                  <div className="text-lg font-extrabold text-gray-900">{F(rent, 2)} €/sqm</div>
                </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mb-3 text-gray-600 italic">

                  <div>Total Headline Rent</div>
                  <div className="text-right text-green-600 font-medium">
                    {FCUR(totalHeadline)}
                  </div>
                
                  <div>Total Rent Frees</div>
                  <div className="text-right text-red-600 font-medium">
                    {FCUR(-totalRentFrees)}
                  </div>
                
                  <div>Total Agent Fees</div>
                  <div className="text-right text-red-600 font-medium">
                    {FCUR(-totalAgentFees)}
                  </div>
                
                  <div>
                    <span className="text-red-600">Lumpsum Costs (-)</span>{" "}
                    /{" "}
                    <span className="text-green-600">Compensation (+)</span>
                  </div>
                  <div className={`text-right font-medium ${totalUnforeseen >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {FCUR(totalUnforeseen)}
                  </div>
                
                </div>
                  <p className="text-sm font-semibold text-red-600 mb-2">Total Fit Out: {FCUR(totalFit)}</p>

                  <div className="space-y-1 text-sm border-t pt-2">
                    <p>1️⃣ NER incl. Rent Frees: <b>{F(ner1, 2)} €</b> <Delta base={rent} val={ner1} /></p>
                    <p>2️⃣ incl. Fit-Outs: <b>{F(ner2, 2)} €</b> <Delta base={rent} val={ner2} /></p>
                    <p>3️⃣ incl. Agent Fees: <b>{F(ner3, 2)} €</b> <Delta base={rent} val={ner3} /></p>
                  </div>

                  {/* CHARTS */}
                  <div className="mt-4 grid grid-cols-3 gap-2 border-t pt-4">
                    <div className="h-48 col-span-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={[{ name: "Fit-Out", eur: totalFit }]} margin={{ top: 20, right: 5, left: 5, bottom: 5 }}>
                          <XAxis dataKey="name" hide />
                          <YAxis hide />
                          <Tooltip formatter={(v) => FCUR0(v)} />
                         <Bar dataKey="eur" fill="#94a3b8" barSize={50} isAnimationActive={!isExporting}>
                            <LabelList content={<VerticalMoneyLabel0 />} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="h-48 col-span-2">
                      <div className="flex justify-end gap-2 mb-1">
                        <button onClick={() => setViewMode("bars")} className={`text-[10px] px-1 border rounded ${viewMode === 'bars' ? 'bg-gray-200' : ''}`}>Bars</button>
                        <button onClick={() => setViewMode("waterfall")} className={`text-[10px] px-1 border rounded ${viewMode === 'waterfall' ? 'bg-gray-200' : ''}`}>Waterfall</button>
                      </div>
                      {viewMode === "bars" ? <BarsChart data={nerBars} isExporting={isExporting} /> : <WaterfallChart data={wfData} isExporting={isExporting} />}
                    </div>
                  </div>

                  <div className="mt-4 border-t-2 border-dashed pt-3">
                    <div className="rounded-2xl ring-2 ring-sky-500 ring-offset-2 bg-sky-50 px-5 py-3 flex items-center justify-between shadow-md">
                      <div className="text-sky-700 font-extrabold">🏁 Final NER</div>
                      <div className="text-2xl font-extrabold text-gray-900">{F(ner4, 2)} €/sqm</div>
                      <div className="ml-2 text-sm"><Delta base={rent} val={ner4} /></div>
                    </div>
                  </div>
                </div>

                {/* BUTTONS - AUßERHALB DER PNG REFS */}
                <div className="flex flex-col gap-2 mt-6 pt-4 border-t">
                  <div className="flex gap-2">
                    <button onClick={exportResultsPNG} className="flex-1 px-3 py-2 rounded border bg-gray-50 hover:bg-gray-100 text-xs font-bold transition-colors">Export Results PNG</button>
                    <button onClick={exportFullPNG} className="flex-1 px-3 py-2 rounded border bg-gray-50 hover:bg-gray-100 text-xs font-bold transition-colors">Export Full PNG</button>
                  </div>
                  <button onClick={exportProjectHTML} className="w-full px-3 py-2 rounded border bg-blue-600 text-white hover:bg-blue-700 text-xs font-bold transition-colors shadow-sm">Save Project File</button>
                </div>
              </div>
            </div>
          </div>
        </div>

      {/* TABELLE - AUßERHALB DER PNG REFS */}
        <div className="mt-8 border rounded-lg overflow-x-auto bg-white">
          <table className="w-full text-sm border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-gray-100 text-gray-700">
                <th className="border p-2 text-left w-1/3 text-xs uppercase tracking-wider">Parameters</th>
                <th className="border p-2 text-center bg-gray-200/50">Current</th>
                
                {/* Scenario 2 Header */}
                <th className="border p-2 text-center text-black" style={{ backgroundColor: '#DAE9F8' }}>
                  Scenario 2
                </th>
                
                {/* Scenario 3 Header */}
                <th className="border p-2 text-center text-white" style={{ backgroundColor: '#4D93D9' }}>
                  Scenario 3
                </th>
                
                {/* Scenario 4 Header */}
                <th className="border p-2 text-center text-white" style={{ backgroundColor: '#215C98' }}>
                  Scenario 4
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="border p-2 font-medium bg-gray-50">Headline Rent (€/sqm)</td>
                <td className="border p-1">  <ScenarioField    value={f.rent}    onChange={(v) => S("rent")(v)}  /></td>
                {scenarios.map((sc) => (
                  <td key={sc.id} className="border p-1">
                    <ScenarioField value={resolveScenario(sc, "rent")} onChange={(v) => setScenarioVal(sc.id, "rent", v)} />
                  </td>
                ))}
              </tr>
              <tr>
                <td className="border p-2 font-medium bg-gray-50">Lease Term (months)</td>
                <td className="border p-2 text-right">{F(P(f.duration), 2)}</td>
                {scenarios.map((sc) => (
                  <td key={sc.id} className="border p-1">
                    <ScenarioField value={resolveScenario(sc, "duration")} onChange={(v) => setScenarioVal(sc.id, "duration", v)} />
                  </td>
                ))}
              </tr>
              <tr>
                <td className="border p-2 font-medium bg-gray-50">Rent-Free (months)</td>
                <td className="border p-2 text-right">  {F(P(f.rf), 2)}</td>
                {scenarios.map((sc) => (
                  <td key={sc.id} className="border p-1">
                    <ScenarioField value={resolveScenario(sc, "rf")} onChange={(v) => setScenarioVal(sc.id, "rf", v)} />
                  </td>
                ))}
              </tr>
              <tr>
                <td className="border p-2 font-medium bg-gray-50">
                  Fit-Out ({f.fitMode === "perNLA" ? "€/NLA" : f.fitMode === "perGLA" ? "€/GLA" : "€ total"})
                </td>
                <td className="border p-2 text-right">
                  {F(
                  f.fitMode === "perNLA"
                    ? perNLA
                    : f.fitMode === "perGLA"
                    ? perGLA
                    : totalFit,
                  2
                )}
                </td>
                {scenarios.map((sc) => {
                  let key;
                  if (f.fitMode === "perNLA") key = "fitPerNLA";
                  else if (f.fitMode === "perGLA") key = "fitPerGLA";
                  else key = "fitTot";
                  return (
                    <td key={sc.id} className="border p-1">
                      <ScenarioField
                        value={resolveScenario(sc, key)}
                        onChange={(v) => setScenarioVal(sc.id, key, v)}
                      />
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td className="border p-2 font-medium bg-gray-50">Agent Fees (months)</td>
                <td className="border p-2 text-right">{F(P(f.agent), 2)}</td>
                {scenarios.map((sc) => (
                  <td key={sc.id} className="border p-1">
                    <ScenarioField value={resolveScenario(sc, "agent")} onChange={(v) => setScenarioVal(sc.id, "agent", v)} />
                  </td>
                ))}
              </tr>
              <tr>
                <td className="border p-2 font-medium bg-gray-50 italic">  <span className="text-red-600">Lumpsum Costs (-)</span>{" "}  /{" "}  <span className="text-green-600">Compensation (+)</span></td>
                <td className={`border p-2 text-right font-medium ${  P(f.unforeseen) >= 0 ? "text-green-600" : "text-red-600"}`}>  {FCUR(P(f.unforeseen))}</td>
                {scenarios.map((sc) => (
                  <td  key={sc.id}  className={`border p-1 ${    P(resolveScenario(sc, "unforeseen")) >= 0      ? "text-green-600 font-medium"      : "text-red-600 font-medium"  }`}>
                    <ScenarioField
                      value={resolveScenario(sc, "unforeseen")}
                      onChange={(v) => setScenarioVal(sc.id, "unforeseen", v)}
                    />
                  </td>
                ))}
              </tr>
              <tr className="font-bold text-lg">
                <td className="border p-3 bg-blue-600 text-white">FINAL NER (€/sqm)</td>
                <td className="border p-3 text-right bg-blue-600 text-white">{F(ner4, 2)} €</td>
                {scenarioView.map((sv) => (
                  <td key={sv.id} className="border p-3 text-right" style={scenarioResultCellStyle(sv, scenarioView, ner4)}>{F(sv.ner, 2)} €</td>
                ))}
              </tr>
              <tr className="bg-white text-sm">
                <td className="border p-2 font-semibold bg-gray-50">Deviation vs Current</td>
                <td className="border p-2 text-right text-gray-500 font-medium">Base case</td>
                {scenarioView.map((sv) => (
                  <td key={sv.id} className="border p-2 text-right">
                    <ScenarioDelta base={ner4} val={sv.ner} />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
