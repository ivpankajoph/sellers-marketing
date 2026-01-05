// pages/DripCampaignReport.tsx
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableCaption,
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
import DashboardLayout from "@/components/layout/DashboardLayout";
import { format } from "date-fns";
import axios from "axios";

// API functions
export const fetchCampaignReports = (params: any) =>
  axios.get("/api/reports/drip-campaigns", { params });

export const fetchCampaignSummary = (campaignId: string) =>
  axios.get(`/api/reports/drip-campaigns/${campaignId}/summary`);

export const fetchCampaignLogs = (campaignId: string, params: any) =>
  axios.get(`/api/reports/drip-campaigns/${campaignId}/logs`, { params });

// Define types
interface Campaign {
  _id: string;
  name: string;
  status: "completed" | "running" | "paused";
  steps: any[];
  contacts: string[];
  createdAt: string;
}

interface CampaignReportResponse {
  data: Campaign[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}

// Valid sort fields
type SortBy = "createdAt" | "name";
type SortOrder = "asc" | "desc";
type CampaignStatus = "completed" | "running" | "paused" | "all";

export default function DripCampaignReport() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<CampaignStatus>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [sortBy, setSortBy] = useState<SortBy>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [search, status, fromDate, toDate, sortBy, sortOrder]);

  const {
    data,
    isLoading,
    isError,
  } = useQuery<CampaignReportResponse>({
    queryKey: ["campaign-reports", search, status, fromDate, toDate, sortBy, sortOrder, page],
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

  const totalPages = data ? Math.ceil(data.meta.total / 10) : 1;

  const clearFilters = () => {
    setSearch("");
    setStatus("all");
    setFromDate("");
    setToDate("");
    setSortBy("createdAt");
    setSortOrder("desc");
    setPage(1);
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
                onChange={(e) => setSearch(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm text-muted-foreground">Status</label>
              <Select value={status} onValueChange={(value) => setStatus(value as CampaignStatus)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  {/* ✅ Fixed: value is NOT empty string */}
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="running">Running</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm text-muted-foreground">From</label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm text-muted-foreground">To</label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 mb-4">
            <div>
              <label className="text-sm text-muted-foreground">Sort By</label>
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortBy)}>
                <SelectTrigger className="w-[140px] mt-1">
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
              <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as SortOrder)}>
                <SelectTrigger className="w-[120px] mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Newest First</SelectItem>
                  <SelectItem value="asc">Oldest First</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button variant="outline" onClick={clearFilters} className="mt-6 h-9 px-3">
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="text-center py-8">Loading campaigns...</div>
      ) : isError ? (
        <div className="text-center py-8 text-destructive">Failed to load reports.</div>
      ) : data?.data.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">No campaigns found.</div>
      ) : (
        <>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Steps</TableHead>
                  <TableHead className="text-center">Contacts</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data.map((c) => (
                  <TableRow key={c._id}>
                    <TableCell className="font-medium max-w-xs truncate">{c.name}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          c.status === "completed"
                            ? "bg-green-100 text-green-800"
                            : c.status === "running"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">{c.steps.length}</TableCell>
                    <TableCell className="text-center">{c.contacts.length}</TableCell>
                    <TableCell>{format(new Date(c.createdAt), "dd MMM yyyy, HH:mm")}</TableCell>
                 
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              Showing {(page - 1) * 10 + 1}–
              {data && Math.min(page * 10, data.meta.total)} of {data?.meta.total} campaigns
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
    </DashboardLayout>
  );
}