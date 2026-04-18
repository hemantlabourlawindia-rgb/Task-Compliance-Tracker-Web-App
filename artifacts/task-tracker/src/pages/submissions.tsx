import { useState } from "react";
import { format } from "date-fns";
import {
  useListSubmissions,
  useDeleteSubmission,
  getListSubmissionsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Trash2, Eye, Download, Search, RefreshCw } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

type Submission = {
  id: number;
  payroll: string;
  company: string;
  work: string;
  detail1: string;
  detail2?: string | null;
  pending: string;
  remarks?: string | null;
  officer?: string | null;
  assigned?: string | null;
  submittedAt: string;
};

function StatusBadge({ status }: { status: string }) {
  const lower = status.toLowerCase();
  if (lower === "done") {
    return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100">{status}</Badge>;
  }
  if (lower === "pending") {
    return <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100">{status}</Badge>;
  }
  if (lower === "in progress") {
    return <Badge className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100">{status}</Badge>;
  }
  if (lower === "escalated") {
    return <Badge className="bg-red-100 text-red-800 border-red-200 hover:bg-red-100">{status}</Badge>;
  }
  if (lower === "deferred") {
    return <Badge className="bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-100">{status}</Badge>;
  }
  return <Badge variant="outline">{status}</Badge>;
}

function DetailField({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  );
}

function SubmissionDetailDialog({
  submission,
  open,
  onClose,
}: {
  submission: Submission | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!submission) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>Submission #{submission.id}</span>
            <StatusBadge status={submission.pending} />
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Submitted on {format(new Date(submission.submittedAt), "dd MMM yyyy, hh:mm a")}
          </p>
        </DialogHeader>
        <Separator />
        <div className="grid grid-cols-2 gap-x-8 gap-y-4 pt-2">
          <DetailField label="Payroll Master Name" value={submission.payroll} />
          <DetailField label="CO CODE / Company Name" value={submission.company} />
          <div className="col-span-2">
            <DetailField label="Work To Be Done" value={submission.work} />
          </div>
          <div className="col-span-2">
            <DetailField label="Detail" value={submission.detail1} />
          </div>
          {submission.detail2 && (
            <div className="col-span-2">
              <DetailField label="Additional Detail" value={submission.detail2} />
            </div>
          )}
          <DetailField label="Pending Done" value={submission.pending} />
          {submission.remarks && <DetailField label="Remarks" value={submission.remarks} />}
          <DetailField label="Field Officer" value={submission.officer} />
          <DetailField label="Assigned By" value={submission.assigned} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function exportToCSV(items: Submission[]) {
  const headers = [
    "ID", "Submitted At", "Payroll Master Name", "CO CODE / Company Name",
    "Work To Be Done", "Detail", "Additional Detail",
    "Pending Done", "Remarks", "Field Officer", "Assigned By"
  ];
  const rows = items.map(item => [
    item.id,
    format(new Date(item.submittedAt), "dd/MM/yyyy HH:mm:ss"),
    item.payroll,
    item.company,
    item.work,
    item.detail1,
    item.detail2 || "",
    item.pending,
    item.remarks || "",
    item.officer || "",
    item.assigned || "",
  ]);

  const csvContent = [headers, ...rows]
    .map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `compliance-submissions-${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function Submissions() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [viewSubmission, setViewSubmission] = useState<Submission | null>(null);
  const [syncing, setSyncing] = useState(false);
  const limit = 20;
  const offset = (page - 1) * limit;

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleSyncFromSheet = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`${API_BASE}/api/submissions/sync-from-sheet`, { method: "POST" });
      const json = await res.json() as { inserted: number; skipped: number; message: string; error?: string };
      if (!res.ok) {
        toast({ title: "Sync failed", description: json.error ?? "Could not sync from Google Sheet.", variant: "destructive" });
      } else {
        toast({ title: "Sync complete", description: json.message });
        queryClient.invalidateQueries();
      }
    } catch {
      toast({ title: "Sync error", description: "Could not reach the server.", variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const { data, isLoading } = useListSubmissions(
    { limit, offset },
    { query: { queryKey: getListSubmissionsQueryKey({ limit, offset }) } }
  );

  const deleteSubmission = useDeleteSubmission();

  const handleDelete = (id: number) => {
    deleteSubmission.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Record deleted", description: "The submission has been permanently removed." });
          queryClient.invalidateQueries();
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to delete the record.", variant: "destructive" });
        },
      }
    );
  };

  const filtered = (data?.items ?? []).filter(item => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      item.company.toLowerCase().includes(q) ||
      item.payroll.toLowerCase().includes(q) ||
      item.work.toLowerCase().includes(q) ||
      item.pending.toLowerCase().includes(q) ||
      (item.officer || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Submissions</h1>
          <p className="text-muted-foreground mt-1">
            All compliance task records — view, filter, and export.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            variant="outline"
            onClick={handleSyncFromSheet}
            disabled={syncing}
            className="gap-2"
          >
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {syncing ? "Syncing..." : "Sync from Sheet"}
          </Button>
          <Button
            variant="outline"
            onClick={() => data?.items && exportToCSV(data.items)}
            disabled={!data?.items?.length}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="py-4 border-b">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>All Records</CardTitle>
              <CardDescription className="mt-1">
                {data?.total !== undefined
                  ? `${data.total} total submission${data.total !== 1 ? "s" : ""}`
                  : "Loading..."}
              </CardDescription>
            </div>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search records..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="w-[60px] font-semibold">#</TableHead>
                  <TableHead className="font-semibold">Date & Time</TableHead>
                  <TableHead className="font-semibold">Payroll Master</TableHead>
                  <TableHead className="font-semibold">Company</TableHead>
                  <TableHead className="font-semibold">Work To Be Done</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Officer</TableHead>
                  <TableHead className="font-semibold">Assigned By</TableHead>
                  <TableHead className="text-right font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-32 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                      {search ? "No records match your search." : "No submissions yet."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((item) => (
                    <TableRow key={item.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-mono text-xs text-muted-foreground">{item.id}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        <div className="font-medium">{format(new Date(item.submittedAt), "dd MMM yyyy")}</div>
                        <div className="text-muted-foreground">{format(new Date(item.submittedAt), "hh:mm a")}</div>
                      </TableCell>
                      <TableCell className="max-w-[130px]">
                        <div className="truncate text-sm" title={item.payroll}>{item.payroll}</div>
                      </TableCell>
                      <TableCell className="max-w-[160px]">
                        <div className="truncate text-sm" title={item.company}>{item.company}</div>
                      </TableCell>
                      <TableCell className="max-w-[160px]">
                        <div className="truncate text-sm" title={item.work}>{item.work}</div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={item.pending} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.officer || <span className="text-muted-foreground/50">—</span>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.assigned || <span className="text-muted-foreground/50">—</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setViewSubmission(item as Submission)}
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive/60 hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete this record?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete the submission for <strong>{item.company}</strong> ({item.work}). This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(item.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  {deleteSubmission.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {data && data.total > limit && (
            <div className="flex items-center justify-between p-4 border-t bg-muted/20">
              <div className="text-sm text-muted-foreground">
                Page {page} — showing {offset + 1}–{Math.min(offset + limit, data.total)} of {data.total}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={offset + limit >= data.total}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <SubmissionDetailDialog
        submission={viewSubmission}
        open={!!viewSubmission}
        onClose={() => setViewSubmission(null)}
      />
    </div>
  );
}
