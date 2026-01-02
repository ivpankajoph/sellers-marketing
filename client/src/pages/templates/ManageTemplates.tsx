import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  MoreHorizontal,
  Edit,
  Trash2,
  Loader2,
  Plus,
  Copy,
  RefreshCw,
  Send,
  AlertTriangle,
  CheckCircle2,
  Info,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { useRef } from "react";

interface Template {
  id: string;
  name: string;
  category: "marketing" | "utility" | "authentication";
  content: string;
  variables: string[];
  status: "pending" | "approved" | "rejected";
  language?: string;
  metaTemplateId?: string;
  metaStatus?: string;
  rejectionReason?: string;
  lastSyncedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export default function ManageTemplates() {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
    null
  );
  const [formData, setFormData] = useState({
    name: "",
    category: "utility" as "marketing" | "utility" | "authentication",
    content: "",
    variables: "",
  });
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading } = useQuery<Template[]>({
    queryKey: ["/api/templates"],
    queryFn: async () => {
      const res = await fetch("/api/templates");
      if (!res.ok) throw new Error("Failed to fetch templates");
      return res.json();
    },
  });

  const userDataString = localStorage.getItem("whatsapp_auth_user");
  if (!userDataString) {
    alert("User not logged in");
    return;
  }

  const userData = JSON.parse(userDataString);
  const userId = userData.id;
  const syncMetaTemplatesMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/templates/sync-meta?userId=${userId}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error || data.message || "Failed to sync templates"
        );
      }
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      const approvedList =
        data.approvedTemplates?.length > 0
          ? `Approved: ${data.approvedTemplates.join(", ")}`
          : "No approved templates found";
      toast.success(
        data.message || `Synced ${data.synced || 0} templates from Meta`,
        {
          description: approvedList,
          duration: 5000,
        }
      );
    },
    onError: (error: Error) => {
      toast.error("Failed to sync META templates", {
        description: error.message,
        duration: 5000,
      });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create template from frontend");
      return res.json();
    },
    onSuccess: (template) => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      setIsAddDialogOpen(false);
      resetForm();
      toast.success("Template created successfully!", {
        description: "Click 'Submit' button to send it to Meta for approval.",
        duration: 4000,
      });
    },
    onError: () => {
      toast.error("Failed to create template from frontend");
    },
  });

  const submitForApprovalMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const res = await fetch(`/api/templates/${templateId}/submit-approval`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error || data.message || "Failed to submit for approval"
        );
      }
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast.success(
        data.message || "Template submitted to Meta for approval!",
        {
          description: data.metaTemplateName
            ? `Template name in Meta: ${data.metaTemplateName}`
            : undefined,
          duration: 5000,
        }
      );
    },
    onError: (error: Error) => {
      toast.error("Failed to submit template", {
        description: error.message,
        duration: 5000,
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/templates/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update template");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      setIsEditDialogOpen(false);
      setSelectedTemplate(null);
      toast.success("Template updated successfully");
    },
    onError: () => {
      toast.error("Failed to update template");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete template");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast.success("Template deleted successfully");
    },
    onError: () => {
      toast.error("Failed to delete template");
    },
  });

  const resetForm = () => {
    setFormData({ name: "", category: "utility", content: "", variables: "" });
  };

  const openEditDialog = (template: Template) => {
    setSelectedTemplate(template);
    setFormData({
      name: template.name,
      category: template.category,
      content: template.content,
      variables: template.variables.join(", "),
    });
    setIsEditDialogOpen(true);
  };

  const handleCreate = () => {
    createMutation.mutate({
      name: formData.name,
      category: formData.category,
      content: formData.content,
      variables: formData.variables
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
    });
  };

  const handleUpdate = () => {
    if (!selectedTemplate) return;
    updateMutation.mutate({
      id: selectedTemplate.id,
      data: {
        name: formData.name,
        category: formData.category,
        content: formData.content,
        variables: formData.variables
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
        status: "pending",
      },
    });
  };

  const copyToClipboard = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success("Template content copied to clipboard");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "default";
      case "pending":
        return "secondary";
      case "rejected":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const isSyncingRef = useRef(false);

  useEffect(() => {
    const sync = async () => {
      if (isSyncingRef.current) return;

      isSyncingRef.current = true;
      try {
        await syncMetaTemplatesMutation.mutateAsync();
      } catch (err) {
        // handled by mutation onError
      } finally {
        isSyncingRef.current = false;
      }
    };

    // initial sync
    sync();

    const interval = setInterval(sync, 10000); 

    return () => clearInterval(interval);
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">
              Manage Templates
            </h2>
            <p className="text-muted-foreground">
              Create and manage your WhatsApp message templates.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => syncMetaTemplatesMutation.mutate()}
              disabled={syncMetaTemplatesMutation.isPending}
            >
              {syncMetaTemplatesMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Sync META Templates
            </Button>
            <Button
              onClick={() => {
                resetForm();
                setIsAddDialogOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Template
            </Button>
          </div>
        </div>

        <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-900">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Info className="h-5 w-5 text-blue-600" />
              WhatsApp Template Rules & Guidelines
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Allowed Content
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1 pl-6 list-disc">
                  <li>Transaction confirmations (orders, bookings)</li>
                  <li>Account updates and notifications</li>
                  <li>Customer service responses</li>
                  <li>One-time passwords (OTP)</li>
                  <li>Appointment reminders</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  Not Allowed
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1 pl-6 list-disc">
                  <li>Promotional content without opt-in</li>
                  <li>Adult or gambling content</li>
                  <li>Misleading or spam messages</li>
                  <li>Political content</li>
                  <li>Cryptocurrency promotions</li>
                </ul>
              </div>
            </div>
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Approval Process</AlertTitle>
              <AlertDescription>
                Templates must be approved by Meta before use. Marketing
                templates may take 24-48 hours. Utility and authentication
                templates are usually approved faster.
                <a
                  href="https://developers.facebook.com/docs/whatsapp/message-templates/guidelines"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 ml-2 text-blue-600 hover:underline"
                >
                  View Full Guidelines <ExternalLink className="h-3 w-3" />
                </a>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>All Templates</CardTitle>
            <CardDescription>
              {templates.length} template{templates.length !== 1 ? "s" : ""} in
              your library. Note that editing an approved template will require
              re-approval.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No templates yet. Create your first template or sync from Meta
                to get started.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Language</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Variables</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell className="font-medium">
                        {template.name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {template.category}
                        </Badge>
                      </TableCell>
                      <TableCell>{template.language || "en"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={getStatusColor(
                            template.metaStatus?.toLowerCase() ||
                              template.status
                          )}
                          className="capitalize"
                        >
                          {template.metaStatus?.toLowerCase() ||
                            template.status}
                        </Badge>
                      </TableCell>
                     <TableCell>
  <div className="flex flex-wrap gap-1">
    {(template.variables || []).slice(0, 3).map((v) => (
      <Badge key={v} variant="secondary" className="text-xs">
        {`{{${v}}}`}
      </Badge>
    ))}
    {(template.variables?.length || 0) > 3 && (
      <Badge variant="secondary" className="text-xs">
        +{(template.variables?.length || 0) - 3}
      </Badge>
    )}
  </div>
</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(template.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {(template.metaStatus?.toLowerCase() ||
                            template.status) === "pending" &&
                            !template.metaTemplateId && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  submitForApprovalMutation.mutate(template.id)
                                }
                                disabled={submitForApprovalMutation.isPending}
                              >
                                <Send className="mr-1 h-3 w-3" />
                                Submit
                              </Button>
                            )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() =>
                                  copyToClipboard(template.content)
                                }
                              >
                                <Copy className="mr-2 h-4 w-4" />
                                Copy Content
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => openEditDialog(template)}
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() =>
                                  deleteMutation.mutate(template.id)
                                }
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Alert className="bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-sm">
                This template will be submitted to Meta for approval. Approval
                may take up to 24-48 hours for marketing templates.
              </AlertDescription>
            </Alert>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Template Name *</Label>
                <Input
                  placeholder="welcome_message"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      name: e.target.value.toLowerCase().replace(/\s+/g, "_"),
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Use lowercase with underscores (no spaces)
                </p>
              </div>
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(v) =>
                    setFormData({ ...formData, category: v as any })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="marketing">
                      Marketing (Promotional)
                    </SelectItem>
                    <SelectItem value="utility">
                      Utility (Transactional)
                    </SelectItem>
                    <SelectItem value="authentication">
                      Authentication (OTP)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Message Content *</Label>
              <Textarea
                placeholder="Hello {{name}}, welcome to our service!"
                value={formData.content}
                onChange={(e) =>
                  setFormData({ ...formData, content: e.target.value })
                }
                rows={5}
              />
              <p className="text-xs text-muted-foreground">
                Use {"{{variable}}"} syntax for dynamic content. Max 1024
                characters.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Variables (comma-separated)</Label>
              <Input
                placeholder="name, order_id, delivery_date"
                value={formData.variables}
                onChange={(e) =>
                  setFormData({ ...formData, variables: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={
                createMutation.isPending || !formData.name || !formData.content
              }
            >
              {createMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create & Submit for Approval
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedTemplate?.status === "approved" && (
              <Alert className="bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-sm">
                  Editing this approved template will require re-approval from
                  Meta.
                </AlertDescription>
              </Alert>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Template Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      name: e.target.value.toLowerCase().replace(/\s+/g, "_"),
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(v) =>
                    setFormData({ ...formData, category: v as any })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="marketing">Marketing</SelectItem>
                    <SelectItem value="utility">Utility</SelectItem>
                    <SelectItem value="authentication">
                      Authentication
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Message Content</Label>
              <Textarea
                value={formData.content}
                onChange={(e) =>
                  setFormData({ ...formData, content: e.target.value })
                }
                rows={5}
              />
            </div>
            <div className="space-y-2">
              <Label>Variables (comma-separated)</Label>
              <Input
                value={formData.variables}
                onChange={(e) =>
                  setFormData({ ...formData, variables: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={
                updateMutation.isPending || !formData.name || !formData.content
              }
            >
              {updateMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save & Resubmit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
