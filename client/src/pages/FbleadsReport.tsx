// FB Lead Automation Report Page (React + TypeScript)
// Includes: statistics, filters, search, retry failed/unsent automation
// Assumes backend APIs described below exist

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import DashboardLayout from "@/components/layout/DashboardLayout";

const API = "/api";

// ---------------- Types ----------------
export interface LeadAutomationRow {
  _id: string;
  lead_id: string;
  form_id: string;
  form_name: string;
  full_name?: string;
  phone?: string;
  email?: string;
  category?: string;
  template_name?: string;
  template_id?: string;
  template_sent: boolean;
  automation_active: boolean;
  last_error?: string;
  created_time: string;
}

interface Stats {
  totalLeads: number;
  sent: number;
  unsent: number;
  failed: number;
  activeAutomations: number;
}

// ---------------- API Calls ----------------
async function fetchStats() {
  const { data } = await axios.get(`${API}/fb-automation/stats`);
  return data as Stats;
}

async function fetchLeads(params: any) {
  const { data } = await axios.get(`${API}/fb-automation/leads`, { params });
  return data as { rows: LeadAutomationRow[]; total: number };
}

async function retryAutomation(payload: { ids: string[] }) {
  const { data } = await axios.post(`${API}/fb-automation/retry`, payload);
  return data;
}

// ---------------- Page ----------------
export default function FbLeadAutomationReport() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "sent" | "unsent" | "failed">("all");
  const [formId, setFormId] = useState<string | "all">("all");
  const [selected, setSelected] = useState<string[]>([]);

  const { data: stats } = useQuery({ queryKey: ["fb-auto-stats"], queryFn: fetchStats });

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["fb-auto-leads", search, status, formId],
    queryFn: () => fetchLeads({ search, status, formId }),
  });

  const retryMutation = useMutation({
    mutationFn: retryAutomation,
    onSuccess: () => {
      setSelected([]);
      refetch();
    },
  });

  const rows = data?.rows ?? [];

  const toggleSelect = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const canRetryRows = useMemo(
    () => rows.filter((r) => !r.template_sent || r.last_error),
    [rows]
  );

  return (
<DashboardLayout>
        <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">FB Lead Automation Report</h1>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <StatCard title="Total Leads" value={stats?.totalLeads} />
        <StatCard title="Templates Sent" value={stats?.sent} />
        <StatCard title="Unsent" value={stats?.unsent} />
        <StatCard title="Failed" value={stats?.failed} />
        <StatCard title="Active Automations" value={stats?.activeAutomations} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <Input
          placeholder="Search name / phone / email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />

        <Select value={status} onValueChange={(v: any) => setStatus(v)}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="unsent">Unsent</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={formId} onValueChange={(v: any) => setFormId(v)}>
          <SelectTrigger className="w-64"><SelectValue placeholder="Form" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Forms</SelectItem>
            {/* Optionally populate from API */}
          </SelectContent>
        </Select>

        <Button
          disabled={selected.length === 0}
          onClick={() => retryMutation.mutate({ ids: selected })}
        >
          Retry Selected ({selected.length})
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Leads</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead />
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Form</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r._id}>
                  <TableCell>
                    <input
                      type="checkbox"
                      disabled={r.template_sent && !r.last_error}
                      checked={selected.includes(r._id)}
                      onChange={() => toggleSelect(r._id)}
                    />
                  </TableCell>
                  <TableCell>{r.full_name}</TableCell>
                  <TableCell>{r.phone}</TableCell>
                  <TableCell className="max-w-xs truncate">{r.form_name}</TableCell>
                  <TableCell>{r.template_name}</TableCell>
                  <TableCell>
                    {r.template_sent ? (
                      <Badge variant="default">Sent</Badge>
                    ) : r.last_error ? (
                      <Badge variant="destructive">Failed</Badge>
                    ) : (
                      <Badge variant="secondary">Unsent</Badge>
                    )}
                  </TableCell>
                  <TableCell>{new Date(r.created_time).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {isLoading && <p className="text-sm text-muted-foreground mt-2">Loading…</p>}
        </CardContent>
      </Card>
    </div>
</DashboardLayout>
  );
}

function StatCard({ title, value }: { title: string; value?: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value ?? "—"}</div>
      </CardContent>
    </Card>
  );
}

/* ---------------- BACKEND API DESIGN (Node + Express) ----------------

GET /api/fb-automation/stats
- Computes counts from leadfbs + formautomations

GET /api/fb-automation/leads
Query params:
- search
- status: sent | unsent | failed | all
- formId

POST /api/fb-automation/retry
Body: { ids: string[] }
- Re-enqueue cron / worker to resend WhatsApp template

Mongo logic hints:
- sent: template_sent === true
- unsent: template_sent === false && !last_error
- failed: last_error exists

--------------------------------------------------------------------- */
