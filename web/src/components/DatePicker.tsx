import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Calendar as CalendarIcon } from 'lucide-react';
import type { Matcher } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const WEEKDAY_LABELS = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'];

type DatePickerProps = {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  /** Disables the trigger button entirely. */
  disabled?: boolean;
  /** Passed to the calendar as `disabled` (e.g. `{ before: startDate }`). */
  disabledDays?: Matcher | Matcher[];
  placeholder?: string;
  className?: string;
  id?: string;
  'aria-labelledby'?: string;
};

export default function DatePicker({
  value,
  onChange,
  disabled = false,
  disabledDays,
  placeholder = 'Wybierz datę',
  className,
  id,
  'aria-labelledby': ariaLabelledBy,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (disabled) {
      setOpen(false);
    }
  }, [disabled]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          id={id}
          aria-labelledby={ariaLabelledBy}
          disabled={disabled}
          className={cn(
            'h-10 w-full min-w-0 justify-start gap-2 px-3 font-normal shadow-sm',
            'border-border bg-background hover:bg-muted/60 dark:border-input dark:bg-input/30 dark:hover:bg-input/50',
            !value && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon className="size-4 shrink-0 opacity-60" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-left">
            {value ? format(value, 'PPP', { locale: pl }) : placeholder}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="z-[400] w-auto rounded-xl border border-slate-100 bg-white p-4 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1),0_8px_10px_-6px_rgba(0,0,0,0.1)] ring-0 dark:border-gray-700 dark:bg-gray-800"
        align="start"
        sideOffset={8}
      >
        <Calendar
          mode="single"
          required={false}
          selected={value}
          onSelect={(d) => {
            onChange(d);
            setOpen(false);
          }}
          disabled={disabledDays}
          locale={pl}
          weekStartsOn={1}
          showOutsideDays
          defaultMonth={value ?? new Date()}
          formatters={{
            formatWeekdayName: (date) => WEEKDAY_LABELS[date.getDay()],
          }}
          className="bg-transparent p-0 [--cell-radius:9999px] [--cell-size:2rem]"
          classNames={{
            months: 'relative flex flex-col gap-3',
            month: 'flex w-full flex-col gap-3',
            nav: 'absolute inset-x-0 top-0 flex w-full items-center justify-between',
            button_previous:
              'flex size-8 items-center justify-center rounded-full border-0 bg-transparent p-0 text-slate-500 shadow-none transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white',
            button_next:
              'flex size-8 items-center justify-center rounded-full border-0 bg-transparent p-0 text-slate-500 shadow-none transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white',
            month_caption: 'flex h-8 w-full items-center justify-center px-10',
            caption_label: 'select-none text-sm font-semibold text-slate-900 dark:text-gray-100',
            weekdays: 'mb-2 flex gap-1',
            weekday:
              'flex size-8 items-center justify-center text-[12px] font-semibold uppercase tracking-wide text-slate-500 select-none dark:text-gray-400',
            week: 'flex w-full gap-1',
            day: 'relative size-8 p-0 text-center select-none',
            day_button:
              'flex size-8 min-w-8 items-center justify-center rounded-full border-0 text-sm font-normal leading-none shadow-none transition-colors hover:bg-slate-100 hover:text-slate-900 data-[selected-single=true]:bg-blue-500 data-[selected-single=true]:font-medium data-[selected-single=true]:text-white dark:hover:bg-gray-700 dark:hover:text-white dark:data-[selected-single=true]:bg-blue-500',
            today:
              'font-semibold text-blue-500 data-[selected=true]:text-white [&_button]:font-semibold [&_button]:text-blue-500 data-[selected=true]:[&_button]:text-white',
            outside: 'text-slate-400 opacity-60 aria-selected:text-slate-400 dark:text-gray-500',
            disabled: 'text-slate-300 opacity-50 dark:text-gray-600',
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
