import dayjs, { type Dayjs } from 'dayjs';
import type { MesStateData, ProductionCalendar } from '../models/mes';

const DAY_START = '00:00';
const DAY_END = '24:00';
const MAX_CALENDAR_SEARCH_DAYS = 366;

const toMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const toTimeString = (minutes: number) => {
  const value = ((minutes % 1440) + 1440) % 1440;
  const hours = Math.floor(value / 60);
  const mins = value % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

const sameDay = (left: Dayjs, right: Dayjs) => left.format('YYYY-MM-DD') === right.format('YYYY-MM-DD');

const buildShiftSegments = (segments: ProductionCalendar['segments']) =>
  segments
    .slice()
    .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime))
    .map((segment) => ({
      ...segment,
      startMinute: toMinutes(segment.startTime === DAY_END ? DAY_START : segment.startTime),
      endMinute: segment.endTime === DAY_END ? 1440 : toMinutes(segment.endTime),
      crossesMidnight: segment.endTime !== DAY_END && toMinutes(segment.endTime) < toMinutes(segment.startTime),
    }));

const isInRange = (date: Dayjs, calendar: ProductionCalendar) => {
  if (calendar.effectiveFrom && date.isBefore(dayjs(calendar.effectiveFrom), 'day')) return false;
  if (calendar.effectiveTo && date.isAfter(dayjs(calendar.effectiveTo), 'day')) return false;
  return true;
};

const isMatchingRecurringRule = (date: Dayjs, calendar: ProductionCalendar) => {
  if (calendar.scope !== '循环') return false;
  if (!isInRange(date, calendar)) return false;

  if (calendar.recurrenceType === '每日') return true;
  if (calendar.recurrenceType === '每周') return calendar.weekdays?.includes(date.day()) ?? false;
  if (calendar.recurrenceType === '每月') return calendar.monthDays?.includes(date.date()) ?? false;
  return false;
};

const isMatchingExceptionRule = (date: Dayjs, calendar: ProductionCalendar) => {
  if (calendar.scope !== '不循环') return false;
  if (!isInRange(date, calendar)) return false;
  if (calendar.effectiveFrom && date.isBefore(dayjs(calendar.effectiveFrom), 'day')) return false;
  if (calendar.effectiveTo && date.isAfter(dayjs(calendar.effectiveTo), 'day')) return false;
  return true;
};

const getApplicableCalendar = (data: Pick<MesStateData, 'productionCalendars'>, lineCode: string, date: Dayjs) => {
  const calendars = data.productionCalendars.filter((item) => item.enabled && item.lineCode === lineCode);
  return calendars.find((item) => isMatchingExceptionRule(date, item)) ?? calendars.find((item) => isMatchingRecurringRule(date, item)) ?? null;
};

export const hasLineCalendar = (data: Pick<MesStateData, 'productionCalendars'>, lineCode: string) => data.productionCalendars.some((item) => item.enabled && item.lineCode === lineCode);

const getWorkWindowsForDay = (calendar: ProductionCalendar | null, date: Dayjs) => {
  if (!calendar) return [];
  const segments = buildShiftSegments(calendar.segments).filter((segment) => segment.segmentType === '工作');
  return segments.flatMap((segment) => {
    const start = date.startOf('day').add(segment.startMinute, 'minute');
    const end = segment.crossesMidnight
      ? date.startOf('day').add(1, 'day').add(segment.endMinute, 'minute')
      : date.startOf('day').add(segment.endMinute, 'minute');
    if (end.isBefore(start) || end.isSame(start)) return [];
    return [{ start, end }];
  });
};

export const getWorkWindowsBetween = (data: Pick<MesStateData, 'productionCalendars'>, lineCode: string, startAt: Dayjs, endAt: Dayjs) => {
  const windows: Array<{ start: Dayjs; end: Dayjs }> = [];
  let cursor = startAt.startOf('day');
  const endDay = endAt.startOf('day');

  while (cursor.isBefore(endDay) || cursor.isSame(endDay)) {
    const calendar = getApplicableCalendar(data, lineCode, cursor);
    getWorkWindowsForDay(calendar, cursor)
      .filter((window) => window.end.isAfter(startAt) && window.start.isBefore(endAt))
      .forEach((window) => {
        windows.push({
          start: window.start.isBefore(startAt) ? startAt : window.start,
          end: window.end.isAfter(endAt) ? endAt : window.end,
        });
      });
    cursor = cursor.add(1, 'day');
  }

  return windows.sort((a, b) => a.start.valueOf() - b.start.valueOf());
};

export const nextWorkingTime = (data: MesStateData, lineCode: string, cursor: Dayjs) => {
  let current = cursor;
  for (let day = 0; day <= MAX_CALENDAR_SEARCH_DAYS; day += 1) {
    const calendar = getApplicableCalendar(data, lineCode, current);
    const windows = getWorkWindowsForDay(calendar, current);
    const match = windows.find((window) => current.isBefore(window.end) && (current.isAfter(window.start) || current.isSame(window.start)));
    if (match) {
      return current.isBefore(match.start) ? match.start : current;
    }
    const nextWindow = windows.find((window) => current.isBefore(window.start));
    if (nextWindow) return nextWindow.start;
    current = current.add(1, 'day').startOf('day');
  }
  throw new Error(`产线 ${lineCode} 在可搜索范围内未找到可用工作时间，请检查生产日历配置`);
};

export const addWorkingMinutes = (data: MesStateData, lineCode: string, startAt: Dayjs, minutes: number) => {
  let current = nextWorkingTime(data, lineCode, startAt);
  let remaining = minutes;
  let guard = 0;

  while (remaining > 0) {
    guard += 1;
    if (guard > MAX_CALENDAR_SEARCH_DAYS * 4) {
      throw new Error(`产线 ${lineCode} 在可搜索范围内无法累计足够工时，请检查生产日历配置`);
    }
    const calendar = getApplicableCalendar(data, lineCode, current);
    const windows = getWorkWindowsForDay(calendar, current);
    const window = windows.find((item) => (current.isAfter(item.start) || current.isSame(item.start)) && current.isBefore(item.end));
    if (!window) {
      current = nextWorkingTime(data, lineCode, current.add(1, 'day').startOf('day'));
      continue;
    }
    const available = Math.max(0, window.end.diff(current, 'minute'));
    if (available >= remaining) {
      return current.add(remaining, 'minute');
    }
    remaining -= available;
    current = nextWorkingTime(data, lineCode, window.end.add(1, 'minute'));
  }

  return current;
};

export const getWorkMinutesUntilBreak = (data: MesStateData, lineCode: string, startAt: Dayjs) => {
  if (!hasLineCalendar(data, lineCode)) return Number.POSITIVE_INFINITY;
  const current = nextWorkingTime(data, lineCode, startAt);
  const calendar = getApplicableCalendar(data, lineCode, current);
  const windows = getWorkWindowsForDay(calendar, current);
  const window = windows.find((item) => (current.isAfter(item.start) || current.isSame(item.start)) && current.isBefore(item.end));
  return window ? Math.max(0, window.end.diff(current, 'minute')) : 0;
};

export const formatCalendarSegments = (segments: ProductionCalendar['segments']) =>
  segments
    .slice()
    .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime))
    .map((segment) => `${segment.segmentType}${segment.startTime}-${segment.endTime}`)
    .join('；');

export const buildCalendarLabel = (calendar: ProductionCalendar) => {
  if (calendar.scope === '不循环') {
    return `${calendar.effectiveFrom ?? '开始'} 至 ${calendar.effectiveTo ?? '结束'} ${formatCalendarSegments(calendar.segments)}`;
  }
  const recurrence = calendar.recurrenceType === '每周'
    ? `每周${(calendar.weekdays ?? []).map((day) => '日一二三四五六'[day] ?? day).join('、')}`
    : calendar.recurrenceType === '每月'
      ? `每月${(calendar.monthDays ?? []).join('、')}日`
      : '每日';
  return `${recurrence} ${calendar.effectiveFrom ?? '开始'} 至 ${calendar.effectiveTo ?? '结束'} ${formatCalendarSegments(calendar.segments)}`;
};
