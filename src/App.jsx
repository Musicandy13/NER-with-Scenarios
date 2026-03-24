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
function Delta({ base, val }) {
  const pct = base > 0 ? ((val - base) / base) * 100 : 0;
  const down = pct < 0, up = pct > 0;
  return (
    <span className={`${down ? "text-red-600" : up ? "text-green-600" : "text-gray-500"} font-medium ml-2`}>
      {down ? "▼" : up ? "▲" : "■"} {up ? "+" : ""}{F(pct, 2)}%
    </span>
  );
}

function NumericField({ label, value, onChange, format = "2dec", step = 1, min = 0, readOnly = false, suffix, colorize = false }) {
  const [focus, setFocus] = useState(false);
  const inputRef = useRef(null);
  const num = P(value);
  const show = focus ? value : format === "int" ? F(num, 0) : F(num, 2);

  return (
    <label className="block">
      <span className="text-gray-700 text-xs font-bold uppercase">{label}</span>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={show}
          readOnly={readOnly}
          onFocus={() => { setFocus(true); requestAnimationFrame(() => inputRef.current?.select()); }}
          onBlur={(e) => { setFocus(false); onChange(String(clamp(P(e.target.value), min))); }}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.,-]/g, ""))}
          className={`mt-1 block w-full border rounded-md p-2 pr-12 ${readOnly ? "bg-gray-100 text-gray-500" : ""} ${colorize && num > 0 ? "text-green-600" : colorize && num < 0 ? "text-red-600" : ""}`}
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{suffix}</span>}
      </div>
    </label>
  );
}

function ScenarioField({ value, onChange, readOnly = false }) {
  const [focus, setFocus] = useState(false);
  const inputRef = useRef(null);
  return (
    <input
      ref={inputRef}
      type="text"
      value={focus ? value : F(P(value), 2)}
      readOnly={readOnly}
      onFocus={() => { setFocus(true); requestAnimationFrame(() => inputRef.current?.select()); }}
      onBlur={(e) => { setFocus(false); onChange?.(String(P(e.target.value))); }}
      onChange={(e) => onChange?.(e.target.value.replace(/[^\d.,-]/g, ""))}
      className={`w-full border rounded p-1 text-right tabular-nums ${readOnly ? "bg-gray-100" : ""}`}
    />
  );
}

/* ---------- CHARTS ---------- */
const BarNumberLabel = ({ x, y, width, height, value }) => (
  <text x={x + width / 2} y={y + height / 2} textAnchor="middle" dominantBaseline="middle" fill="#fff" fontSize={11} fontWeight="800">
    {F(value, 2)}
  </text>
);

const VerticalMoneyLabel0 = ({ x, y, width, height, value }) => {
  const cx = x + width / 2, cy = y + height / 2;
  return (
    <text x={cx} y={cy} transform={`rotate(-90, ${cx}, ${cy})`} textAnchor="middle" dominantBaseline="middle" fill="#64748b" fontSize={14} fontWeight="800">
      {FCUR0(value)}
    </text>
  );
};

/* ---------- MAIN APP ---------- */
export default function App() {
  const [f, setF] = useState({
    tenant: "", nla: "1000", addon: "5.0", rent: "15.00", duration: "60", rf: "5.0", agent: "2.0",
    fitMode: "perNLA", fitPerNLA: "300.00", fitPerGLA: "285.71", fitTot: "300000", unforeseen: "0"
  });

  const [scenarios, setScenarios] = useState([{ id: 2, overrides: {} }, { id: 3, overrides: {} }, { id: 4, overrides: {} }]);
  const [viewMode, setViewMode] = useState("bars");
  const [isExporting, setIsExporting] = useState(false);
  const calculatorRef = useRef(null);
  const resultsContentRef = useRef(null);

  const S = (k) => (v) => setF(prev => ({ ...prev, [k]: v }));

  /* SYNC LOGIC */
  useEffect(() => {
    const curNla = P(f.nla), curAddon = P(f.addon), curGla = curNla * (1 + curAddon / 100);
    if (f.fitMode === "perNLA") {
      const tot = P(f.fitPerNLA) * curNla;
      setF(s => ({ ...s, fitTot: String(tot), fitPerGLA: String(curGla > 0 ? tot / curGla : 0) }));
    } else if (f.fitMode === "perGLA") {
      const tot = P(f.fitPerGLA) * curGla;
      setF(s => ({ ...s, fitTot: String(tot), fitPerNLA: String(curNla > 0 ? tot / curNla : 0) }));
    } else if (f.fitMode === "total") {
      const tot = P(f.fitTot);
      setF(s => ({ ...s, fitPerNLA: String(curNla > 0 ? tot / curNla : 0), fitPerGLA: String(curGla > 0 ? tot / curGla : 0) }));
    }
  }, [f.fitMode, f.fitPerNLA, f.fitPerGLA, f.fitTot, f.nla, f.addon]);

  /* CALCULATIONS */
  const calcNER = (vals) => {
    const _nla = P(vals.nla), _addon = P(vals.addon), _gla = _nla * (1 + _addon / 100);
    const _rent = P(vals.rent), _dur = P(vals.duration), _rf = P(vals.rf), _agent = P(vals.agent);
    const _fit = f.fitMode === "perNLA" ? P(vals.fitPerNLA) * _nla : f.fitMode === "perGLA" ? P(vals.fitPerGLA) * _gla : P(vals.fitTot);
    const _extra = P(vals.unforeseen);
    
    const gross = _rent * _gla * (_dur - _rf);
    const agentFees = _agent * _rent * _gla;
    const denom = Math.max(1, _dur * _gla);

    return {
      rent: _rent, gla: _gla, totalFit: _fit,
      totalHeadline: _rent * _gla * _dur,
      totalRF: _rent * _gla * _rf,
      agentFees,
      extra: _extra,
      ner1: gross / denom,
      ner2: (gross - _fit) / denom,
      ner3: (gross - _fit - agentFees) / denom,
      ner4: (gross - _fit - agentFees + _extra) / denom
    };
  };

  const res = useMemo(() => calcNER(f), [f]);

  const nerBars = [
    { name: "Headline", sqm: res.rent, color: "#0f172a" },
    { name: "NER 1", sqm: res.ner1, color: "#1e3a8a" },
    { name: "NER 2", sqm: res.ner2, color: "#2563eb" },
    { name: "NER 3", sqm: res.ner3, color: "#3b82f6" },
    { name: "Final", sqm: res.ner4, color: "#60a5fa" }
  ];

  /* EXPORTS */
  const exportNode = async (node, name) => {
    if (!node) return;
    setIsExporting(true);
    setTimeout(async () => {
      const dataUrl = await toPng(node, { backgroundColor: "#fff", pixelRatio: 3, style: { padding: '20px' } });
      const link = document.createElement("a");
      link.download = `${f.tenant || 'NER'}-${name}.png`;
      link.href = dataUrl;
      link.click();
      setIsExporting(false);
    }, 100);
  };

  return (
    <div className="min-h-screen bg-slate-900 p-4 font-sans text-slate-900">
      <div ref={calculatorRef} className="max-w-6xl mx-auto bg-white rounded-3xl shadow-2xl overflow-hidden">
        
        <div className="p-8 border-b bg-slate-50">
          <h1 className="text-3xl font-black text-slate-800 tracking-tight text-center">NET EFFECTIVE RENT CALCULATOR</h1>
          <input 
            className="w-full mt-4 text-center text-xl font-bold bg-transparent border-b-2 border-slate-200 focus:border-blue-500 outline-none" 
            placeholder="ENTER TENANT NAME..." 
            value={f.tenant} onChange={e => S("tenant")(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12">
          
          {/* INPUT SECTION */}
          <div className="lg:col-span-5 p-8 space-y-6 border-r border-slate-100">
            <div className="grid grid-cols-2 gap-4">
              <NumericField label="NLA (sqm)" value={f.nla} onChange={S("nla")} format="int" />
              <NumericField label="Add-On (%)" value={f.addon} onChange={S("addon")} />
            </div>

            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
              <div className="flex gap-4 mb-4 text-[10px] font-black uppercase tracking-widest">
                {["perNLA", "perGLA", "total"].map(m => (
                  <button key={m} onClick={() => S("fitMode")(m)} className={`px-2 py-1 rounded ${f.fitMode === m ? "bg-blue-600 text-white" : "bg-white text-slate-400 border"}`}>{m}</button>
                ))}
              </div>
              <div className="space-y-3">
                <NumericField label="Fit-Out €/NLA" value={f.fitPerNLA} onChange={S("fitPerNLA")} readOnly={f.fitMode !== "perNLA"} suffix="€" />
                <NumericField label="Fit-Out Total" value={f.fitTot} onChange={S("fitTot")} readOnly={f.fitMode !== "total"} suffix="€" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <NumericField label="Headline Rent" value={f.rent} onChange={S("rent")} suffix="€" />
              <NumericField label="Term (mo)" value={f.duration} onChange={S("duration")} format="int" />
              <NumericField label="Rent Free" value={f.rf} onChange={S("rf")} />
              <NumericField label="Agent (mo)" value={f.agent} onChange={S("agent")} />
            </div>
            
            <NumericField label="Lumpsum (-) / Comp (+)" value={f.unforeseen} onChange={S("unforeseen")} colorize suffix="€" />
          </div>

          {/* RESULTS SECTION */}
          <div className="lg:col-span-7 p-8 bg-slate-50/50">
            <div ref={resultsContentRef} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              
              <div className="rounded-xl ring-2 ring-blue-300 ring-offset-1 bg-blue-50 px-4 py-2 flex items-center justify-between mb-4">
                <div className="font-bold text-blue-900">Headline Rent</div>
                <div className="text-xl font-black text-slate-900">{F(res.rent)} €/sqm</div>
              </div>

              <div className="grid grid-cols-2 gap-y-1 text-xs mb-4 text-slate-500 italic">
                <div>Total Headline Rent</div><div className="text-right text-emerald-600 font-bold">{FCUR(res.totalHeadline)}</div>
                <div>Total Rent Frees</div><div className="text-right text-red-500 font-bold">{FCUR(-res.totalRF)}</div>
                <div>Total Agent Fees</div><div className="text-right text-red-500 font-bold">{FCUR(-res.agentFees)}</div>
                <div>Lumpsum / Compensation</div><div className={`text-right font-bold ${res.extra >= 0 ? "text-emerald-600" : "text-red-500"}`}>{FCUR(res.extra)}</div>
              </div>

              <div className="text-sm font-bold text-red-600 border-t pt-2 mb-3">Total Fit Out: {FCUR(res.totalFit)}</div>

              <div className="space-y-1 text-sm border-t pt-2 mb-6">
                {[
                  { l: "1️⃣ incl. Rent Frees", v: res.ner1 },
                  { l: "2️⃣ incl. Fit-Outs", v: res.ner2 },
                  { l: "3️⃣ incl. Agent Fees", v: res.ner3 }
                ].map((row, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <span>{row.l}:</span>
                    <span className="font-bold">{F(row.v)} € <Delta base={res.rent} val={row.v} /></span>
                  </div>
                ))}
              </div>

              <div className="h-48 w-full">
                <ResponsiveContainer>
                  <BarChart data={nerBars} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: "bold" }} />
                    <Bar dataKey="sqm" barSize={45} isAnimationActive={!isExporting}>
                      {nerBars.map((entry, index) => <Cell key={index} fill={entry.color} radius={[4, 4, 0, 0]} />)}
                      <LabelList dataKey="sqm" content={<BarNumberLabel />} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-6 rounded-2xl ring-4 ring-blue-600 ring-offset-2 bg-blue-600 p-4 flex items-center justify-between shadow-xl">
                <div className="text-white font-black uppercase text-xs tracking-widest">🏁 Final NER</div>
                <div className="text-3xl font-black text-white">{F(res.ner4)} €</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-6">
              <button onClick={() => exportNode(resultsContentRef.current, "results")} className="py-3 bg-slate-800 text-white rounded-xl font-bold text-xs uppercase hover:bg-black transition-all">Download Results</button>
              <button onClick={() => exportNode(calculatorRef.current, "full")} className="py-3 border-2 border-slate-800 text-slate-800 rounded-xl font-bold text-xs uppercase hover:bg-slate-50 transition-all">Full Report</button>
            </div>
          </div>
        </div>

        {/* SCENARIO TABLE */}
        <div className="p-8 bg-white border-t">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100 text-[10px] uppercase tracking-tighter text-slate-500">
                <th className="p-3 text-left border">Parameters</th>
                <th className="p-3 border bg-slate-200 text-slate-900">Current</th>
                {scenarios.map(s => <th key={s.id} className="p-3 border bg-blue-50 text-blue-900">Scenario {s.id}</th>)}
              </tr>
            </thead>
            <tbody>
              {["rent", "duration", "rf", "agent", "unforeseen"].map(key => (
                <tr key={key} className="border-b">
                  <td className="p-3 font-bold text-slate-600 capitalize">{key.replace('rf', 'Rent Free')}</td>
                  <td className="p-2 text-right font-mono">{f[key]}</td>
                  {scenarios.map(s => (
                    <td key={s.id} className="p-1">
                      <ScenarioField 
                        value={s.overrides[key] ?? f[key]} 
                        onChange={v => setScenarios(prev => prev.map(sc => sc.id === s.id ? { ...sc, overrides: { ...sc.overrides, [key]: v } } : sc))} 
                      />
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="bg-blue-600 text-white font-black">
                <td className="p-4">FINAL NER (€/sqm)</td>
                <td className="p-4 text-right text-xl">{F(res.ner4)}</td>
                {scenarios.map(s => {
                  const sRes = calcNER({ ...f, ...s.overrides });
                  return <td key={s.id} className="p-4 text-right text-xl border-l border-blue-500">{F(sRes.ner4)}</td>
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
