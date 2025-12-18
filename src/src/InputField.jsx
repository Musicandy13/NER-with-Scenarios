export default function InputField({ label, value, onChange, readOnly = false }) {
  return (
    <div className="flex flex-col">
      <label className="text-sm font-medium mb-1">{label}</label>
      <input
        type="number"
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        readOnly={readOnly}
        className={`border rounded px-3 py-2 ${readOnly ? 'bg-gray-100 text-gray-500' : ''}`}
      />
    </div>
  );
}
