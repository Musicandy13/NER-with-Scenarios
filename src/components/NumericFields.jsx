import { useRef, useState } from "react";
import { clamp, F, P } from "../utils/format";

export function NumericField({
  label,
  value,
  onChange,
  format = "2dec",
  step = 1,
  min = 0,
  readOnly = false,
  onCommit,
  suffix,
  colorize = false,
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
          className={`mt-1 block w-full border rounded-md p-2 pr-16 
  ${readOnly ? "bg-gray-100 text-gray-600" : ""}
  ${colorize && P(value) > 0 ? "text-green-600" : ""}
  ${colorize && P(value) < 0 ? "text-red-600" : ""}
`}
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

export function ScenarioField({ value, onChange, readOnly = false, bold = false }) {
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
        const n = P(e.target.value);
        onChange?.(String(n));
      }}
      onChange={(e) => onChange?.(e.target.value.replace(/[^\d.,-]/g, ""))}
      className={`  w-full border rounded-md p-2 text-right tabular-nums  ${readOnly ? "bg-gray-100 text-gray-800" : ""}  ${bold ? "font-bold" : ""}`}
    />
  );
}
