// ManageTemplates.tsx
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
import { Button } from "@/components/ui/button";
import Swal from "sweetalert2";
import { Trash2, Loader2 } from "lucide-react";

import TemplateHeader from "./TemplateHeader";
import TemplateTable from "./TemplateTable";
import TemplateFormDialog from "./TemplateFormDialog";
import { ButtonDef, Template } from "./type";

type BulkDeleteResponse = {
  success?: boolean;
  deletedCount?: number;
  deletedFromMetaCount?: number;
  metaDeletionSkippedCount?: number;
  failedCount?: number;
  failed?: Array<{ id: string; name?: string; error: string }>;
  message?: string;
};

function isHttpUrl(value?: string | null) {
  return Boolean(value && /^https?:\/\//i.test(value));
}

export default function ManageTemplates() {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
    null
  );
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(
    null
  );
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(
    new Set()
  );
  const [formData, setFormData] = useState({
    name: "",
    category: "utility" as "marketing" | "utility" | "authentication",
    language: "en_US",
    headerType: "none",
    headerText: "",
    headerImageUrl: "",
    content: "",
    footer: "",
    variables: "",
  });
  const [buttonFields, setButtonFields] = useState<ButtonDef[]>([]);

  // 👇 New image states for edit/create
  const [headerImagePreview, setHeaderImagePreview] = useState<string | null>(
    null
  );
  const [headerMediaHandle, setHeaderMediaHandle] = useState<string | null>(
    null
  );

  const queryClient = useQueryClient();

  const { data: templates = [], isLoading } = useQuery<Template[]>({
    queryKey: ["/api/templates"],
    queryFn: async () => {
      const res = await fetch("/api/templates?metaOnly=true");
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

  useEffect(() => {
    setSelectedTemplateIds((prev) => {
      const validIds = new Set(templates.map((template) => template.id));
      return new Set([...prev].filter((id) => validIds.has(id)));
    });
  }, [templates]);

  // === MUTATIONS ===
  const syncMetaTemplatesMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/templates/sync-meta?userId=${userId}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to sync templates");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
    },
    onError: (error: any) => {
      Swal.fire({ icon: "error", title: "Sync Failed", text: error.message });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      setIsAddDialogOpen(false);
      resetForm();
      Swal.fire({
        icon: "success",
        title: "Template Created!",
        timer: 4000,
        showConfirmButton: false,
      });
    },
    onError: (error: any) => {
      Swal.fire({ icon: "error", title: "Creation Failed", text: error.message });
    },
  });

  const submitForApprovalMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const res = await fetch(`/api/templates/${templateId}/submit-approval`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit");
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      Swal.fire({
        icon: "success",
        title: data.message || "Submitted!",
        text: data.metaTemplateName
          ? `Meta name: ${data.metaTemplateName}`
          : undefined,
        timer: 5000,
        showConfirmButton: false,
      });
    },
    onError: (error: any) => {
      Swal.fire({
        icon: "error",
        title: "Submission Failed",
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
        title: "Updated!",
        timer: 2000,
        showConfirmButton: false,
      });
    },
    onError: (error: any) => {
      Swal.fire({ icon: "error", title: "Update Failed", text: error.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(
        `/api/templates/${id}?deleteFromMeta=true&userId=${encodeURIComponent(userId)}`,
        { method: "DELETE" }
      );
      const data = await res
        .json()
        .catch(
          () =>
            ({ message: "Failed to delete template" } as {
              message: string;
              metaDeletionSkipped?: boolean;
            })
        );

      if (!res.ok) {
        throw new Error(data.message || "Failed to delete template");
      }

      return data;
    },
    onSuccess: (data, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      setSelectedTemplateIds((prev) => {
        const next = new Set(prev);
        next.delete(deletedId);
        return next;
      });

      if (data.metaDeletionSkipped) {
        Swal.fire({
          icon: "warning",
          title: "Deleted locally",
          text: data.message || "Template removed locally. Meta deletion skipped.",
        });
        return;
      }

      Swal.fire({
        icon: "success",
        title: "Deleted",
        text: data.message || "Template deleted successfully.",
        timer: 2000,
        showConfirmButton: false,
      });
    },
    onError: (error: any) => {
      Swal.fire({
        icon: "error",
        title: "Delete Failed",
        text: error.message || "Could not delete template.",
      });
    },
    onSettled: () => {
      setDeletingTemplateId(null);
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await fetch(
        `/api/templates/bulk-delete?deleteFromMeta=true&userId=${encodeURIComponent(userId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids }),
        }
      );
      const data: BulkDeleteResponse = await res
        .json()
        .catch(() => ({ message: "Failed to delete selected templates" }));
      if (!res.ok && res.status !== 207) {
        throw new Error(data.message || "Failed to delete selected templates");
      }
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      setSelectedTemplateIds(new Set());

      if ((data.failedCount || 0) > 0) {
        const failedPreview = (data.failed || [])
          .slice(0, 5)
          .map((item) => `${item.name || item.id}: ${item.error}`)
          .join("<br/>");

        Swal.fire({
          icon: "warning",
          title: "Partial delete completed",
          html:
            `${data.message || "Some templates could not be deleted."}<br/><br/>` +
            (failedPreview || ""),
        });
        return;
      }

      Swal.fire({
        icon: "success",
        title: "Deleted selected templates",
        text: data.message || "Templates deleted successfully.",
        timer: 2200,
        showConfirmButton: false,
      });
    },
    onError: (error: any) => {
      Swal.fire({
        icon: "error",
        title: "Bulk delete failed",
        text: error.message || "Could not delete selected templates.",
      });
    },
  });

  const toggleTemplateSelection = (id: string) => {
    setSelectedTemplateIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAllTemplates = () => {
    setSelectedTemplateIds((prev) => {
      const allSelected =
        templates.length > 0 &&
        templates.every((template) => prev.has(template.id));

      if (allSelected) {
        return new Set();
      }

      return new Set(templates.map((template) => template.id));
    });
  };

  const handleDeleteTemplate = async (id: string) => {
    const template = templates.find((item) => item.id === id);

    const result = await Swal.fire({
      icon: "warning",
      title: "Delete template?",
      html:
        `This will permanently delete <b>${template?.name || "this template"}</b> ` +
        "from your local database and Meta dashboard (if linked).",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Yes, delete",
    });

    if (!result.isConfirmed) return;
    setDeletingTemplateId(id);
    void Swal.fire({
      title: "Deleting template...",
      text: "Removing from Meta dashboard and local database.",
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => Swal.showLoading(),
    });
    deleteMutation.mutate(id);
  };

  const handleDeleteSelectedTemplates = async () => {
    const ids = Array.from(selectedTemplateIds);
    if (ids.length === 0) {
      await Swal.fire({
        icon: "info",
        title: "No templates selected",
        text: "Please select templates to delete.",
      });
      return;
    }

    const result = await Swal.fire({
      icon: "warning",
      title: `Delete ${ids.length} selected template${ids.length === 1 ? "" : "s"}?`,
      html:
        "Selected templates will be permanently deleted from your local database " +
        "and Meta dashboard (for linked Meta templates).",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Delete selected",
    });

    if (!result.isConfirmed) return;
    void Swal.fire({
      title: "Deleting selected templates...",
      text: "Please wait while we process Meta and local deletion.",
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => Swal.showLoading(),
    });
    bulkDeleteMutation.mutate(ids);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      category: "utility",
      language: "en_US",
      headerType: "none",
      headerText: "",
      headerImageUrl: "",
      content: "",
      footer: "",
      variables: "",
    });
    setButtonFields([]);
    setHeaderImagePreview(null);
    setHeaderMediaHandle(null);
  };

  const openEditDialog = (template: Template) => {
    const resolvedPreviewUrl = isHttpUrl(template.previewUrl)
      ? template.previewUrl
      : isHttpUrl(template.headerImageUrl)
        ? template.headerImageUrl
        : null;

    setSelectedTemplate(template);
    setFormData({
      name: template.name,
      category: template.category,
      language: template.language || "en_US",
      headerType: template.headerType || "none",
      headerText: template.headerText || "",
      headerImageUrl: template.headerImageUrl || "",
      content: template.content,
      footer: template.footer || "",
      variables: (template.variables || []).join(", "),
    });
    setButtonFields(template.buttons || []);
    setHeaderImagePreview(resolvedPreviewUrl);
    setHeaderMediaHandle(template.headerImageUrl || template.previewUrl || null);
    setIsEditDialogOpen(true);
  };

  const handleCreate = () => {
    const previewUrl = isHttpUrl(headerImagePreview) ? headerImagePreview : null;

    createMutation.mutate({
      ...formData,
      headerType: formData.headerType === "none" ? null : formData.headerType,
      headerText: formData.headerText || null,
      headerImageUrl: headerMediaHandle, // 👈 send Meta handle
      previewUrl,
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
    const previewUrl = isHttpUrl(headerImagePreview) ? headerImagePreview : null;

    updateMutation.mutate({
      id: selectedTemplate.id,
      data: {
        ...formData,
        headerType: formData.headerType === "none" ? null : formData.headerType,
        headerText: formData.headerText || null,
        headerImageUrl: headerMediaHandle, // 👈 send Meta handle
        previewUrl,
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
      timer: 1500,
      showConfirmButton: false,
    });
  };

  // Auto-sync
  const isSyncingRef = useRef(false);
  useEffect(() => {
    const sync = async () => {
      if (isSyncingRef.current) return;
      if (deleteMutation.isPending || bulkDeleteMutation.isPending) return;
      isSyncingRef.current = true;
      try {
        await syncMetaTemplatesMutation.mutateAsync();
      } finally {
        isSyncingRef.current = false;
      }
    };
    sync();
    const interval = setInterval(sync, 30000);
    return () => clearInterval(interval);
  }, [deleteMutation.isPending, bulkDeleteMutation.isPending]);

  const allTemplatesSelected =
    templates.length > 0 &&
    templates.every((template) => selectedTemplateIds.has(template.id));
  const deletePending = deleteMutation.isPending || bulkDeleteMutation.isPending;

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <TemplateHeader
          onSync={() => syncMetaTemplatesMutation.mutate()}
          onCreate={() => {
            resetForm();
            setIsAddDialogOpen(true);
          }}
          syncPending={syncMetaTemplatesMutation.isPending}
        />

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
            {templates.length > 0 && (
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  {selectedTemplateIds.size} selected. Deletion removes linked
                  templates from Meta dashboard too.
                </p>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteSelectedTemplates}
                  disabled={
                    selectedTemplateIds.size === 0 ||
                    bulkDeleteMutation.isPending ||
                    deleteMutation.isPending
                  }
                >
                  {bulkDeleteMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  {bulkDeleteMutation.isPending
                    ? "Deleting..."
                    : `Delete Selected (${selectedTemplateIds.size})`}
                </Button>
              </div>
            )}

            <TemplateTable
              templates={templates}
              isLoading={isLoading}
              selectedTemplateIds={selectedTemplateIds}
              allSelected={allTemplatesSelected}
              deletePending={deletePending}
              deletingTemplateId={deletingTemplateId}
              onToggleSelectAll={toggleSelectAllTemplates}
              onToggleTemplateSelection={toggleTemplateSelection}
              onCopy={copyToClipboard}
              onEdit={openEditDialog}
              onDelete={handleDeleteTemplate}
              onSubmitForApproval={(id) =>
                submitForApprovalMutation.mutate(id)
              }
              submitApprovalPending={submitForApprovalMutation.isPending}
            />
          </CardContent>
        </Card>
      </div>

      <TemplateFormDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        mode="create"
        formData={formData}
        setFormData={setFormData}
        buttonFields={buttonFields}
        setButtonFields={setButtonFields}
        selectedTemplate={null}
        isPending={createMutation.isPending}
        onSubmit={handleCreate}
        onCancel={() => setIsAddDialogOpen(false)}
        headerImagePreview={headerImagePreview}
        setHeaderImagePreview={setHeaderImagePreview}
        headerMediaHandle={headerMediaHandle}
        setHeaderMediaHandle={setHeaderMediaHandle}
      />

      <TemplateFormDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        mode="edit"
        formData={formData}
        setFormData={setFormData}
        buttonFields={buttonFields}
        setButtonFields={setButtonFields}
        selectedTemplate={selectedTemplate}
        isPending={updateMutation.isPending}
        onSubmit={handleUpdate}
        onCancel={() => setIsEditDialogOpen(false)}
        headerImagePreview={headerImagePreview}
        setHeaderImagePreview={setHeaderImagePreview}
        headerMediaHandle={headerMediaHandle}
        setHeaderMediaHandle={setHeaderMediaHandle}
      />
    </DashboardLayout>
  );
}
