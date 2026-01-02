import { useEffect, useState, useRef } from "react";
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
  X,
} from "lucide-react";
import Swal from "sweetalert2";


interface ButtonDef {
  type: "quick_reply" | "url" | "phone_number";
  text?: string;
  url?: string;
  phoneNumber?: string;
}

interface Template {
  id: string;
  name: string;
  category: "marketing" | "utility" | "authentication";
  language: string;
  headerType: string | null;
  headerText: string | null;
  headerImageUrl: string | null;
  content: string;
  footer: string | null;
  buttons: ButtonDef[];
  status: "pending" | "approved" | "rejected";
  metaTemplateId?: string;
  metaStatus?: string;
  rejectionReason?: string;
  lastSyncedAt?: string;
  createdAt: string;
  updatedAt: string;
  variables?: string[];
}

export default function ManageTemplates() {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    category: "utility" as "marketing" | "utility" | "authentication",
    language: "en_US",
    headerType: "",
    headerText: "",
    headerImageUrl: "",
    content: "",
    footer: "",
    variables: "",
  });
  const [buttonFields, setButtonFields] = useState<ButtonDef[]>([]); // <-- NEW

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
    return null;
  }

  const userData = JSON.parse(userDataString);
  const userId = userData.id;

  // === MUTATIONS (same as before, omitted for brevity but kept functional) ===
  const syncMetaTemplatesMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/templates/sync-meta?userId=${userId}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.message || "Failed to sync templates");
      }
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      const approvedList =
        data.approvedTemplates?.length > 0
          ? `Approved: ${data.approvedTemplates.join(", ")}`
          : "No approved templates found";
 
    },
    onError: (error: any) => {
      Swal.fire({
        icon: "error",
        title: "Sync Failed",
        text: error.message || "An unknown error occurred",
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
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (template) => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      setIsAddDialogOpen(false);
      resetForm();
      Swal.fire({
        icon: "success",
        title: "Template Created!",
        text: "Click 'Submit' to send it to Meta for approval.",
        timer: 4000,
        showConfirmButton: false,
      });
    },
    onError: (error: any) => {
      Swal.fire({
        icon: "error",
        title: "Creation Failed",
        text: error.message || "Failed to create template",
      });
    },
  });

  const submitForApprovalMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const res = await fetch(`/api/templates/${templateId}/submit-approval`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.message || "Failed to submit for approval");
      }
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      Swal.fire({
        icon: "success",
        title: data.message || "Template submitted to Meta for approval!",
        text: data.metaTemplateName
          ? `Template name in Meta: ${data.metaTemplateName}`
          : undefined,
        timer: 5000,
        showConfirmButton: false,
      });
    },
    onError: (error: any) => {
      Swal.fire({
        icon: "error",
        title: "Failed to submit template",
        text: error.message,
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
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      setIsEditDialogOpen(false);
      setSelectedTemplate(null);
      Swal.fire({
        icon: "success",
        title: "Template updated successfully",
        timer: 2000,
        showConfirmButton: false,
      });
    },
    onError: (error: any) => {
      Swal.fire({
        icon: "error",
        title: "Failed to update template",
        text: error.message,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete template");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      Swal.fire({
        icon: "success",
        title: "Template deleted successfully",
        timer: 2000,
        showConfirmButton: false,
      });
    },
    onError: () => {
      Swal.fire({
        icon: "error",
        title: "Failed to delete template",
      });
    },
  });

  // === FORM HELPERS ===
  const resetForm = () => {
    setFormData({
      name: "",
      category: "utility",
      language: "en_US",
      headerType: "",
      headerText: "",
      headerImageUrl: "",
      content: "",
      footer: "",
      variables: "",
    });
    setButtonFields([]);
  };

  const openEditDialog = (template: Template) => {
    setSelectedTemplate(template);
    setFormData({
      name: template.name,
      category: template.category,
      language: template.language || "en_US",
      headerType: template.headerType || "",
      headerText: template.headerText || "",
      headerImageUrl: template.headerImageUrl || "",
      content: template.content,
      footer: template.footer || "",
      variables: (template.variables || []).join(", "),
    });
    setButtonFields(template.buttons || []);
    setIsEditDialogOpen(true);
  };

  const handleCreate = () => {
    createMutation.mutate({
      ...formData,
      headerType: formData.headerType || null,
      headerText: formData.headerText || null,
      headerImageUrl: formData.headerImageUrl || null,
      footer: formData.footer || null,
      buttons: buttonFields,
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
        ...formData,
        headerType: formData.headerType || null,
        headerText: formData.headerText || null,
        headerImageUrl: formData.headerImageUrl || null,
        footer: formData.footer || null,
        buttons: buttonFields,
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
    Swal.fire({
      icon: "success",
      title: "Copied!",
      text: "Template content copied to clipboard",
      timer: 1500,
      showConfirmButton: false,
    });
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

  // === BUTTON UI HELPERS ===
  const addButton = () => {
    setButtonFields([...buttonFields, { type: "quick_reply", text: "" }]);
  };

  const removeButton = (index: number) => {
    setButtonFields(buttonFields.filter((_, i) => i !== index));
  };

  const updateButton = (index: number, field: keyof ButtonDef, value: string) => {
    const newButtons = [...buttonFields];
    // @ts-ignore
    newButtons[index][field] = value;
    setButtonFields(newButtons);
  };

  // Sync effect for auto-sync
  const isSyncingRef = useRef(false);
  useEffect(() => {
    const sync = async () => {
      if (isSyncingRef.current) return;
      isSyncingRef.current = true;
      try {
        await syncMetaTemplatesMutation.mutateAsync();
      } catch (err) {
        // Handled by mutation onError
      } finally {
        isSyncingRef.current = false;
      }
    };
    sync();
    const interval = setInterval(sync, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <DashboardLayout>
      {/* ... top UI (header, info card) same as before ... */}

      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Manage Templates</h2>
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

        {/* Guidelines Card — unchanged */}

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
                      <TableCell className="font-medium">{template.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {template.category}
                        </Badge>
                      </TableCell>
                      <TableCell>{template.language || "en"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={getStatusColor(
                            template.metaStatus?.toLowerCase() || template.status
                          )}
                          className="capitalize"
                        >
                          {template.metaStatus?.toLowerCase() || template.status}
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
                        {formatDate(template.updatedAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {(template.metaStatus?.toLowerCase() || template.status) ===
                            "pending" &&
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
                                onClick={() => copyToClipboard(template.content)}
                              >
                                <Copy className="mr-2 h-4 w-4" />
                                Copy Content
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openEditDialog(template)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => deleteMutation.mutate(template.id)}
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

      {/* CREATE DIALOG */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Alert className="bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-sm">
                This template will be submitted to Meta for approval.
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
                    <SelectItem value="marketing">Marketing</SelectItem>
                    <SelectItem value="utility">Utility</SelectItem>
                    <SelectItem value="authentication">Authentication</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Language</Label>
              <Input
                value={formData.language}
                onChange={(e) => setFormData({ ...formData, language: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Header Type</Label>
              <Select
                value={formData.headerType}
                onValueChange={(v) => setFormData({ ...formData, headerType: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="image">Image</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formData.headerType === "text" && (
              <div className="space-y-2">
                <Label>Header Text</Label>
                <Input
                  value={formData.headerText}
                  onChange={(e) =>
                    setFormData({ ...formData, headerText: e.target.value })
                  }
                />
              </div>
            )}
            {formData.headerType === "image" && (
              <div className="space-y-2">
                <Label>Header Image URL</Label>
                <Input
                  value={formData.headerImageUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, headerImageUrl: e.target.value })
                  }
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Message Body *</Label>
              <Textarea
                placeholder="Hello {{1}}, welcome!"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows={5}
              />
            </div>
            <div className="space-y-2">
              <Label>Footer</Label>
              <Input
                value={formData.footer}
                onChange={(e) => setFormData({ ...formData, footer: e.target.value })}
              />
            </div>

            {/* === BUTTON UI EDITOR === */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Buttons</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={addButton}
                  disabled={buttonFields.length >= 3} // WhatsApp limit
                >
                  <Plus className="h-3 w-3 mr-1" /> Add Button
                </Button>
              </div>
              {buttonFields.length === 0 ? (
                <p className="text-sm text-muted-foreground">No buttons added.</p>
              ) : (
                <div className="space-y-3 p-3 border rounded-md">
                  {buttonFields.map((btn, idx) => (
                    <div key={idx} className="flex flex-col gap-2 p-2 border rounded bg-muted/20">
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-medium">Button {idx + 1}</span>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          onClick={() => removeButton(idx)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <Label className="text-xs">Type</Label>
                          <Select
                            value={btn.type}
                            onValueChange={(v) =>
                              updateButton(idx, "type", v as any)
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="quick_reply">Quick Reply</SelectItem>
                              <SelectItem value="url">URL</SelectItem>
                              <SelectItem value="phone_number">Phone Number</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {btn.type === "quick_reply" && (
                          <div>
                            <Label className="text-xs">Quick Reply Text</Label>
                            <Input
                              value={btn.text || ""}
                              onChange={(e) => updateButton(idx, "text", e.target.value)}
                              placeholder="e.g., Yes"
                            />
                          </div>
                        )}

                        {btn.type === "url" && (
                          <div>
                            <Label className="text-xs">URL</Label>
                            <Input
                              value={btn.url || ""}
                              onChange={(e) => updateButton(idx, "url", e.target.value)}
                              placeholder="https://example.com"
                            />
                          </div>
                        )}

                        {btn.type === "phone_number" && (
                          <div>
                            <Label className="text-xs">Phone Number</Label>
                            <Input
                              value={btn.phoneNumber || ""}
                              onChange={(e) =>
                                updateButton(idx, "phoneNumber", e.target.value)
                              }
                              placeholder="+919876543210"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {buttonFields.length >= 3 && (
                <p className="text-xs text-muted-foreground">
                  Max 3 buttons allowed by WhatsApp.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Variables (comma-separated)</Label>
              <Input
                placeholder="name, order_id"
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

      {/* EDIT DIALOG — same button UI */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 overflow-y-auto max-h-[70vh]">
            {selectedTemplate?.status === "approved" && (
              <Alert className="bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-sm">
                  Editing this approved template will require re-approval from Meta.
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
                    <SelectItem value="authentication">Authentication</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Language</Label>
              <Input
                value={formData.language}
                onChange={(e) => setFormData({ ...formData, language: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Header Type</Label>
              <Select
                value={formData.headerType}
                onValueChange={(v) => setFormData({ ...formData, headerType: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="image">Image</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formData.headerType === "text" && (
              <div className="space-y-2">
                <Label>Header Text</Label>
                <Input
                  value={formData.headerText}
                  onChange={(e) =>
                    setFormData({ ...formData, headerText: e.target.value })
                  }
                />
              </div>
            )}
            {formData.headerType === "image" && (
              <div className="space-y-2">
                <Label>Header Image URL</Label>
                <Input
                  value={formData.headerImageUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, headerImageUrl: e.target.value })
                  }
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Message Body</Label>
              <Textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows={5}
              />
            </div>
            <div className="space-y-2">
              <Label>Footer</Label>
              <Input
                value={formData.footer}
                onChange={(e) => setFormData({ ...formData, footer: e.target.value })}
              />
            </div>

            {/* BUTTON UI (same as create) */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Buttons</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={addButton}
                  disabled={buttonFields.length >= 3}
                >
                  <Plus className="h-3 w-3 mr-1" /> Add Button
                </Button>
              </div>
              {buttonFields.length === 0 ? (
                <p className="text-sm text-muted-foreground">No buttons added.</p>
              ) : (
                <div className="space-y-3 p-3 border rounded-md">
                  {buttonFields.map((btn, idx) => (
                    <div key={idx} className="flex flex-col gap-2 p-2 border rounded bg-muted/20">
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-medium">Button {idx + 1}</span>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          onClick={() => removeButton(idx)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <Label className="text-xs">Type</Label>
                          <Select
                            value={btn.type}
                            onValueChange={(v) =>
                              updateButton(idx, "type", v as any)
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="quick_reply">Quick Reply</SelectItem>
                              <SelectItem value="url">URL</SelectItem>
                              <SelectItem value="phone_number">Phone Number</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {btn.type === "quick_reply" && (
                          <div>
                            <Label className="text-xs">Quick Reply Text</Label>
                            <Input
                              value={btn.text || ""}
                              onChange={(e) => updateButton(idx, "text", e.target.value)}
                              placeholder="e.g., Yes"
                            />
                          </div>
                        )}

                        {btn.type === "url" && (
                          <div>
                            <Label className="text-xs">URL</Label>
                            <Input
                              value={btn.url || ""}
                              onChange={(e) => updateButton(idx, "url", e.target.value)}
                              placeholder="https://example.com"
                            />
                          </div>
                        )}

                        {btn.type === "phone_number" && (
                          <div>
                            <Label className="text-xs">Phone Number</Label>
                            <Input
                              value={btn.phoneNumber || ""}
                              onChange={(e) =>
                                updateButton(idx, "phoneNumber", e.target.value)
                              }
                              placeholder="+919876543210"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {buttonFields.length >= 3 && (
                <p className="text-xs text-muted-foreground">
                  Max 3 buttons allowed by WhatsApp.
                </p>
              )}
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
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
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