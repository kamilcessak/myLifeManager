import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Calendar as CalendarIcon } from 'lucide-react';
import type { Matcher } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

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
        className="z-[400] w-auto border-border p-0 shadow-md ring-1 ring-foreground/10 dark:ring-foreground/15"
        align="start"
        sideOffset={8}
      >
        <div className="p-3 pt-3.5">
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
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
