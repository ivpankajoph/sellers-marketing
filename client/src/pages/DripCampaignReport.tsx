import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableHeader,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { format } from "date-fns";
import axios from "axios";

type SortBy = "createdAt" | "name";
type SortOrder = "asc" | "desc";
type CampaignStatus = "completed" | "running" | "paused" | "draft" | "failed" | "all";

type CampaignReportMetrics = {
  expectedMessages: number;
  attempted: number;
  accepted: number;
  delivered: number;
  read: number;
  failed: number;
  pending: number;
  notAttempted: number;
  metaAccepted: number;
  lastAttemptAt?: string | null;
  lastWebhookAt?: string | null;
};

type CampaignListItem = {
  _id: string;
  id?: string;
  name: string;
  status: string;
  steps: any[];
  contacts: string[];
  createdAt: string;
  updatedAt?: string;
  reportMetrics?: CampaignReportMetrics;
};

type CampaignReportResponse = {
  data: CampaignListItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
};

type ContactTrace = {
  contact: string;
  status: string;
  providerStatus?: string | null;
  finalMetaStatus: string;
  attemptCount: number;
  templateName?: string | null;
  templateId?: string | null;
  messageId?: string | null;
  sentAt?: string | null;
  deliveredAt?: string | null;
  readAt?: string | null;
  failedAt?: string | null;
  sendAttemptedAt?: string | null;
  attemptedLanguage?: string | null;
  providerHttpStatus?: number | null;
  providerErrorCode?: string | null;
  error?: string | null;
  metaAccepted: boolean;
  metaAcceptedAt?: string | null;
  requestPayload?: unknown;
  providerResponse?: unknown;
  webhookTimeline?: Array<{
    id?: string | null;
    status?: string | null;
    statusTimestamp?: string | null;
    webhookReceivedAt?: string | null;
    errorCode?: string | null;
    errorTitle?: string | null;
    errorMessage?: string | null;
    errorDetails?: string | null;
    rawStatus?: unknown;
  }>;
};

type StepDetail = {
  stepIndex: number;
  stepOrder: number;
  templateName?: string | null;
  templateId?: string | null;
  scheduleType?: "delay" | "specific" | null;
  delayDays?: number;
  delayHours?: number;
  specificDate?: string | null;
  specificTime?: string | null;
  totals: {
    contacts: number;
    attempted: number;
    accepted: number;
    delivered: number;
    read: number;
    failed: number;
    pending: number;
    notAttempted: number;
  };
  contacts: ContactTrace[];
};

type CampaignDetailResponse = {
  campaign: {
    _id: string;
    id?: string;
    name: string;
    status: string;
    currentStep?: number;
    nextRunAt?: string | null;
    contactsCount: number;
    stepsCount: number;
    createdAt?: string;
    updatedAt?: string;
  };
  totals: {
    expectedMessages: number;
    attempted: number;
    accepted: number;
    delivered: number;
    read: number;
    failed: number;
    pending: number;
    notAttempted: number;
    totalContacts: number;
    totalSteps: number;
    metaAccepted: number;
    webhookEvents: number;
  };
  webhookSummary: Record<string, number>;
  steps: StepDetail[];
};

const fetchCampaignReports = (params: Record<string, unknown>) =>
  axios.get("/api/reports/drip-campaigns", { params });

const fetchCampaignDetails = (campaignId: string) =>
  axios.get(`/api/reports/drip-campaigns/${campaignId}/details`);

const formatDateTime = (value?: string | Date | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return format(date, "dd MMM yyyy, HH:mm:ss");
};

const prettyJson = (value: unknown) => {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return String(value ?? "");
  }
};

const statusBadgeClass = (status: string) => {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "completed" || normalized === "delivered" || normalized === "read") {
    return "bg-green-100 text-green-800";
  }
  if (normalized === "running" || normalized === "accepted" || normalized === "sent") {
    return "bg-blue-100 text-blue-800";
  }
  if (normalized === "failed") {
    return "bg-red-100 text-red-800";
  }
  if (normalized === "paused") {
    return "bg-amber-100 text-amber-800";
  }
  return "bg-slate-100 text-slate-700";
};

export default function DripCampaignReport() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<CampaignStatus>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [sortBy, setSortBy] = useState<SortBy>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [page, setPage] = useState(1);

  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const [traceViewerOpen, setTraceViewerOpen] = useState(false);
  const [traceViewerTitle, setTraceViewerTitle] = useState("Full Trace");
  const [traceViewerContent, setTraceViewerContent] = useState("{}");

  const listQuery = useQuery<CampaignReportResponse>({
    queryKey: [
      "drip-campaign-reports",
      search,
      status,
      fromDate,
      toDate,
      sortBy,
      sortOrder,
      page,
    ],
    queryFn: () =>
      fetchCampaignReports({
        search: search || undefined,
        status: status === "all" ? undefined : status,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        sortBy,
        sortOrder,
        page,
        limit: 10,
      }).then((res) => res.data),
  });

  const detailsQuery = useQuery<CampaignDetailResponse>({
    queryKey: ["drip-campaign-details", selectedCampaignId],
    queryFn: () => fetchCampaignDetails(String(selectedCampaignId)).then((res) => res.data),
    enabled: detailsOpen && Boolean(selectedCampaignId),
  });

  const totalPages = useMemo(() => {
    const total = listQuery.data?.meta?.total || 0;
    return Math.max(1, Math.ceil(total / 10));
  }, [listQuery.data]);

  const clearFilters = () => {
    setSearch("");
    setStatus("all");
    setFromDate("");
    setToDate("");
    setSortBy("createdAt");
    setSortOrder("desc");
    setPage(1);
  };

  const openDetails = (campaignId: string) => {
    setSelectedCampaignId(campaignId);
    setDetailsOpen(true);
  };

  const openTrace = (
    label: string,
    step: StepDetail,
    contact: ContactTrace
  ) => {
    setTraceViewerTitle(label);
    setTraceViewerContent(
      prettyJson({
        campaignId: selectedCampaignId,
        stepIndex: step.stepIndex,
        stepOrder: step.stepOrder,
        stepTemplateName: step.templateName,
        stepTemplateId: step.templateId,
        scheduleType: step.scheduleType,
        contact: contact.contact,
        status: contact.status,
        providerStatus: contact.providerStatus,
        finalMetaStatus: contact.finalMetaStatus,
        attemptCount: contact.attemptCount,
        messageId: contact.messageId,
        attemptedLanguage: contact.attemptedLanguage,
        providerHttpStatus: contact.providerHttpStatus,
        providerErrorCode: contact.providerErrorCode,
        error: contact.error,
        sendAttemptedAt: contact.sendAttemptedAt,
        sentAt: contact.sentAt,
        deliveredAt: contact.deliveredAt,
        readAt: contact.readAt,
        failedAt: contact.failedAt,
        metaAccepted: contact.metaAccepted,
        metaAcceptedAt: contact.metaAcceptedAt,
        requestPayload: contact.requestPayload,
        providerResponse: contact.providerResponse,
        webhookTimeline: contact.webhookTimeline || [],
      })
    );
    setTraceViewerOpen(true);
  };

  const downloadTraceJson = () => {
    const blob = new Blob([traceViewerContent], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "drip-contact-trace.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Drip Campaign Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="text-sm text-muted-foreground">Search</label>
              <Input
                placeholder="Campaign name or ID"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm text-muted-foreground">Status</label>
              <Select
                value={status}
                onValueChange={(value) => {
                  setStatus(value as CampaignStatus);
                  setPage(1);
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="running">Running</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm text-muted-foreground">From</label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setPage(1);
                }}
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm text-muted-foreground">To</label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setPage(1);
                }}
                className="mt-1"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-4 mb-4">
            <div>
              <label className="text-sm text-muted-foreground">Sort By</label>
              <Select
                value={sortBy}
                onValueChange={(value) => {
                  setSortBy(value as SortBy);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[150px] mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt">Created At</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm text-muted-foreground">Order</label>
              <Select
                value={sortOrder}
                onValueChange={(value) => {
                  setSortOrder(value as SortOrder);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[150px] mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Newest First</SelectItem>
                  <SelectItem value="asc">Oldest First</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button variant="outline" onClick={clearFilters}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {listQuery.isLoading ? (
        <div className="text-center py-8">Loading campaigns...</div>
      ) : listQuery.isError ? (
        <div className="text-center py-8 text-destructive">Failed to load reports.</div>
      ) : (listQuery.data?.data?.length || 0) === 0 ? (
        <div className="text-center py-8 text-muted-foreground">No campaigns found.</div>
      ) : (
        <>
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Steps</TableHead>
                  <TableHead className="text-center">Contacts</TableHead>
                  <TableHead className="text-center">Expected</TableHead>
                  <TableHead className="text-center">Attempted</TableHead>
                  <TableHead className="text-center">Delivered</TableHead>
                  <TableHead className="text-center">Read</TableHead>
                  <TableHead className="text-center">Failed</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Attempt</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listQuery.data?.data?.map((campaign) => (
                  <TableRow key={campaign._id}>
                    <TableCell className="font-medium min-w-[180px]">
                      <div className="flex flex-col">
                        <span className="truncate max-w-[260px]">{campaign.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {campaign.id || campaign._id}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadgeClass(
                          campaign.status
                        )}`}
                      >
                        {campaign.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">{campaign.steps?.length || 0}</TableCell>
                    <TableCell className="text-center">{campaign.contacts?.length || 0}</TableCell>
                    <TableCell className="text-center">
                      {campaign.reportMetrics?.expectedMessages ?? "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      {campaign.reportMetrics?.attempted ?? "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      {campaign.reportMetrics?.delivered ?? "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      {campaign.reportMetrics?.read ?? "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      {campaign.reportMetrics?.failed ?? "-"}
                    </TableCell>
                    <TableCell>{formatDateTime(campaign.createdAt)}</TableCell>
                    <TableCell>{formatDateTime(campaign.reportMetrics?.lastAttemptAt || null)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => openDetails(campaign._id)}>
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              Showing {(page - 1) * 10 + 1}-
              {Math.min(page * 10, listQuery.data?.meta?.total || 0)} of{" "}
              {listQuery.data?.meta?.total || 0} campaigns
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => (p < totalPages ? p + 1 : p))}
                disabled={page >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      <Dialog
        open={detailsOpen}
        onOpenChange={(open) => {
          setDetailsOpen(open);
          if (!open) setSelectedCampaignId(null);
        }}
      >
        <DialogContent className="max-w-[96vw] h-[92vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Drip Campaign Detail Trace
              {detailsQuery.data?.campaign?.name
                ? ` - ${detailsQuery.data.campaign.name}`
                : ""}
            </DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-auto pr-1 space-y-4">
            {detailsQuery.isLoading ? (
              <div className="py-8 text-center">Loading campaign details...</div>
            ) : detailsQuery.isError ? (
              <div className="py-8 text-center text-destructive">
                Failed to load campaign details.
              </div>
            ) : !detailsQuery.data ? (
              <div className="py-8 text-center text-muted-foreground">
                No details found.
              </div>
            ) : (
              <>
                <Card>
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                      <div className="border rounded-md p-3">
                        <div className="text-xs text-muted-foreground">Campaign ID</div>
                        <div className="text-sm font-medium break-all">
                          {detailsQuery.data.campaign.id || detailsQuery.data.campaign._id}
                        </div>
                      </div>
                      <div className="border rounded-md p-3">
                        <div className="text-xs text-muted-foreground">Status</div>
                        <div className="text-sm font-medium">{detailsQuery.data.campaign.status}</div>
                      </div>
                      <div className="border rounded-md p-3">
                        <div className="text-xs text-muted-foreground">Created</div>
                        <div className="text-sm font-medium">
                          {formatDateTime(detailsQuery.data.campaign.createdAt || null)}
                        </div>
                      </div>
                      <div className="border rounded-md p-3">
                        <div className="text-xs text-muted-foreground">Next Run</div>
                        <div className="text-sm font-medium">
                          {formatDateTime(detailsQuery.data.campaign.nextRunAt || null)}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-4">
                      <Badge variant="outline">
                        Steps: {detailsQuery.data.totals.totalSteps}
                      </Badge>
                      <Badge variant="outline">
                        Contacts: {detailsQuery.data.totals.totalContacts}
                      </Badge>
                      <Badge variant="outline">
                        Expected: {detailsQuery.data.totals.expectedMessages}
                      </Badge>
                      <Badge variant="outline">
                        Attempted: {detailsQuery.data.totals.attempted}
                      </Badge>
                      <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                        Meta Accepted: {detailsQuery.data.totals.metaAccepted}
                      </Badge>
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                        Delivered: {detailsQuery.data.totals.delivered}
                      </Badge>
                      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                        Read: {detailsQuery.data.totals.read}
                      </Badge>
                      <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
                        Failed: {detailsQuery.data.totals.failed}
                      </Badge>
                      <Badge variant="outline">
                        Not Attempted: {detailsQuery.data.totals.notAttempted}
                      </Badge>
                      <Badge variant="outline">
                        Webhook Events: {detailsQuery.data.totals.webhookEvents}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                {detailsQuery.data.steps.map((step) => (
                  <Card key={step.stepIndex}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">
                        Step {step.stepOrder} - {step.templateName || "Template not mapped"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Template ID:</span>{" "}
                          {step.templateId || "-"}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Schedule:</span>{" "}
                          {step.scheduleType || "-"}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Specific:</span>{" "}
                          {step.specificDate && step.specificTime
                            ? `${step.specificDate} ${step.specificTime}`
                            : "-"}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Delay:</span>{" "}
                          {Number(step.delayDays || 0)}d {Number(step.delayHours || 0)}h
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">Contacts: {step.totals.contacts}</Badge>
                        <Badge variant="outline">Attempted: {step.totals.attempted}</Badge>
                        <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                          Accepted: {step.totals.accepted}
                        </Badge>
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                          Delivered: {step.totals.delivered}
                        </Badge>
                        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                          Read: {step.totals.read}
                        </Badge>
                        <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
                          Failed: {step.totals.failed}
                        </Badge>
                        <Badge variant="outline">Pending: {step.totals.pending}</Badge>
                        <Badge variant="outline">
                          Not Attempted: {step.totals.notAttempted}
                        </Badge>
                      </div>

                      <div className="border rounded-md overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Contact</TableHead>
                              <TableHead>Send Status</TableHead>
                              <TableHead>Meta Status</TableHead>
                              <TableHead>Attempts</TableHead>
                              <TableHead>Message ID</TableHead>
                              <TableHead>Attempted At</TableHead>
                              <TableHead>Sent At</TableHead>
                              <TableHead>Delivered At</TableHead>
                              <TableHead>Read At</TableHead>
                              <TableHead>Failed At</TableHead>
                              <TableHead>Error</TableHead>
                              <TableHead className="text-right">Trace</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {step.contacts.map((contactRow) => (
                              <TableRow key={`${step.stepIndex}-${contactRow.contact}`}>
                                <TableCell className="font-medium">{contactRow.contact}</TableCell>
                                <TableCell>
                                  <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${statusBadgeClass(
                                      contactRow.status
                                    )}`}
                                  >
                                    {contactRow.status}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${statusBadgeClass(
                                      contactRow.finalMetaStatus
                                    )}`}
                                  >
                                    {contactRow.finalMetaStatus}
                                  </span>
                                </TableCell>
                                <TableCell>{contactRow.attemptCount}</TableCell>
                                <TableCell className="max-w-[220px] truncate">
                                  {contactRow.messageId || "-"}
                                </TableCell>
                                <TableCell>{formatDateTime(contactRow.sendAttemptedAt)}</TableCell>
                                <TableCell>{formatDateTime(contactRow.sentAt)}</TableCell>
                                <TableCell>{formatDateTime(contactRow.deliveredAt)}</TableCell>
                                <TableCell>{formatDateTime(contactRow.readAt)}</TableCell>
                                <TableCell>{formatDateTime(contactRow.failedAt)}</TableCell>
                                <TableCell className="max-w-[260px] truncate">
                                  {contactRow.error || "-"}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      openTrace(
                                        `Step ${step.stepOrder} / ${contactRow.contact}`,
                                        step,
                                        contactRow
                                      )
                                    }
                                  >
                                    Full Trace
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Webhook Status Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(detailsQuery.data.webhookSummary || {}).length === 0 ? (
                        <Badge variant="outline">No webhook statuses yet</Badge>
                      ) : (
                        Object.entries(detailsQuery.data.webhookSummary).map(
                          ([key, value]) => (
                            <Badge key={key} variant="outline">
                              {key}: {value}
                            </Badge>
                          )
                        )
                      )}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={traceViewerOpen} onOpenChange={setTraceViewerOpen}>
        <DialogContent className="max-w-4xl h-[86vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{traceViewerTitle}</DialogTitle>
          </DialogHeader>
          <div className="flex justify-end gap-2 mb-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigator.clipboard.writeText(traceViewerContent)}
            >
              Copy JSON
            </Button>
            <Button size="sm" onClick={downloadTraceJson}>
              Download JSON
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto rounded-md border border-slate-200 bg-slate-950 p-3">
            <pre className="text-xs text-slate-100 whitespace-pre">
              {traceViewerContent}
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
