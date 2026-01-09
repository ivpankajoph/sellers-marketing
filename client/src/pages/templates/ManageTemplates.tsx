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
import Swal from "sweetalert2";

import TemplateHeader from "./TemplateHeader";
import TemplateTable from "./TemplateTable";
import TemplateFormDialog from "./TemplateFormDialog";
import { ButtonDef, Template } from "./type";

export default function ManageTemplates() {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
    null
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
      const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      Swal.fire({
        icon: "success",
        title: "Deleted!",
        timer: 2000,
        showConfirmButton: false,
      });
    },
    onError: () => {
      Swal.fire({ icon: "error", title: "Delete Failed" });
    },
  });

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
    setHeaderImagePreview(template.headerImageUrl || null);
    setHeaderMediaHandle(template.headerImageUrl || null); // assuming it's the handle or preview URL
    setIsEditDialogOpen(true);
  };

  const handleCreate = () => {
    createMutation.mutate({
      ...formData,
      headerType: formData.headerType === "none" ? null : formData.headerType,
      headerText: formData.headerText || null,
      headerImageUrl: headerMediaHandle, // 👈 send Meta handle
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
        headerType: formData.headerType === "none" ? null : formData.headerType,
        headerText: formData.headerText || null,
        headerImageUrl: headerMediaHandle, // 👈 send Meta handle
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
      isSyncingRef.current = true;
      try {
        await syncMetaTemplatesMutation.mutateAsync();
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
            <TemplateTable
              templates={templates}
              isLoading={isLoading}
              onCopy={copyToClipboard}
              onEdit={openEditDialog}
              onDelete={(id) => deleteMutation.mutate(id)}
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