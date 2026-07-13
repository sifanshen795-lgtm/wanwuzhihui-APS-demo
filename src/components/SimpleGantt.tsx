import dayjs from 'dayjs';
import type { CSSProperties, MouseEvent as ReactMouseEvent, WheelEvent as ReactWheelEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { MesStateData, ScheduleItem } from '../domain/models/mes';
import { getWorkWindowsBetween } from '../domain/services/calendarService';
import { lineName, materialName } from '../utils/display';

const clampHourWidth = (value: number) => Math.max(1, Math.min(220, value));
type GanttDragState =
  | { mode: 'move'; startX: number; startScrollLeft: number }
  | { mode: 'resize-left' | 'resize-right'; startX: number; startThumbWidth: number; startThumbLeft: number };
type ItemDragState = {
  mode: 'move' | 'resize-left' | 'resize-right';
  itemId: string;
  lineCode: string;
  startX: number;
  startY: number;
  startMs: number;
  endMs: number;
  minStart: number;
  totalMs: number;
};
export type GanttDisplayStatus = '已排程' | '已下推排程单' | '排程单待执行' | '排程单执行中' | '排程单已完成';
export type GanttItem = ScheduleItem & {
  ganttStatus?: GanttDisplayStatus;
  deliveryDate?: string;
  productionOrderStatus?: string;
  scheduleReason?: string;
};

const getTickIntervalHours = (totalHours: number) => {
  if (totalHours <= 12) return 1;
  if (totalHours <= 24) return 2;
  if (totalHours <= 72) return 6;
  if (totalHours <= 168) return 12;
  return 24;
};

const alignTickStart = (timeMs: number, intervalHours: number) => {
  const value = dayjs(timeMs).minute(0).second(0).millisecond(0);
  if (intervalHours < 24) {
    return value.hour(Math.floor(value.hour() / intervalHours) * intervalHours);
  }
  return value.startOf('day');
};

const buildTimeTicks = (minStart: number, maxEnd: number, totalMs: number) => {
  const totalHours = totalMs / 1000 / 60 / 60;
  const intervalHours = getTickIntervalHours(totalHours);
  const ticks: Array<{ timeMs: number; left: number; label: string }> = [];
  let cursor = alignTickStart(minStart, intervalHours);
  if (cursor.valueOf() < minStart) cursor = cursor.add(intervalHours, 'hour');

  while (cursor.valueOf() <= maxEnd) {
    const timeMs = cursor.valueOf();
    ticks.push({
      timeMs,
      left: ((timeMs - minStart) / totalMs) * 100,
      label: intervalHours >= 24 ? cursor.format('MM-DD') : cursor.format('MM-DD HH:mm'),
    });
    cursor = cursor.add(intervalHours, 'hour');
  }

  return ticks;
};

const buildDayTicks = (minStart: number, maxEnd: number, totalMs: number) => {
  const ticks: Array<{ timeMs: number; left: number; width: number; label: string; subLabel: string; isWeekend: boolean }> = [];
  let cursor = dayjs(minStart).startOf('day');
  while (cursor.valueOf() < maxEnd) {
    const startMs = Math.max(cursor.valueOf(), minStart);
    const endMs = Math.min(cursor.add(1, 'day').valueOf(), maxEnd);
    if (endMs > startMs) {
      ticks.push({
        timeMs: cursor.valueOf(),
        left: ((startMs - minStart) / totalMs) * 100,
        width: ((endMs - startMs) / totalMs) * 100,
        label: cursor.format('D'),
        subLabel: '日一二三四五六'[cursor.day()],
        isWeekend: cursor.day() === 0 || cursor.day() === 6,
      });
    }
    cursor = cursor.add(1, 'day');
  }
  return ticks;
};

const buildMonthTicks = (minStart: number, maxEnd: number, totalMs: number) => {
  const ticks: Array<{ timeMs: number; left: number; width: number; label: string }> = [];
  let cursor = dayjs(minStart).startOf('month');
  while (cursor.valueOf() < maxEnd) {
    const startMs = Math.max(cursor.valueOf(), minStart);
    const endMs = Math.min(cursor.add(1, 'month').valueOf(), maxEnd);
    if (endMs > startMs) {
      ticks.push({
        timeMs: cursor.valueOf(),
        left: ((startMs - minStart) / totalMs) * 100,
        width: ((endMs - startMs) / totalMs) * 100,
        label: cursor.format('YYYY年M月'),
      });
    }
    cursor = cursor.add(1, 'month');
  }
  return ticks;
};

const ganttStatusColor: Record<GanttDisplayStatus, string> = {
  已排程: '#86909C',
  已下推排程单: '#004098',
  排程单待执行: '#4080FF',
  排程单执行中: '#FF7D00',
  排程单已完成: '#00B42A',
};
const ganttStatusLabels: GanttDisplayStatus[] = ['已排程', '已下推排程单', '排程单待执行', '排程单执行中', '排程单已完成'];
const getGanttDisplayStatus = (item: GanttItem): GanttDisplayStatus => {
  if (item.ganttStatus) return item.ganttStatus;
  if (item.status === '已完成') return '排程单已完成';
  if (item.status === '执行中') return '排程单执行中';
  if (item.status === '待执行') return '排程单待执行';
  return '已下推排程单';
};

export function SimpleGantt({
  items,
  data,
  onItemClick,
  onItemEdit,
  onItemWindowChange,
  canEditItem,
  editable = false,
  visibleStartAt,
  visibleEndAt,
  hourWidth = 56,
  onHourWidthChange,
}: {
  items: GanttItem[];
  data: Pick<MesStateData, 'lines' | 'materials' | 'productionCalendars'>;
  onItemClick?: (item: GanttItem) => void;
  onItemEdit?: (item: GanttItem) => void;
  onItemWindowChange?: (item: GanttItem, payload: { lineCode: string; startAt: string; endAt: string }) => void;
  canEditItem?: (item: GanttItem) => boolean;
  editable?: boolean;
  visibleStartAt?: string;
  visibleEndAt?: string;
  hourWidth?: number;
  onHourWidthChange?: (value: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<GanttDragState | null>(null);
  const itemDragRef = useRef<ItemDragState | null>(null);
  const itemDragPreviewRef = useRef<{ itemId: string; lineCode: string; startMs: number; endMs: number } | null>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const autoScrollKeyRef = useRef<string | null>(null);
  const [scrollState, setScrollState] = useState({ scrollLeft: 0, clientWidth: 1, scrollWidth: 1 });
  const [hoverCursor, setHoverCursor] = useState<{ left: number; label: string } | null>(null);
  const [hoverTooltip, setHoverTooltip] = useState<{ item: GanttItem; x: number; y: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ item: GanttItem; x: number; y: number; canEdit: boolean } | null>(null);
  const [dragPreview, setDragPreview] = useState<{ itemId: string; lineCode: string; startMs: number; endMs: number } | null>(null);
  const enabledLines = data.lines.filter((line) => line.enabled);
  const timelineMetrics = useMemo(() => {
    if (!items.length) {
      return { minStart: 0, maxEnd: 1, totalMs: 1, totalHours: 1, timelineWidth: 720 };
    }
    const minStart = visibleStartAt ? dayjs(visibleStartAt).valueOf() : Math.min(...items.map((item) => dayjs(item.startAt).valueOf()));
    const maxEnd = visibleEndAt ? dayjs(visibleEndAt).valueOf() : Math.max(...items.map((item) => dayjs(item.endAt).valueOf()));
    const totalMs = Math.max(1, maxEnd - minStart);
    const totalHours = totalMs / 1000 / 60 / 60;
    const timelineWidth = Math.max(720, Math.round(totalHours * hourWidth));
    return { minStart, maxEnd, totalMs, totalHours, timelineWidth };
  }, [hourWidth, items, visibleEndAt, visibleStartAt]);
  const timelineMetricsRef = useRef(timelineMetrics);
  timelineMetricsRef.current = timelineMetrics;
  const syncScrollState = () => {
    const node = scrollRef.current;
    if (!node) return;
    setScrollState({
      scrollLeft: node.scrollLeft,
      clientWidth: Math.max(1, node.clientWidth),
      scrollWidth: Math.max(1, node.scrollWidth),
    });
  };

  useEffect(() => {
    syncScrollState();
  }, [hourWidth, items.length, visibleStartAt, visibleEndAt]);

  useEffect(() => {
    if (!items.length) return;
    const key = `${visibleStartAt ?? ''}-${visibleEndAt ?? ''}-${items.length}`;
    if (autoScrollKeyRef.current === key) return;
    autoScrollKeyRef.current = key;

    window.requestAnimationFrame(() => {
      const node = scrollRef.current;
      if (!node) return;
      const startMs = visibleStartAt ? dayjs(visibleStartAt).valueOf() : Math.min(...items.map((item) => dayjs(item.startAt).valueOf()));
      const endMs = visibleEndAt ? dayjs(visibleEndAt).valueOf() : Math.max(...items.map((item) => dayjs(item.endAt).valueOf()));
      const nowMs = dayjs().valueOf();
      if (nowMs < startMs || nowMs > endMs) return;
      const ratio = (nowMs - startMs) / Math.max(1, endMs - startMs);
      node.scrollLeft = Math.max(0, node.scrollWidth * ratio - node.clientWidth * 0.35);
      syncScrollState();
    });
  }, [items, visibleEndAt, visibleStartAt]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const drag = dragRef.current;
      const node = scrollRef.current;
      const track = trackRef.current;
      if (!drag || !node || !track) return;
      const maxScroll = Math.max(0, node.scrollWidth - node.clientWidth);
      const rect = track.getBoundingClientRect();
      const thumbWidth = Math.max(28, (node.clientWidth / node.scrollWidth) * rect.width);
      const deltaX = event.clientX - drag.startX;

      if (drag.mode === 'move') {
        const maxThumbTravel = Math.max(1, rect.width - thumbWidth);
        node.scrollLeft = drag.startScrollLeft + (deltaX / maxThumbTravel) * maxScroll;
        syncScrollState();
        return;
      }

      const nextThumbWidth = drag.mode === 'resize-left'
        ? drag.startThumbWidth - deltaX
        : drag.startThumbWidth + deltaX;
      const safeThumbWidth = Math.max(18, Math.min(rect.width, nextThumbWidth));
      const nextScrollWidth = (node.clientWidth * rect.width) / safeThumbWidth;
      const totalHours = Math.max(1, (node.dataset.totalHours ? Number(node.dataset.totalHours) : 1));
      const nextHourWidth = nextScrollWidth / totalHours;
      updateHourWidth(nextHourWidth);
      syncScrollState();
    };
    const handleMouseUp = () => {
      dragRef.current = null;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const drag = itemDragRef.current;
      if (!drag) return;
      const { timelineWidth, totalMs } = timelineMetricsRef.current;
      const deltaX = event.clientX - drag.startX;
      const deltaRatio = deltaX / Math.max(1, timelineWidth);
      const deltaMs = deltaRatio * drag.totalMs;
      let previewStartMs = drag.startMs;
      let previewEndMs = drag.endMs;
      if (drag.mode === 'move') {
        const duration = drag.endMs - drag.startMs;
        previewStartMs = drag.startMs + deltaMs;
        previewEndMs = previewStartMs + duration;
        if (previewStartMs < drag.minStart) {
          previewStartMs = drag.minStart;
          previewEndMs = previewStartMs + duration;
        }
      } else if (drag.mode === 'resize-left') {
        previewStartMs = Math.min(drag.endMs - 15 * 60 * 1000, drag.startMs + deltaMs);
      } else {
        previewEndMs = Math.max(drag.startMs + 15 * 60 * 1000, drag.endMs + deltaMs);
      }
      let nextLineCode = drag.lineCode;
      const rowIndex = enabledLines.findIndex((line) => {
        const row = rowRefs.current[line.code];
        if (!row) return false;
        const rowRect = row.getBoundingClientRect();
        return event.clientY >= rowRect.top && event.clientY <= rowRect.bottom;
      });
      if (rowIndex >= 0) nextLineCode = enabledLines[rowIndex].code;
      const nextPreview = { itemId: drag.itemId, lineCode: nextLineCode, startMs: previewStartMs, endMs: previewEndMs };
      itemDragPreviewRef.current = nextPreview;
      setDragPreview(nextPreview);
      setHoverCursor(null);
    };
    const handleMouseUp = () => {
      const drag = itemDragRef.current;
      const preview = itemDragPreviewRef.current;
      itemDragRef.current = null;
      itemDragPreviewRef.current = null;
      setDragPreview(null);
      if (!drag || !preview || preview.itemId !== drag.itemId) return;
      const item = items.find((entry) => entry.id === drag.itemId);
      if (!item || !onItemWindowChange) return;
      onItemWindowChange(item, {
        lineCode: preview.lineCode,
        startAt: dayjs(preview.startMs).toISOString(),
        endAt: dayjs(preview.endMs).toISOString(),
      });
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [enabledLines, items, onItemWindowChange]);

  const updateHourWidth = (nextValue: number) => {
    onHourWidthChange?.(clampHourWidth(nextValue));
  };

  const handleTrackMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('.gantt-scroll-thumb')) return;
    const node = scrollRef.current;
    const track = trackRef.current;
    if (!node || !track) return;
    const rect = track.getBoundingClientRect();
    const clickRatio = (event.clientX - rect.left) / rect.width;
    const maxScroll = Math.max(0, node.scrollWidth - node.clientWidth);
    node.scrollLeft = maxScroll * clickRatio;
    syncScrollState();
  };

  const handleThumbMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    const node = scrollRef.current;
    if (!node) return;
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = { mode: 'move', startX: event.clientX, startScrollLeft: node.scrollLeft };
  };

  const handleResizeMouseDown = (mode: 'resize-left' | 'resize-right') => (event: ReactMouseEvent<HTMLSpanElement>) => {
    const node = scrollRef.current;
    const track = trackRef.current;
    if (!node || !track) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = track.getBoundingClientRect();
    const thumbWidth = Math.max(28, (node.clientWidth / node.scrollWidth) * rect.width);
    const thumbLeft = maxScroll > 0 ? (node.scrollLeft / maxScroll) * (rect.width - thumbWidth) : 0;
    dragRef.current = {
      mode,
      startX: event.clientX,
      startThumbWidth: thumbWidth,
      startThumbLeft: thumbLeft,
    };
  };

  const handleZoomWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    updateHourWidth(hourWidth + (event.deltaY < 0 ? 8 : -8));
  };

  const maxScroll = Math.max(0, scrollState.scrollWidth - scrollState.clientWidth);
  const thumbWidthPercent = Math.min(100, Math.max(8, (scrollState.clientWidth / scrollState.scrollWidth) * 100));
  const thumbLeftPercent = maxScroll > 0 ? (scrollState.scrollLeft / maxScroll) * (100 - thumbWidthPercent) : 0;

  if (!items.length) return <div style={{ color: '#7a869a' }}>暂无排程，请先从生产订单下推排程。</div>;

  const { minStart, maxEnd, totalMs, totalHours, timelineWidth } = timelineMetrics;
  const timeTicks = buildTimeTicks(minStart, maxEnd, totalMs);
  const dayTicks = buildDayTicks(minStart, maxEnd, totalMs);
  const monthTicks = buildMonthTicks(minStart, maxEnd, totalMs);
  const nowMs = dayjs().valueOf();
  const nowLeft = nowMs >= minStart && nowMs <= maxEnd ? ((nowMs - minStart) / totalMs) * 100 : null;
  const updateHoverCursor = (event: ReactMouseEvent<HTMLDivElement>) => {
    const node = scrollRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const x = event.clientX - rect.left + node.scrollLeft;
    const ratio = Math.max(0, Math.min(1, x / timelineWidth));
    const timeMs = minStart + totalMs * ratio;
    setHoverCursor({
      left: ratio * 100,
      label: dayjs(timeMs).format('YYYY-MM-DD HH:mm'),
    });
  };
  const itemsByLine = items.reduce<Record<string, GanttItem[]>>((acc, item) => {
    const preview = dragPreview?.itemId === item.id ? dragPreview : null;
    const lineCode = preview?.lineCode ?? item.lineCode;
    const renderedItem = preview ? { ...item, lineCode, startAt: dayjs(preview.startMs).toISOString(), endAt: dayjs(preview.endMs).toISOString() } : item;
    acc[lineCode] = [...(acc[lineCode] ?? []), renderedItem];
    return acc;
  }, {});

  const startItemDrag = (mode: ItemDragState['mode'], item: ScheduleItem, event: ReactMouseEvent<HTMLElement>) => {
    if (!editable || !(canEditItem ? canEditItem(item) : item.status === '待下推') || !onItemWindowChange) return;
    event.preventDefault();
    event.stopPropagation();
    const startMs = dayjs(item.startAt).valueOf();
    const endMs = dayjs(item.endAt).valueOf();
    itemDragRef.current = {
      mode,
      itemId: item.id,
      lineCode: item.lineCode,
      startX: event.clientX,
      startY: event.clientY,
      startMs,
      endMs,
      minStart,
      totalMs,
    };
    setDragPreview({ itemId: item.id, lineCode: item.lineCode, startMs, endMs });
  };

  const updateItemTooltip = (item: GanttItem, event: ReactMouseEvent<HTMLElement>) => {
    setHoverTooltip({ item, x: event.clientX + 12, y: event.clientY + 12 });
  };

  const openContextMenu = (item: GanttItem, canEdit: boolean, event: ReactMouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setHoverTooltip(null);
    setContextMenu({ item, x: event.clientX, y: event.clientY, canEdit });
  };

  const renderTooltipRows = (item: GanttItem) => {
    const displayStatus = getGanttDisplayStatus(item);
    const scheduleNo = displayStatus === '已排程' ? '-' : item.id;
    const scheduleStatus = displayStatus === '已排程' ? '未输出' : item.status;
    return [
      ['MO 单号', item.productionOrderId],
      ['主产品', materialName(data, item.productCode)],
      ['产线', lineName(data, item.lineCode)],
      ['交货日期', item.deliveryDate ?? '-'],
      ['计划开始', dayjs(item.startAt).format('YYYY-MM-DD HH:mm')],
      ['计划结束', dayjs(item.endAt).format('YYYY-MM-DD HH:mm')],
      ['批次数', String(item.batchCount)],
      ['计划工时', `${item.workHours} h`],
      ['清机(min)', String(item.cleanMinutes ?? '-')],
      ['订单状态', item.productionOrderStatus ?? '已排程'],
      ['排程说明', item.scheduleReason ?? '-'],
      ['排程单号', scheduleNo],
      ['排程单状态', scheduleStatus],
    ];
  };

  return (
    <div className="simple-gantt-shell" style={{ '--gantt-timeline-width': `${timelineWidth}px` } as CSSProperties} onClick={() => setContextMenu(null)}>
      <div className="simple-gantt">
        <div className="gantt-label-column">
          <div className="gantt-resource-header">
            <strong>APS</strong>
            <span>生产资源</span>
          </div>
          {enabledLines.map((line) => (
            <strong key={line.code} title={`${line.code} - ${lineName(data, line.code)}`}>
              <span>{lineName(data, line.code)}</span>
              <em>{line.code}</em>
            </strong>
          ))}
        </div>
        <div
          className="gantt-timeline-scroll"
          ref={scrollRef}
          onMouseMove={updateHoverCursor}
          onMouseLeave={() => setHoverCursor(null)}
          onScroll={syncScrollState}
          data-total-hours={totalHours}
        >
          <div className="simple-gantt-content">
            <div className="gantt-status-legend">
              {ganttStatusLabels.map((status) => (
                <span key={status}>
                  <i style={{ background: ganttStatusColor[status] }} />
                  {status}
                </span>
              ))}
            </div>
            <div className="gantt-axis">
              <div className="gantt-axis-months">
                {monthTicks.map((tick) => (
                  <span key={tick.timeMs} style={{ left: `${tick.left}%`, width: `${tick.width}%` }}>{tick.label}</span>
                ))}
              </div>
              <div className="gantt-axis-days">
                {dayTicks.map((tick) => (
                  <span className={tick.isWeekend ? 'gantt-axis-day gantt-axis-day-weekend' : 'gantt-axis-day'} key={tick.timeMs} style={{ left: `${tick.left}%`, width: `${tick.width}%` }}>
                    <b>{tick.label}</b>
                    <i>{tick.subLabel}</i>
                  </span>
                ))}
              </div>
              <div className="gantt-axis-labels">
                {timeTicks.map((tick) => (
                  <span key={tick.timeMs} style={{ left: `${tick.left}%` }}>{tick.label}</span>
                ))}
                {nowLeft !== null ? <span className="gantt-now-label" style={{ left: `${nowLeft}%` }}>现在 {dayjs(nowMs).format('YYYY-MM-DD HH:mm')}</span> : null}
                {hoverCursor ? <span className="gantt-hover-label" style={{ left: `${hoverCursor.left}%` }}>{hoverCursor.label}</span> : null}
              </div>
            </div>
            {enabledLines.map((line) => {
            const lineItems = (itemsByLine[line.code] ?? []).sort((a, b) => dayjs(a.startAt).valueOf() - dayjs(b.startAt).valueOf());
            const workWindows = getWorkWindowsBetween(data, line.code, dayjs(minStart), dayjs(maxEnd));
            const restSegments: Array<{ startMs: number; endMs: number }> = [];
            let cursor = minStart;
            workWindows.forEach((window) => {
              const windowStart = window.start.valueOf();
              const windowEnd = window.end.valueOf();
              if (windowStart > cursor) {
                restSegments.push({ startMs: cursor, endMs: windowStart });
              }
              cursor = Math.max(cursor, windowEnd);
            });
            if (cursor < maxEnd && workWindows.length) {
              restSegments.push({ startMs: cursor, endMs: maxEnd });
            }
            if (!workWindows.length && data.productionCalendars.some((calendar) => calendar.enabled && calendar.lineCode === line.code)) {
              restSegments.push({ startMs: minStart, endMs: maxEnd });
            }
            return (
              <div className="gantt-row" key={line.code} ref={(node) => { rowRefs.current[line.code] = node; }}>
                <div className="gantt-line">
                  {dayTicks.map((tick) => (
                    <span className={tick.isWeekend ? 'gantt-day-band gantt-day-band-weekend' : 'gantt-day-band'} key={tick.timeMs} style={{ left: `${tick.left}%`, width: `${tick.width}%` }} />
                  ))}
                  {timeTicks.map((tick) => (
                    <span className="gantt-time-grid-line" key={tick.timeMs} style={{ left: `${tick.left}%` }} />
                  ))}
                  {nowLeft !== null ? <span className="gantt-now-line" style={{ left: `${nowLeft}%` }} /> : null}
                  {hoverCursor ? <span className="gantt-hover-line" style={{ left: `${hoverCursor.left}%` }} /> : null}
                  {lineItems.length ? lineItems.map((item) => {
                    const startMs = dayjs(item.startAt).valueOf();
                    const endMs = dayjs(item.endAt).valueOf();
                    const clippedStartMs = Math.max(startMs, minStart);
                    const clippedEndMs = Math.min(endMs, maxEnd);
                    if (clippedEndMs <= clippedStartMs) return null;
                    const left = ((clippedStartMs - minStart) / totalMs) * 100;
                    const width = Math.max(2, ((clippedEndMs - clippedStartMs) / totalMs) * 100);
                    const displayStatus = getGanttDisplayStatus(item);
                    const isShort = width < 18;
                    const canDrag = editable && (canEditItem ? canEditItem(item) : item.status === '待下推');
                    const itemDuration = Math.max(1, clippedEndMs - clippedStartMs);
                    const itemRestSegments = restSegments
                      .map((segment) => ({
                        startMs: Math.max(segment.startMs, clippedStartMs),
                        endMs: Math.min(segment.endMs, clippedEndMs),
                      }))
                      .filter((segment) => segment.endMs > segment.startMs);
                    return (
                      <div
                        className={`gantt-bar${isShort ? ' gantt-bar-short' : ''}${canDrag ? ' gantt-bar-editable' : ''}${dragPreview?.itemId === item.id ? ' gantt-bar-dragging' : ''}`}
                        key={item.id}
                        onClick={() => onItemClick?.(item)}
                        onMouseDown={canDrag ? (event) => startItemDrag('move', item, event) : undefined}
                        onMouseEnter={(event) => updateItemTooltip(item, event)}
                        onMouseMove={(event) => updateItemTooltip(item, event)}
                        onMouseLeave={() => setHoverTooltip(null)}
                        onContextMenu={(event) => openContextMenu(item, canDrag, event)}
                        style={{ left: `${left}%`, width: `${width}%`, '--gantt-bar-bg': ganttStatusColor[displayStatus] } as CSSProperties}
                      >
                        {canDrag ? (
                          <>
                            <span className="gantt-bar-resize gantt-bar-resize-left" onMouseDown={(event) => startItemDrag('resize-left', item, event)} />
                            <span className="gantt-bar-resize gantt-bar-resize-right" onMouseDown={(event) => startItemDrag('resize-right', item, event)} />
                          </>
                        ) : null}
                        {itemRestSegments.map((segment, index) => {
                          const restLeft = ((segment.startMs - clippedStartMs) / itemDuration) * 100;
                          const restWidth = ((segment.endMs - segment.startMs) / itemDuration) * 100;
                          return (
                            <span
                              className="gantt-bar-rest"
                              key={`${item.id}-rest-${index}`}
                              style={{ left: `${restLeft}%`, width: `${restWidth}%` }}
                            />
                          );
                        })}
                        <span className="gantt-bar-text">
                          <em>{displayStatus === '已排程' ? '未输出' : item.id}</em>
                          <small>{displayStatus}</small>
                        </span>
                      </div>
                    );
                  }) : <span className="gantt-empty">暂无排程</span>}
                </div>
              </div>
            );
            })}
          </div>
        </div>
      </div>
      <div className="gantt-zoom-scrollbar">
        <div
          className="gantt-scroll-track"
          ref={trackRef}
          onMouseDown={handleTrackMouseDown}
          onWheel={handleZoomWheel}
          title="拖动滚动，滚轮缩放"
        >
          <div
            className="gantt-scroll-thumb"
            onMouseDown={handleThumbMouseDown}
            style={{ left: `${thumbLeftPercent}%`, width: `${thumbWidthPercent}%` }}
          >
            <span className="gantt-scroll-resize gantt-scroll-resize-left" onMouseDown={handleResizeMouseDown('resize-left')} />
            <span className="gantt-scroll-resize gantt-scroll-resize-right" onMouseDown={handleResizeMouseDown('resize-right')} />
          </div>
        </div>
        <span>{hourWidth}px/h</span>
      </div>
      {hoverTooltip ? (
        <div className="gantt-item-tooltip" style={{ left: hoverTooltip.x, top: hoverTooltip.y }}>
          {renderTooltipRows(hoverTooltip.item).map(([label, value]) => (
            <div className="gantt-item-tooltip-row" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      ) : null}
      {contextMenu ? (
        <div className="gantt-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            disabled={!contextMenu.canEdit}
            onClick={() => {
              if (!contextMenu.canEdit) return;
              onItemEdit?.(contextMenu.item);
              setContextMenu(null);
            }}
          >
            编辑
          </button>
        </div>
      ) : null}
    </div>
  );
}
