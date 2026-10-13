"use client";

import { useMemo } from "react";

export interface ResponseChartData {
  type: "bar" | "line" | "pie";
  title?: string;
  xLabel?: string;
  yLabel?: string;
  data: Array<{ label: string; value: number }>;
}

const formatValue = (value: number) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 2, notation: Math.abs(value) >= 10000 ? "compact" : "standard" }).format(value);

export function ResponseChart({ chart }: { chart: ResponseChartData }) {
  const data = useMemo(() => chart.data.filter((item) => typeof item.label === "string" && item.label.length > 0 && Number.isFinite(item.value)).slice(0, 24), [chart.data]);
  if (!data.length) return null;

  const width = 640, height = 300, left = 54, right = 18, top = 22, bottom = 54;
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  const min = Math.min(0, ...data.map((item) => item.value));
  const max = Math.max(0, ...data.map((item) => item.value));
  const range = max - min || 1;
  const y = (value: number) => top + ((max - value) / range) * plotHeight;
  const zeroY = y(0);
  const colors = ["#7777f6", "#9b72ed", "#38a6a5", "#e5a54b", "#e879a9", "#6098df"];
  const points = data.map((item, index) => ({ ...item, x: left + (data.length === 1 ? plotWidth / 2 : index / (data.length - 1) * plotWidth), y: y(item.value) }));
  const total = data.reduce((sum, item) => sum + Math.max(0, item.value), 0);
  let angle = -Math.PI / 2;
  const slices = data.map((item, index) => {
    const fraction = total > 0 ? Math.max(0, item.value) / total : 0;
    const start = angle;
    angle += fraction * Math.PI * 2;
    const end = angle;
    const radius = 78, cx = 130, cy = 122;
    const point = (a: number) => ({ x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) });
    const a = point(start), b = point(end);
    const d = fraction >= 0.999999
      ? `M ${cx} ${cy-radius} A ${radius} ${radius} 0 1 1 ${cx} ${cy+radius} A ${radius} ${radius} 0 1 1 ${cx} ${cy-radius} Z`
      : `M ${cx} ${cy} L ${a.x} ${a.y} A ${radius} ${radius} 0 ${fraction > 0.5 ? 1 : 0} 1 ${b.x} ${b.y} Z`;
    return { ...item, color: colors[index % colors.length], d };
  });

  return <figure className="response-chart" aria-label={chart.title || "Data chart"}>
    {chart.title && <figcaption className="response-chart-title">{chart.title}</figcaption>}
    {chart.type === "pie" ? <div className="response-pie-layout">
      <svg viewBox="0 0 260 245" role="img" aria-label={chart.title || "Pie chart"}>
        {slices.map((slice) => <path key={`${slice.label}-${slice.value}`} d={slice.d} fill={slice.color} stroke="var(--surface)" strokeWidth="2" />)}
      </svg>
      <ul className="response-chart-legend">
        {slices.map((slice) => <li key={`${slice.label}-${slice.value}`}><span style={{ background: slice.color }} /><span>{slice.label}</span><strong>{formatValue(slice.value)}</strong></li>)}
      </ul>
    </div> : <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={chart.title || `${chart.type} chart`}>
      {[0,1,2,3,4].map((tick) => {
        const value = max - tick / 4 * range, yy = top + tick / 4 * plotHeight;
        return <g key={tick}><line x1={left} y1={yy} x2={width-right} y2={yy} stroke="var(--line)" strokeDasharray="3 4" /><text x={left-9} y={yy+4} textAnchor="end" fill="var(--text-tertiary)" fontSize="11">{formatValue(value)}</text></g>;
      })}
      {chart.type === "bar" && points.map((point, index) => {
        const band = plotWidth / points.length, barWidth = Math.min(42, band * 0.62);
        return <g key={`${point.label}-${point.value}`}><rect x={point.x-barWidth/2} y={Math.min(point.y,zeroY)} width={barWidth} height={Math.max(1,Math.abs(zeroY-point.y))} rx="5" fill={colors[index % colors.length]} /><text x={point.x} y={height-30} textAnchor="middle" fill="var(--text-secondary)" fontSize="11">{point.label.slice(0,12)}</text><text x={point.x} y={Math.max(top+12,Math.min(point.y,zeroY)-7)} textAnchor="middle" fill="var(--text)" fontSize="11" fontWeight="600">{formatValue(point.value)}</text></g>;
      })}
      {chart.type === "line" && <><polyline points={points.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke="#7777f6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />{points.map((point) => <g key={`${point.label}-${point.value}`}><circle cx={point.x} cy={point.y} r="4.5" fill="#7777f6" stroke="var(--surface)" strokeWidth="2" /><text x={point.x} y={height-30} textAnchor="middle" fill="var(--text-secondary)" fontSize="11">{point.label.slice(0,12)}</text><text x={point.x} y={point.y-11} textAnchor="middle" fill="var(--text)" fontSize="11" fontWeight="600">{formatValue(point.value)}</text></g>)}</>}
      {chart.xLabel && <text x={left+plotWidth/2} y={height-5} textAnchor="middle" fill="var(--text-tertiary)" fontSize="11">{chart.xLabel}</text>}
      {chart.yLabel && <text transform={`translate(14 ${top+plotHeight/2}) rotate(-90)`} textAnchor="middle" fill="var(--text-tertiary)" fontSize="11">{chart.yLabel}</text>}
    </svg>}
    <p className="response-chart-note">Chart values reflect the data shown in this answer.</p>
  </figure>;
}
