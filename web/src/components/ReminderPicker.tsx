interface ReminderPickerProps {
  value: number | null;
  onChange: (value: number | null) => void;
  disabled?: boolean;
}

const REMINDER_OPTIONS: Array<{ value: number | null; label: string }> = [
  { value: null, label: 'Brak' },
  { value: 0, label: 'W momencie rozpoczęcia' },
  { value: 5, label: '5 minut przed' },
  { value: 10, label: '10 minut przed' },
  { value: 15, label: '15 minut przed' },
  { value: 30, label: '30 minut przed' },
  { value: 60, label: '1 godzina przed' },
  { value: 120, label: '2 godziny przed' },
  { value: 1440, label: '1 dzień przed' },
];

export default function ReminderPicker({ value, onChange, disabled }: ReminderPickerProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-900 mb-1 dark:text-gray-300">
        Przypomnienie
      </label>
      <select
        value={value === null ? '__none__' : String(value)}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === '__none__' ? null : Number(v));
        }}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
        disabled={disabled}
      >
        {REMINDER_OPTIONS.map((opt) => (
          <option key={opt.value === null ? '__none__' : opt.value} value={opt.value === null ? '__none__' : opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
