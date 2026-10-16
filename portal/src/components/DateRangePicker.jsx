import { useMemo } from 'react';
import { DatePicker } from 'antd';
import dayjs from 'dayjs';

// The one date-range filter used across the admin (matches the Sales page):
// quick presets, YYYY-MM-DD, "Start Date → End Date". Every other prop
// (value, onChange, size, style, disabledDate, placeholder…) passes through, so
// it drops in wherever a plain RangePicker was used as a filter.
export default function DateRangePicker({ presets, ...props }) {
  // Computed per mount (dayjs weeks start on Sunday). Each value is a
  // [start, end] dayjs tuple, same shape a manual pick produces.
  const defaultPresets = useMemo(() => [
    { label: 'Today',        value: [dayjs().startOf('day'),   dayjs().endOf('day')] },
    { label: 'Yesterday',    value: [dayjs().subtract(1, 'day').startOf('day'),     dayjs().subtract(1, 'day').endOf('day')] },
    { label: 'Last 7 Days',  value: [dayjs().subtract(6, 'day').startOf('day'),     dayjs().endOf('day')] },
    { label: 'Last 30 Days', value: [dayjs().subtract(29, 'day').startOf('day'),    dayjs().endOf('day')] },
    { label: 'This Week',    value: [dayjs().startOf('week'),  dayjs().endOf('week')] },
    { label: 'Last Week',    value: [dayjs().subtract(1, 'week').startOf('week'),   dayjs().subtract(1, 'week').endOf('week')] },
    { label: 'This Month',   value: [dayjs().startOf('month'), dayjs().endOf('month')] },
    { label: 'Last Month',   value: [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] },
    { label: 'This Year',    value: [dayjs().startOf('year'),  dayjs().endOf('year')] },
    { label: 'Last Year',    value: [dayjs().subtract(1, 'year').startOf('year'),   dayjs().subtract(1, 'year').endOf('year')] },
  ], []);

  return (
    <DatePicker.RangePicker
      format="YYYY-MM-DD"
      placeholder={['Start Date', 'End Date']}
      allowClear
      presets={presets ?? defaultPresets}
      {...props}
    />
  );
}
