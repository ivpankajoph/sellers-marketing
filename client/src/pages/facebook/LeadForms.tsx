import { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, FileText, Users, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface LeadForm {
  id: string;
  fbFormId: string;
  name: string;
  status: string;
  pageId: string;
  createdTime: string;
  syncedAt: string;
}

export default function LeadForms() {
  const [forms, setForms] = useState<LeadForm[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();

  const fetchForms = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/facebook/forms");
      if (response.ok) {
        const data = await response.json();
        setForms(data);
      }
    } catch (error) {
      console.error("Error fetching forms:", error);
    } finally {
      setLoading(false);
    }
  };

  const syncForms = async () => {
    setSyncing(true);
    try {
      const response = await fetch("/api/facebook/forms/sync", { method: "POST" });
      if (response.ok) {
        const data = await response.json();
        setForms(data.forms);
        toast({
          title: "Forms Synced",
          description: `Successfully synced ${data.count} lead form(s) from Facebook.`,
        });
      } else {
        const error = await response.json();
        toast({
          title: "Sync Failed",
          description: error.error || "Failed to sync forms from Facebook.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Sync Failed",
        description: "Network error while syncing forms.",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const syncLeads = async (formId: string) => {
    try {
      const response = await fetch(`/api/facebook/forms/${formId}/sync-leads`, { method: "POST" });
      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Leads Synced",
          description: `Successfully synced ${data.count} new lead(s).`,
        });
      } else {
        const error = await response.json();
        toast({
          title: "Sync Failed",
          description: error.error || "Failed to sync leads.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Sync Failed",
        description: "Network error while syncing leads.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchForms();
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Facebook Lead Forms</h2>
            <p className="text-muted-foreground">Manage and sync your Facebook lead generation forms</p>
          </div>
          <Button onClick={syncForms} disabled={syncing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : "Sync Forms"}
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Lead Forms
            </CardTitle>
            <CardDescription>
              Your connected Facebook lead forms. Click "Sync Leads" to fetch new submissions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : forms.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No lead forms found. Click "Sync Forms" to fetch from Facebook.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Form Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Facebook ID</TableHead>
                    <TableHead>Last Synced</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {forms.map((form) => (
                    <TableRow key={form.id}>
                      <TableCell className="font-medium">{form.name}</TableCell>
                      <TableCell>
                        <Badge variant={form.status === "ACTIVE" ? "default" : "secondary"}>
                          {form.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{form.fbFormId}</TableCell>
                      <TableCell>{new Date(form.syncedAt).toLocaleString()}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="outline" size="sm" onClick={() => syncLeads(form.id)}>
                          <Users className="h-4 w-4 mr-1" />
                          Sync Leads
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
