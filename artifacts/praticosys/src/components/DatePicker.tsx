import React, { useState, useRef, useEffect } from 'react';
import { DayPicker, Matcher } from 'react-day-picker';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X } from 'lucide-react';
import { BlockedDate, SystemSettings } from '../types';
import { isDateBlocked, isDateInPast } from '../lib/dateBlocking';

interface DatePickerProps {
  value: string;
  onChange: (date: string) => void;
  blockedDates?: BlockedDate[];
  settings?: SystemSettings | null;
  placeholder?: string;
  className?: string;
}

const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  blockedDates = [],
  settings = null,
  placeholder = 'Selecione uma data',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedDate = value ? parseISO(value) : undefined;

  const isDateUnavailable = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return isDateInPast(dateStr) || isDateBlocked(dateStr, blockedDates, settings).blocked;
  };

  const disabledDays: Matcher = isDateUnavailable;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      const dateStr = format(date, 'yyyy-MM-dd');
      if (isDateUnavailable(date)) return;
      onChange(dateStr);
      setIsOpen(false);
    }
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* ── Trigger — mesmo visual do <input type="date"> da Escala Provisória ── */}
      <button
        type="button"
        onClick={() => setIsOpen(v => !v)}
        className={`w-full flex items-center gap-2 border rounded-lg px-2.5 py-2 text-sm outline-none
          focus:ring-2 focus:ring-blue-500 bg-white transition-colors
          ${isOpen
            ? 'border-blue-500 ring-2 ring-blue-500'
            : 'border-slate-200 hover:border-slate-300'}
          ${value ? 'text-slate-900' : 'text-slate-400'}`}
      >
        <CalendarIcon className="w-4 h-4 flex-shrink-0 text-slate-400" />
        <span className="flex-1 text-left">
          {value ? format(parseISO(value), 'dd/MM/yyyy') : placeholder}
        </span>
        {value && (
          <X
            className="w-4 h-4 flex-shrink-0 text-slate-400 hover:text-slate-600"
            onClick={e => {
              e.stopPropagation();
              onChange('');
            }}
          />
        )}
      </button>

      {/* ── Calendário flutuante ── */}
      {isOpen && (
        <div
          className="absolute z-50 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-2xl shadow-slate-200/80 p-3 min-w-[280px]"
          style={{ width: 'max-content' }}
        >
          <DayPicker
            mode="single"
            selected={selectedDate}
            onSelect={handleSelect}
            disabled={disabledDays}
            locale={ptBR}
            showOutsideDays
            classNames={{
              /* layout */
              root:          'select-none',
              months:        'flex flex-col',
              month:         'space-y-2',
              month_caption: 'flex items-center justify-between px-1 mb-1',
              caption_label: 'text-sm font-bold text-slate-800 capitalize',
              nav:           'flex items-center gap-1',
              /* nav buttons */
              button_previous: [
                'flex items-center justify-center w-7 h-7 rounded-lg border border-slate-200',
                'text-slate-500 hover:bg-slate-100 hover:border-slate-300 transition-colors',
                'disabled:opacity-30 disabled:cursor-not-allowed',
              ].join(' '),
              button_next: [
                'flex items-center justify-center w-7 h-7 rounded-lg border border-slate-200',
                'text-slate-500 hover:bg-slate-100 hover:border-slate-300 transition-colors',
                'disabled:opacity-30 disabled:cursor-not-allowed',
              ].join(' '),
              /* grid */
              month_grid:    'w-full border-collapse',
              weekdays:      'flex mb-1',
              weekday:       'w-9 h-7 flex items-center justify-center text-[10px] font-bold text-slate-400 uppercase',
              weeks:         'space-y-0.5',
              week:          'flex',
              /* days */
              day:           'w-9 h-9 p-0',
              day_button: [
                'w-full h-full flex items-center justify-center text-sm rounded-lg',
                'transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400',
                'hover:bg-blue-50 hover:text-blue-700',
              ].join(' '),
              /* states */
              selected:      'bg-blue-600 text-white font-bold rounded-lg',
              today:         'font-bold text-blue-600 underline underline-offset-2',
              disabled:      'text-slate-300 bg-slate-50 cursor-not-allowed rounded-lg',
              outside:       'text-slate-300',
              hidden:        'invisible',
            }}
            components={{
              Chevron: ({ orientation }) =>
                orientation === 'left'
                  ? <ChevronLeft className="w-3.5 h-3.5" />
                  : <ChevronRight className="w-3.5 h-3.5" />,
            }}
          />
        </div>
      )}
    </div>
  );
};

export default DatePicker;
