"use client";

import React, { useState } from "react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday } from "date-fns";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./Popover";
import { cn } from "@/lib/utils";

interface CustomDatePickerProps {
  date: Date | undefined;
  setDate: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
}

export function CustomDatePicker({ date, setDate, placeholder = "Pick a date", className }: CustomDatePickerProps) {
  const [currentMonth, setCurrentMonth] = useState(date || new Date());

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth)
  });

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex h-9 w-full items-center justify-between rounded-md border border-border-default bg-[rgba(0,0,0,0.2)] px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-accent-primary focus:ring-1 focus:ring-accent-primary hover:bg-[rgba(255,255,255,0.02)]",
            !date && "text-text-disabled",
            className
          )}
        >
          {date ? format(date, "PPP") : <span>{placeholder}</span>}
          <CalendarIcon className="h-4 w-4 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="flex items-center justify-between pb-3">
          <button onClick={prevMonth} className="action-btn h-7 w-7 rounded">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="text-sm font-semibold text-text-primary">
            {format(currentMonth, "MMMM yyyy")}
          </div>
          <button onClick={nextMonth} className="action-btn h-7 w-7 rounded">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-text-secondary mb-2">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(day => (
            <div key={day} className="w-8 font-medium">{day}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {/* Empty cells for start of month offset */}
          {Array.from({ length: startOfMonth(currentMonth).getDay() }).map((_, i) => (
            <div key={`empty-${i}`} className="h-8 w-8" />
          ))}
          {/* Days */}
          {daysInMonth.map((day, idx) => {
            const isSelected = date && isSameDay(day, date);
            const isTodayDate = isToday(day);
            return (
              <button
                key={idx}
                onClick={() => setDate(day)}
                className={cn(
                  "h-8 w-8 rounded-md text-sm transition-colors hover:bg-surface-hover flex items-center justify-center",
                  !isSameMonth(day, currentMonth) && "text-text-disabled",
                  isSelected && "bg-accent-primary text-black hover:bg-accent-primary hover:opacity-90",
                  !isSelected && isTodayDate && "border border-accent-primary text-accent-primary"
                )}
              >
                {format(day, "d")}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
