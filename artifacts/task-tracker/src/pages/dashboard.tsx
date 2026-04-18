import { useState } from "react";
import { useGetSubmissionSummary, getGetSubmissionSummaryQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2, Activity, FileText, CheckCircle2, Clock,
  TrendingUp, AlertCircle, Users, CalendarDays, X,
  AlertTriangle, ShieldCheck, Eye,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";

// ── helpers ──────────────────────────────────────────────────────────────────

function getPerformanceTier(completionPct: number, total: number): {
  label: string;
  color: string;
  bg: string;
  border: string;
  ring: string;
} {
  if (total === 0) return { label: "No Data", color: "text-muted-foreground", bg: "bg-muted/40", border: "border-border", ring: "bg-muted" };
  if (completionPct >= 75) return { label: "On Track", color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", ring: "bg-emerald-500" };
  if (completionPct >= 50) return { label: "Watch", color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-300", ring: "bg-amber-400" };
  if (completionPct > 0)   return { label: "Needs Attention", color: "text-orange-700", bg: "bg-orange-50", border: "border-orange-300", ring: "bg-orange-500" };
  return { label: "All Pending", color: "text-red-700", bg: "bg-red-50", border: "border-red-300", ring: "bg-red-500" };
}

const STATUS_COLORS: Record<string, string> = {
  done: "#10b981",
  pending: "#f59e0b",
  "in progress": "#3b82f6",
  escalated: "#ef4444",
  deferred: "#6b7280",
  "not applicable": "#a3a3a3",
};
function getStatusColor(s: string) { return STATUS_COLORS[s.toLowerCase()] ?? "#6366f1"; }

function StatusBadge({ status }: { status: string }) {
  const lower = status.toLowerCase();
  if (lower === "done")        return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100">{status}</Badge>;
  if (lower === "pending")     return <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100">{status}</Badge>;
  if (lower === "in progress") return <Badge className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100">{status}</Badge>;
  if (lower === "escalated")   return <Badge className="bg-red-100 text-red-800 border-red-200 hover:bg-red-100">{status}</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

const PRESET_RANGES = [
  { label: "Today",        getValue: () => ({ start: format(new Date(), "yyyy-MM-dd"),               end: format(new Date(), "yyyy-MM-dd") }) },
  { label: "Last 7 days",  getValue: () => ({ start: format(subDays(new Date(), 6), "yyyy-MM-dd"),   end: format(new Date(), "yyyy-MM-dd") }) },
  { label: "Last 30 days", getValue: () => ({ start: format(subDays(new Date(), 29), "yyyy-MM-dd"),  end: format(new Date(), "yyyy-MM-dd") }) },
  { label: "This Month",   getValue: () => ({ start: format(startOfMonth(new Date()), "yyyy-MM-dd"), end: format(endOfMonth(new Date()), "yyyy-MM-dd") }) },
];

// ── component ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [startDate, setStartDate]     = useState("");
  const [endDate, setEndDate]         = useState("");
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const params = {
    ...(startDate ? { startDate } : {}),
    ...(endDate   ? { endDate }   : {}),
  };

  const { data: summary, isLoading } = useGetSubmissionSummary(
    params,
    { query: { queryKey: [...getGetSubmissionSummaryQueryKey(), startDate, endDate] } }
  );

  function applyPreset(p: typeof PRESET_RANGES[0]) {
    const { start, end } = p.getValue();
    setStartDate(start); setEndDate(end); setActivePreset(p.label);
  }
  function clearFilter() { setStartDate(""); setEndDate(""); setActivePreset(null); }
  const isFiltered = !!(startDate || endDate);

  // ── loading / error states ─────────────────────────────────────────────────
  if (isLoading) return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm">Loading dashboard…</p>
      </div>
    </div>
  );

  if (!summary) return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-2 text-muted-foreground">
        <AlertCircle className="h-8 w-8" /><p>Failed to load dashboard data.</p>
      </div>
    </div>
  );

  // ── derived data ───────────────────────────────────────────────────────────
  const doneCount    = summary.byPending.find(p => p.pending.toLowerCase() === "done")?.count ?? 0;
  const pendingCount = summary.byPending.filter(p => p.pending.toLowerCase() !== "done").reduce((a, c) => a + c.count, 0);
  const completionRate = summary.total > 0 ? Math.round((doneCount / summary.total) * 100) : 0;

  // Doer scorecard — sorted by most pending first (worst performers surface at top)
  const doerRows = (summary.byDoer ?? []).map(d => {
    const pct = d.total > 0 ? Math.round((d.done / d.total) * 100) : 0;
    return { ...d, completionPct: pct, tier: getPerformanceTier(pct, d.total) };
  }).sort((a, b) => b.pending - a.pending || a.completionPct - b.completionPct);

  const needsAttentionCount = doerRows.filter(d => d.completionPct < 50 && d.total > 0).length;
  const watchCount          = doerRows.filter(d => d.completionPct >= 50 && d.completionPct < 75).length;
  const highestBacklog      = doerRows[0] ?? null;

  // Officer data for workload chart
  const officerData = (summary.byOfficer ?? [])
    .sort((a, b) => b.total - a.total)
    .map(o => ({
      name: o.officer.length > 14 ? o.officer.substring(0, 14) + "…" : o.officer,
      fullName: o.officer,
      done: o.done,
      pending: o.pending,
      total: o.total,
    }));

  const workChartData = [...summary.byWork]
    .sort((a, b) => b.count - a.count).slice(0, 7)
    .map(i => ({ name: i.work.length > 20 ? i.work.substring(0, 20) + "…" : i.work, count: i.count, fullName: i.work }));

  const pieData = summary.byPending.map(i => ({ name: i.pending, value: i.count, color: getStatusColor(i.pending) }));

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Compliance overview — Labour Laws India Associates Pvt. Ltd.</p>
        </div>
        {isFiltered && (
          <Badge variant="outline" className="flex items-center gap-1.5 text-sm px-3 py-1.5 h-auto">
            <CalendarDays className="h-3.5 w-3.5" />
            {startDate && endDate ? `${startDate} → ${endDate}` : startDate ? `From ${startDate}` : `Until ${endDate}`}
            <button onClick={clearFilter} className="ml-1 rounded hover:text-destructive transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </Badge>
        )}
      </div>

      {/* Date Filter */}
      <Card className="shadow-sm">
        <CardHeader className="py-4 border-b">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Date Range Filter</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex gap-2 flex-wrap">
              {PRESET_RANGES.map(p => (
                <Button key={p.label} variant={activePreset === p.label ? "default" : "outline"} size="sm" className="text-xs h-8" onClick={() => applyPreset(p)}>
                  {p.label}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-muted-foreground font-medium">From</label>
                <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setActivePreset(null); }}
                  className="text-xs border border-border rounded-md px-2 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-muted-foreground font-medium">To</label>
                <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setActivePreset(null); }}
                  className="text-xs border border-border rounded-md px-2 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              {isFiltered && (
                <Button variant="ghost" size="sm" className="text-xs h-8 text-muted-foreground" onClick={clearFilter}>
                  <X className="h-3.5 w-3.5 mr-1" /> Clear
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stat Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Records",   value: summary.total,   sub: "All submissions",       icon: FileText,      iconCls: "bg-primary/10",  valCls: "", iconColor: "text-primary" },
          { label: "Today",           value: summary.todayCount, sub: "Submitted today",    icon: Activity,      iconCls: "bg-blue-50",     valCls: "", iconColor: "text-blue-600" },
          { label: "Completed",       value: doneCount,       sub: `${completionRate}% rate`, icon: CheckCircle2, iconCls: "bg-emerald-50", valCls: "text-emerald-700", iconColor: "text-emerald-600" },
          { label: "Pending",         value: pendingCount,    sub: "Awaiting action",        icon: Clock,        iconCls: "bg-amber-50",    valCls: "text-amber-700",   iconColor: "text-amber-600" },
        ].map(({ label, value, sub, icon: Icon, iconCls, valCls, iconColor }) => (
          <Card key={label} className="border shadow-sm">
            <CardHeader className="pb-2 pt-5 px-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconCls}`}>
                  <Icon className={`h-4 w-4 ${iconColor}`} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <p className={`text-3xl font-bold ${valCls}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-1">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── DOER PERFORMANCE SCORECARD ── */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Doer Performance Scorecard</CardTitle>
              <span className="text-xs text-muted-foreground">(ranked by pending backlog — highest first)</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {needsAttentionCount > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-700 bg-orange-50 border border-orange-200 rounded-full px-2.5 py-0.5">
                  <AlertTriangle className="h-3 w-3" />
                  {needsAttentionCount} need{needsAttentionCount > 1 ? "" : "s"} attention
                </span>
              )}
              {watchCount > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5">
                  <Clock className="h-3 w-3" />
                  {watchCount} to watch
                </span>
              )}
              {needsAttentionCount === 0 && watchCount === 0 && doerRows.length > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5">
                  <ShieldCheck className="h-3 w-3" />
                  All on track
                </span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {doerRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <Users className="h-8 w-8 opacity-30" />
              <p className="text-sm">No doer data yet. Submit tasks to see performance here.</p>
            </div>
          ) : (
            <>
              {/* Table header */}
              <div className="grid grid-cols-[2rem_1fr_4rem_4rem_4rem_5.5rem_6rem] gap-x-3 px-5 py-2 border-b bg-muted/30 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <div>#</div>
                <div>Doer (Actual Doer)</div>
                <div className="text-center">Total</div>
                <div className="text-center text-emerald-700">Done</div>
                <div className="text-center text-amber-700">Pending</div>
                <div className="text-center">Progress</div>
                <div className="text-center">Status</div>
              </div>

              {/* Table rows */}
              <div className="divide-y">
                {doerRows.map((d, idx) => (
                  <div
                    key={d.doer}
                    className={`grid grid-cols-[2rem_1fr_4rem_4rem_4rem_5.5rem_6rem] gap-x-3 px-5 py-3 items-center hover:bg-muted/20 transition-colors ${d.completionPct < 50 && d.total > 0 ? "bg-orange-50/40" : ""}`}
                  >
                    {/* rank */}
                    <div className="text-xs text-muted-foreground font-mono font-bold">{idx + 1}</div>

                    {/* name + tier dot */}
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${d.tier.ring}`} />
                      <span className="text-sm font-semibold truncate" title={d.doer}>{d.doer}</span>
                    </div>

                    {/* total */}
                    <div className="text-center text-sm font-bold">{d.total}</div>

                    {/* done */}
                    <div className="text-center text-sm font-semibold text-emerald-700">{d.done}</div>

                    {/* pending */}
                    <div className={`text-center text-sm font-semibold ${d.pending > 0 ? "text-amber-700" : "text-muted-foreground"}`}>{d.pending}</div>

                    {/* progress bar */}
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${d.completionPct >= 75 ? "bg-emerald-500" : d.completionPct >= 50 ? "bg-amber-400" : "bg-orange-500"}`}
                          style={{ width: `${d.completionPct}%` }}
                        />
                      </div>
                      <span className={`text-xs font-bold w-8 text-right ${d.completionPct >= 75 ? "text-emerald-700" : d.completionPct >= 50 ? "text-amber-700" : "text-orange-700"}`}>
                        {d.completionPct}%
                      </span>
                    </div>

                    {/* tier badge */}
                    <div className="flex justify-center">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${d.tier.bg} ${d.tier.color} ${d.tier.border}`}>
                        {d.tier.label}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-4 px-5 py-3 border-t bg-muted/20 text-xs text-muted-foreground">
                <span className="font-semibold">Performance:</span>
                {[
                  { dot: "bg-emerald-500", label: "On Track (≥75% done)" },
                  { dot: "bg-amber-400",   label: "Watch (50–74%)" },
                  { dot: "bg-orange-500",  label: "Needs Attention (<50%)" },
                  { dot: "bg-red-500",     label: "All Pending (0%)" },
                ].map(({ dot, label }) => (
                  <span key={label} className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${dot}`} /> {label}
                  </span>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── INSIGHT CALLOUTS ── */}
      {doerRows.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Highest pending backlog */}
          {highestBacklog && highestBacklog.pending > 0 && (
            <Card className="shadow-sm border-l-4 border-l-orange-400">
              <CardContent className="pt-5 pb-5 px-5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Highest Pending Backlog</p>
                <p className="text-base font-bold truncate">{highestBacklog.doer}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  <span className="text-orange-600 font-bold">{highestBacklog.pending}</span> tasks still pending
                  {" · "}{highestBacklog.completionPct}% complete
                </p>
              </CardContent>
            </Card>
          )}
          {/* Best performer */}
          {(() => {
            const best = [...doerRows].filter(d => d.total > 0).sort((a, b) => b.completionPct - a.completionPct)[0];
            if (!best) return null;
            return (
              <Card className="shadow-sm border-l-4 border-l-emerald-500">
                <CardContent className="pt-5 pb-5 px-5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Best Completion Rate</p>
                  <p className="text-base font-bold truncate">{best.doer}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    <span className="text-emerald-600 font-bold">{best.completionPct}%</span> complete
                    {" · "}{best.done}/{best.total} tasks done
                  </p>
                </CardContent>
              </Card>
            );
          })()}
          {/* Most active doer */}
          {(() => {
            const most = [...doerRows].sort((a, b) => b.total - a.total)[0];
            if (!most) return null;
            return (
              <Card className="shadow-sm border-l-4 border-l-primary">
                <CardContent className="pt-5 pb-5 px-5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Most Active Doer</p>
                  <p className="text-base font-bold truncate">{most.doer}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    <span className="text-primary font-bold">{most.total}</span> tasks assigned
                    {" · "}{most.done} done
                  </p>
                </CardContent>
              </Card>
            );
          })()}
        </div>
      )}

      {/* ── CHARTS ROW ── */}
      <div className="grid gap-4 lg:grid-cols-7">
        {/* Work categories */}
        <Card className="col-span-4 shadow-sm">
          <CardHeader className="pb-2 border-b">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Top Work Categories</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {workChartData.length > 0 ? (
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={workChartData} margin={{ top: 5, right: 10, left: -20, bottom: 40 }}>
                    <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} angle={-30} textAnchor="end" interval={0} />
                    <YAxis fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip cursor={{ fill: "hsl(var(--muted))" }} content={({ active, payload }) => active && payload?.length ? (
                      <div className="bg-background border border-border p-3 shadow-md rounded-lg text-sm">
                        <p className="font-semibold">{payload[0].payload.fullName}</p>
                        <p className="text-muted-foreground mt-1">Count: <strong>{payload[0].value}</strong></p>
                      </div>
                    ) : null} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-[240px] items-center justify-center text-muted-foreground text-sm">No data yet.</div>
            )}
          </CardContent>
        </Card>

        {/* Status pie */}
        <Card className="col-span-3 shadow-sm">
          <CardHeader className="pb-2 border-b">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Status Breakdown</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {pieData.length > 0 ? (
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="45%" innerRadius={55} outerRadius={85} paddingAngle={2} dataKey="value">
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip content={({ active, payload }) => active && payload?.length ? (
                      <div className="bg-background border border-border p-3 shadow-md rounded-lg text-sm">
                        <p className="font-semibold">{payload[0].name}</p>
                        <p className="text-muted-foreground mt-1">Count: <strong>{payload[0].value}</strong></p>
                      </div>
                    ) : null} />
                    <Legend iconType="circle" iconSize={8} formatter={v => <span className="text-xs text-foreground">{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-[240px] items-center justify-center text-muted-foreground text-sm">No data yet.</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── OFFICER WORKLOAD (stacked bar) ── */}
      {officerData.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-2 border-b">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Field Officer Workload</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={officerData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={({ active, payload }) => active && payload?.length ? (
                    <div className="bg-background border border-border p-3 shadow-md rounded-lg text-sm">
                      <p className="font-semibold mb-1">{payload[0]?.payload?.fullName}</p>
                      <p className="text-emerald-600">Done: <strong>{payload[0]?.value}</strong></p>
                      <p className="text-amber-600">Pending: <strong>{payload[1]?.value}</strong></p>
                    </div>
                  ) : null} />
                  <Legend iconType="circle" iconSize={8} formatter={v => <span className="text-xs text-foreground capitalize">{v}</span>} />
                  <Bar dataKey="done" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} name="done" />
                  <Bar dataKey="pending" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} name="pending" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── RECENT SUBMISSIONS ── */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-base">Recent Submissions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {summary.recentSubmissions.length > 0 ? (
            <div className="divide-y">
              {summary.recentSubmissions.map(sub => (
                <div key={sub.id} className="flex items-center justify-between px-6 py-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold font-mono text-muted-foreground">
                      {sub.id}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{sub.company}</p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{sub.work}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        {sub.payroll && <p className="text-xs text-muted-foreground/70">Doer: <span className="font-medium">{sub.payroll}</span></p>}
                        {sub.officer && <p className="text-xs text-muted-foreground/70">Officer: {sub.officer}</p>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    <StatusBadge status={sub.pending} />
                    <p className="text-xs text-muted-foreground whitespace-nowrap">{format(new Date(sub.submittedAt), "dd MMM yyyy")}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <FileText className="h-8 w-8 opacity-30" />
              <p className="text-sm">No submissions yet.</p>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
