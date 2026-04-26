import { useEffect, useMemo } from 'react';
import { Clock } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const STEP = 15;
const START_MIN = 8 * 60;
const END_MIN = 23 * 60 + 45;

function buildOptions(): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  for (let total = START_MIN; total <= END_MIN; total += STEP) {
    const h = Math.floor(total / 60);
    const m = total % 60;
    const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    out.push({ value, label: value });
  }
  return out;
}

const OPTIONS = buildOptions();

function nearestTimeSlot(hm: string, step: number = STEP): string {
  const parts = hm.split(':');
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const mins = Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : START_MIN;
  let snapped = Math.round(mins / step) * step;
  snapped = Math.max(START_MIN, Math.min(END_MIN, snapped));
  const nh = Math.floor(snapped / 60);
  const nm = snapped % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}

function optionMinutes(value: string): number {
  const [h, m] = value.split(':').map((x) => parseInt(x, 10));
  return h * 60 + m;
}

/** Smallest selectable slot strictly after `startMins` (for end time on the same day). */
function firstSlotAfter(startMins: number): string | null {
  for (const o of OPTIONS) {
    if (optionMinutes(o.value) > startMins) {
      return o.value;
    }
  }
  return null;
}

function effectiveSlot(value: string, minMinutes?: number): string {
  let slot = nearestTimeSlot(value);
  if (minMinutes == null) {
    return slot;
  }
  const slotM = optionMinutes(slot);
  if (slotM >= minMinutes) {
    return slot;
  }
  for (const o of OPTIONS) {
    if (optionMinutes(o.value) >= minMinutes) {
      return o.value;
    }
  }
  return slot;
}

type TimePickerProps = {
  value: string;
  onChange: (hm: string) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  'aria-labelledby'?: string;
  /**
   * Minimum selectable time as minutes from midnight (inclusive).
   * Options before this are omitted from the list.
   */
  minMinutes?: number;
};

export default function TimePicker({
  value,
  onChange,
  disabled = false,
  className,
  id,
  'aria-labelledby': ariaLabelledBy,
  minMinutes,
}: TimePickerProps) {
  const options = useMemo(() => {
    if (minMinutes == null) {
      return OPTIONS;
    }
    const filtered = OPTIONS.filter((o) => optionMinutes(o.value) >= minMinutes);
    return filtered.length > 0 ? filtered : OPTIONS;
  }, [minMinutes]);

  const slot = effectiveSlot(value, minMinutes);

  useEffect(() => {
    if (disabled) {
      return;
    }
    const next = effectiveSlot(value, minMinutes);
    if (next !== value) {
      onChange(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- snap when value/min changes; onChange is stable in parents
  }, [disabled, value, minMinutes]);

  return (
    <Select value={slot} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger
        id={id}
        aria-labelledby={ariaLabelledBy}
        size="default"
        className={cn(
          buttonVariants({ variant: 'outline', size: 'default' }),
          'h-10 w-full min-w-[6.5rem] justify-start gap-2 border-border bg-background pl-3 font-normal shadow-sm hover:bg-muted/60',
          '[&>svg:last-child]:ml-auto [&>svg:last-child]:opacity-60',
          'dark:border-input dark:bg-input/30 dark:hover:bg-input/50',
          className
        )}
      >
        <Clock className="size-4 shrink-0 opacity-70 dark:opacity-80" aria-hidden />
        <SelectValue />
      </SelectTrigger>
      <SelectContent
        className="time-picker-content z-[400] max-h-60 rounded-xl border border-slate-100 bg-white p-1.5 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1),0_8px_10px_-6px_rgba(0,0,0,0.1)] ring-0 dark:border-gray-700 dark:bg-gray-800"
        position="popper"
        sideOffset={6}
      >
        {options.map((o) => (
          <SelectItem
            key={o.value}
            value={o.value}
            className="rounded-lg py-2 pl-4 pr-10 text-sm transition-colors hover:bg-slate-50 focus:bg-slate-50 data-[state=checked]:bg-blue-50 data-[state=checked]:font-medium data-[state=checked]:text-blue-500 data-[state=checked]:[&_svg]:text-blue-500 dark:hover:bg-gray-700 dark:focus:bg-gray-700 dark:data-[state=checked]:bg-blue-500/15 dark:data-[state=checked]:text-blue-300 dark:data-[state=checked]:[&_svg]:text-blue-300"
          >
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export { firstSlotAfter, optionMinutes };
