import React, { useState, useRef, useEffect } from 'react';
import { DayPicker, Matcher } from 'react-day-picker';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon, X } from 'lucide-react';
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
  placeholder = "Selecione uma data",
  className = ""
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
      <div 
        className="flex items-center gap-2 p-2 border rounded-md cursor-pointer bg-white hover:border-blue-500 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <CalendarIcon className="w-4 h-4 text-gray-500" />
        <span className={value ? "text-gray-900" : "text-gray-400"}>
          {value ? format(parseISO(value), 'dd/MM/yyyy') : placeholder}
        </span>
        {value && (
          <X 
            className="w-4 h-4 ml-auto text-gray-400 hover:text-gray-600" 
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
            }}
          />
        )}
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 bg-white border rounded-lg shadow-xl p-2">
          <DayPicker
            mode="single"
            selected={selectedDate}
            onSelect={handleSelect}
            disabled={disabledDays}
            locale={ptBR}
            className="border-none"
            modifiersClassNames={{
              selected: "bg-blue-600 text-white rounded-full",
              today: "font-bold text-blue-600 border-b-2 border-blue-600",
              disabled: "bg-gray-100 text-gray-400 cursor-not-allowed"
            }}
          />
        </div>
      )}
    </div>
  );
};

export default DatePicker;
