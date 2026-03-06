import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { getAuthHeaders } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type WebhookConfig = {
  callbackUrl: string;
  verifyToken: string;
  hints?: {
    requiresPublicHttps?: boolean;
  };
};

type WebhookEvent = {
  id: string;
  messageId?: string;
  recipientId?: string;
  status: string;
  statusTimestamp: string;
  webhookReceivedAt?: string;
  phoneNumberId?: string;
  errorCode?: string;
  errorTitle?: string;
  errorMessage?: string;
  errorDetails?: string;
  rawStatus?: unknown;
};

type WebhookEventsResponse = {
  events: WebhookEvent[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  summary: Record<string, number>;
};

const STATUS_OPTIONS = ["", "sent", "accepted", "delivered", "read", "failed"];

const formatDateTime = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-IN", { hour12: true });
};

export default function WebhookEvents() {
  const [config, setConfig] = useState<WebhookConfig | null>(null);
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messageIdFilter, setMessageIdFilter] = useState("");
  const [recipientFilter, setRecipientFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerTitle, setViewerTitle] = useState("Webhook Payload");
  const [viewerContent, setViewerContent] = useState("");

  const fetchConfig = useCallback(async () => {
    const res = await fetch("/api/webhook/whatsapp/config", {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      throw new Error((await res.text()) || "Failed to fetch webhook config");
    }
    const data = (await res.json()) as WebhookConfig;
    setConfig(data);
  }, []);

  const fetchEvents = useCallback(
    async (showLoader = true) => {
      if (showLoader) setLoading(true);
      else setRefreshing(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        params.set("limit", "200");
        if (messageIdFilter.trim()) params.set("messageId", messageIdFilter.trim());
        if (recipientFilter.trim()) params.set("recipientId", recipientFilter.trim());
        if (statusFilter.trim()) params.set("status", statusFilter.trim());

        const res = await fetch(`/api/webhook/whatsapp/status-events?${params.toString()}`, {
          headers: getAuthHeaders(),
        });
        if (!res.ok) {
          throw new Error((await res.text()) || "Failed to fetch webhook events");
        }

        const data = (await res.json()) as WebhookEventsResponse;
        setEvents(Array.isArray(data.events) ? data.events : []);
        setSummary(data.summary || {});
        setTotal(Number(data.pagination?.total || 0));
      } catch (err: any) {
        console.error("[WebhookEvents] fetch error:", err);
        setError(err?.message || "Failed to load webhook events.");
      } finally {
        if (showLoader) setLoading(false);
        else setRefreshing(false);
      }
    },
    [messageIdFilter, recipientFilter, statusFilter]
  );

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        await Promise.all([fetchConfig(), fetchEvents(false)]);
      } catch (err: any) {
        console.error("[WebhookEvents] init error:", err);
        setError(err?.message || "Failed to load webhook setup.");
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [fetchConfig, fetchEvents]);

  const summaryItems = useMemo(() => {
    return Object.entries(summary).sort((a, b) => b[1] - a[1]);
  }, [summary]);

  const copyText = async (text?: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error("[WebhookEvents] copy failed", err);
    }
  };

  const toPrettyJson = (value: unknown): string => {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  };

  const openViewer = (title: string, payload: unknown) => {
    setViewerTitle(title);
    setViewerContent(toPrettyJson(payload));
    setViewerOpen(true);
  };

  const downloadViewerJson = () => {
    if (!viewerContent) return;
    const blob = new Blob([viewerContent], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "meta-webhook-payload.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            WhatsApp Webhook Events
          </h1>
          <p className="text-slate-600 mt-1">
            Track actual message lifecycle by `messageId` (`sent`, `delivered`,
            `read`, `failed`).
          </p>
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">
            Meta Webhook Configuration
          </h2>

          <div className="grid gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Callback URL
              </label>
              <div className="flex gap-2">
                <input
                  value={config?.callbackUrl || ""}
                  readOnly
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 bg-slate-50"
                />
                <button
                  type="button"
                  onClick={() => void copyText(config?.callbackUrl)}
                  className="rounded-md bg-slate-900 text-white px-3 py-2 text-sm"
                >
                  Copy
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Verify Token
              </label>
              <div className="flex gap-2">
                <input
                  value={config?.verifyToken || ""}
                  readOnly
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 bg-slate-50"
                />
                <button
                  type="button"
                  onClick={() => void copyText(config?.verifyToken)}
                  className="rounded-md bg-slate-900 text-white px-3 py-2 text-sm"
                >
                  Copy
                </button>
              </div>
            </div>
          </div>

          {config?.hints?.requiresPublicHttps ? (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
              Meta webhook requires a public `https` URL. Localhost callback will not
              work in Meta dashboard.
            </p>
          ) : null}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-lg font-semibold text-slate-900">
              Delivery Status Events ({total})
            </h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  openViewer(
                    "Loaded Webhook Events (Full JSON)",
                    events.map((event) => ({
                      ...event,
                      rawStatus: event.rawStatus ?? {},
                    }))
                  )
                }
                className="rounded-md border border-slate-300 px-3 py-2 text-sm bg-white hover:bg-slate-50"
                disabled={events.length === 0}
              >
                View Full JSON
              </button>
              <button
                type="button"
                onClick={() => void fetchEvents(false)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm bg-white hover:bg-slate-50"
                disabled={refreshing}
              >
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              value={messageIdFilter}
              onChange={(e) => setMessageIdFilter(e.target.value)}
              placeholder="Filter by messageId (wamid...)"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              value={recipientFilter}
              onChange={(e) => setRecipientFilter(e.target.value)}
              placeholder="Filter by recipient number"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm bg-white"
            >
              {STATUS_OPTIONS.map((statusValue) => (
                <option key={statusValue || "all"} value={statusValue}>
                  {statusValue ? statusValue : "All statuses"}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void fetchEvents(false)}
              className="rounded-md bg-emerald-600 text-white px-3 py-2 text-sm"
            >
              Apply Filters
            </button>
            <button
              type="button"
              onClick={() => {
                setMessageIdFilter("");
                setRecipientFilter("");
                setStatusFilter("");
              }}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm bg-white"
            >
              Clear
            </button>
          </div>

          {summaryItems.length > 0 ? (
            <div className="flex gap-2 flex-wrap">
              {summaryItems.map(([statusKey, count]) => (
                <span
                  key={statusKey}
                  className="text-xs rounded-full border border-slate-300 bg-slate-50 px-2 py-1"
                >
                  {statusKey}: {count}
                </span>
              ))}
            </div>
          ) : null}

          {loading ? (
            <p className="text-sm text-slate-500">Loading webhook events...</p>
          ) : null}
          {error ? (
            <p className="text-sm text-red-600 whitespace-pre-wrap">{error}</p>
          ) : null}

          {!loading && !error ? (
            <div
              className="max-h-[62vh] overflow-x-scroll overflow-y-scroll border border-slate-200 rounded-lg"
              style={{ scrollbarGutter: "stable both-edges" }}
            >
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left">
                  <tr>
                    <th className="px-3 py-2">Status Time</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Recipient</th>
                    <th className="px-3 py-2">Message ID</th>
                    <th className="px-3 py-2">Error</th>
                    <th className="px-3 py-2">Meta Data</th>
                  </tr>
                </thead>
                <tbody>
                  {events.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                        No webhook status events found.
                      </td>
                    </tr>
                  ) : (
                    events.map((event) => (
                      <tr key={event.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 whitespace-nowrap">
                          {formatDateTime(event.statusTimestamp)}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap font-medium">
                          {event.status || "-"}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {event.recipientId || "-"}
                        </td>
                        <td className="px-3 py-2 max-w-[420px] truncate" title={event.messageId}>
                          {event.messageId || "-"}
                        </td>
                        <td className="px-3 py-2 max-w-[340px]">
                          <div className="truncate" title={event.errorDetails || event.errorMessage}>
                            {event.errorDetails || event.errorMessage || "-"}
                          </div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() =>
                              openViewer(
                                `Meta Webhook Event - ${event.messageId || event.id}`,
                                {
                                  id: event.id,
                                  messageId: event.messageId,
                                  recipientId: event.recipientId,
                                  status: event.status,
                                  statusTimestamp: event.statusTimestamp,
                                  webhookReceivedAt: event.webhookReceivedAt,
                                  phoneNumberId: event.phoneNumberId,
                                  errorCode: event.errorCode,
                                  errorTitle: event.errorTitle,
                                  errorMessage: event.errorMessage,
                                  errorDetails: event.errorDetails,
                                  rawStatus: event.rawStatus ?? {},
                                }
                              )
                            }
                            className="rounded-md border border-slate-300 px-2 py-1 text-xs bg-white hover:bg-slate-50"
                          >
                            View Full Data
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </div>

      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-w-4xl h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{viewerTitle}</DialogTitle>
          </DialogHeader>

          <div className="flex justify-end gap-2 mb-2">
            <button
              type="button"
              onClick={() => void copyText(viewerContent)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm bg-white hover:bg-slate-50"
            >
              Copy JSON
            </button>
            <button
              type="button"
              onClick={downloadViewerJson}
              className="rounded-md bg-slate-900 text-white px-3 py-2 text-sm"
            >
              Download JSON
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-auto rounded-md border border-slate-200 bg-slate-950 p-3">
            <pre className="text-xs text-slate-100 whitespace-pre">
              {viewerContent || "{}"}
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
