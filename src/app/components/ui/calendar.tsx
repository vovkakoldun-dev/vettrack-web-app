"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, CaptionProps, useNavigation } from "react-day-picker";

import { cn } from "./utils";
import { buttonVariants } from "./button";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function CustomCaption({ displayMonth }: CaptionProps) {
  const { goToMonth, previousMonth, nextMonth } = useNavigation();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const currentYear = displayMonth.getFullYear();
  const years = Array.from({ length: 11 }, (_, i) => 2020 + i);

  return (
    <div className="flex justify-center pt-1 relative items-center w-full">
      <button
        type="button"
        aria-label="Go to previous month"
        className={cn(
          buttonVariants({ variant: "outline" }),
          "size-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute left-1",
        )}
        onClick={() => previousMonth && goToMonth(previousMonth)}
      >
        <ChevronLeft className="size-4" />
      </button>

      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1 text-sm font-medium hover:text-[var(--brand-green-text)] transition-colors px-1 py-0.5 rounded-md hover:bg-[var(--surface-elevated)]"
        >
          {MONTHS[displayMonth.getMonth()]} {currentYear}
        </button>

        {open && (
          <div
            data-slot="dropdown-menu-content"
            role="menu"
            className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 bg-[var(--surface-white)] border border-[var(--border-color)] shadow-lg overflow-hidden"
            style={{ borderRadius: '10px', width: '220px' }}
          >
            {/* Month grid */}
            <div className="grid grid-cols-3 gap-0.5 p-2">
              {MONTHS.map((m, i) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    goToMonth(new Date(currentYear, i, 1));
                    setOpen(false);
                  }}
                  className="px-1 py-1.5 text-center transition-colors rounded-md"
                  style={{
                    fontSize: '12px',
                    fontWeight: displayMonth.getMonth() === i ? 600 : 400,
                    backgroundColor: displayMonth.getMonth() === i ? 'var(--brand-green-text)' : 'transparent',
                    color: displayMonth.getMonth() === i ? '#000' : 'var(--text-primary)',
                  }}
                  onMouseEnter={(e) => {
                    if (displayMonth.getMonth() !== i) e.currentTarget.style.backgroundColor = 'var(--surface-elevated)';
                  }}
                  onMouseLeave={(e) => {
                    if (displayMonth.getMonth() !== i) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  {m.slice(0, 3)}
                </button>
              ))}
            </div>

            {/* Year row */}
            <div className="border-t border-[var(--border-color)] px-2 py-1.5 flex items-center gap-1 overflow-x-auto">
              {years.map((y) => (
                <button
                  key={y}
                  type="button"
                  onClick={() => {
                    goToMonth(new Date(y, displayMonth.getMonth(), 1));
                    setOpen(false);
                  }}
                  className="px-1.5 py-1 rounded-md transition-colors flex-shrink-0"
                  style={{
                    fontSize: '11px',
                    fontWeight: currentYear === y ? 600 : 400,
                    backgroundColor: currentYear === y ? 'var(--brand-green-text)' : 'transparent',
                    color: currentYear === y ? '#000' : 'var(--text-secondary)',
                  }}
                  onMouseEnter={(e) => {
                    if (currentYear !== y) e.currentTarget.style.backgroundColor = 'var(--surface-elevated)';
                  }}
                  onMouseLeave={(e) => {
                    if (currentYear !== y) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        aria-label="Go to next month"
        className={cn(
          buttonVariants({ variant: "outline" }),
          "size-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute right-1",
        )}
        onClick={() => nextMonth && goToMonth(nextMonth)}
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-2",
        month: "flex flex-col gap-4",
        caption: "flex justify-center pt-1 relative items-center w-full",
        caption_label: "text-sm font-medium",
        nav: "flex items-center gap-1",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "size-7 bg-transparent p-0 opacity-50 hover:opacity-100",
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-x-1",
        head_row: "flex",
        head_cell:
          "text-[var(--brand-green-text)] rounded-md w-8 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: cn(
          "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-[color-mix(in_srgb,var(--brand-green-text)_15%,transparent)] [&:has([aria-selected].day-range-end)]:rounded-r-md",
          props.mode === "range"
            ? "[&:has(>.day-range-end)]:rounded-r-md [&:has(>.day-range-start)]:rounded-l-md first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md"
            : "[&:has([aria-selected])]:rounded-md",
        ),
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "size-8 p-0 font-normal aria-selected:opacity-100",
          "hover:!bg-[color-mix(in_srgb,var(--brand-green-text)_15%,transparent)] hover:!text-[var(--text-primary)]",
        ),
        day_range_start:
          "day-range-start aria-selected:bg-primary aria-selected:text-primary-foreground",
        day_range_end:
          "day-range-end aria-selected:bg-primary aria-selected:text-primary-foreground",
        day_selected:
          "bg-[var(--brand-green-text)] text-[var(--on-brand-green)] hover:bg-[var(--brand-green-text)] hover:text-[var(--on-brand-green)] focus:bg-[var(--brand-green-text)] focus:text-[var(--on-brand-green)]",
        day_today: "ring-1 ring-inset ring-[var(--brand-green-text)]",
        day_outside:
          "day-outside text-muted-foreground aria-selected:text-muted-foreground",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        Caption: CustomCaption,
      }}
      {...props}
    />
  );
}

export { Calendar };
