import React, { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';

import { Button } from '@client/src/components/ui/button';
import { Calendar } from '@client/src/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@client/src/components/ui/popover';
import { Input } from '@client/src/components/ui/input';

interface DatePickerProps {
  value: string | undefined;
  onChange: (date: string | undefined) => void;
  placeholder?: string;
}

const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  placeholder = '选择日期',
}) => {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value ?? '');

  React.useEffect(() => {
    setInputValue(value ?? '');
  }, [value]);

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      const iso = format(date, 'yyyy-MM-dd');
      onChange(iso);
      setInputValue(iso);
    } else {
      onChange(undefined);
      setInputValue('');
    }
    setOpen(false);
  };

  const handleInputBlur = () => {
    if (!inputValue) {
      onChange(undefined);
      return;
    }
    // 尝试解析 yyyy-MM-dd 格式
    const parsed = parseISO(inputValue);
    if (!isNaN(parsed.getTime())) {
      onChange(format(parsed, 'yyyy-MM-dd'));
    } else {
      // 还原
      setInputValue(value ?? '');
    }
  };

  const selectedDate = value ? parseISO(value) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative w-full">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={handleInputBlur}
            placeholder={placeholder}
            className="pr-9"
          />
          <CalendarIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          locale={zhCN}
          initialFocus
        />
        {value && (
          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={() => {
                onChange(undefined);
                setInputValue('');
                setOpen(false);
              }}
            >
              清除日期
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default DatePicker;
