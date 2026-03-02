import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  FileText,
  Filter,
  Loader,
  Pause,
  Play,
  Search,
  Zap,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";

const fetchForms = async () => (await fetch("/api/forms")).json();
const fetchTemplates = async () => (await fetch("/api/templates")).json();
const fetchStatus = async () => (await fetch("/api/status")).json();

export default function LeadManager() {
  const queryClient = useQueryClient();

  const [isRunning, setIsRunning] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterTemplate, setFilterTemplate] = useState("all");

  const { data: forms = [] } = useQuery({
    queryKey: ["forms"],
    queryFn: fetchForms,
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["templates"],
    queryFn: fetchTemplates,
  });

  const { data: statusData } = useQuery({
    queryKey: ["status"],
    queryFn: fetchStatus,
  });

  useEffect(() => {
    if (statusData) setIsRunning(statusData.is_running);
  }, [statusData]);

  const triggerMutation = useMutation({
    mutationFn: async (payload: {
      form_id: string;
      form_name: string;
      template_id: string;
      template_name: string;
    }) => {
      return fetch("/api/set-trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      alert("Template mapped successfully! Scanning for new leads...");
      queryClient.invalidateQueries({ queryKey: ["forms"] });
    },
  });

  const controlMutation = useMutation({
    mutationFn: async (shouldRun: boolean) => {
      return fetch("/api/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ run: shouldRun }),
      });
    },
  });

  const toggleFormMutation = useMutation({
    mutationFn: async ({
      formId,
      isActive,
    }: {
      formId: string;
      isActive: boolean;
    }) => {
      return fetch("/api/toggle-form-automation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form_id: formId, is_active: isActive }),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["forms"] });
      if (variables.isActive) {
        alert(
          "Automation started! Fetching leads and will sync every 10 minutes."
        );
      } else {
        alert("Automation stopped for this form.");
      }
    },
    onError: (error) => {
      alert(`Failed to toggle automation: ${error}`);
    },
  });

  const handleTemplateChange = (
    form: { id: string; name: string },
    templateId: string
  ) => {
    const template = templates.find((t: { id: string }) => t.id === templateId);
    if (!template) return;

    triggerMutation.mutate({
      form_id: form.id,
      form_name: form.name,
      template_id: template.id,
      template_name: template.name,
    });
  };

  const toggleSystem = () => {
    const newState = !isRunning;
    setIsRunning(newState);
    controlMutation.mutate(newState);
  };

  const toggleFormAutomation = (formId: string, currentState: boolean) => {
    toggleFormMutation.mutate({ formId, isActive: !currentState });
  };

  const filteredForms = useMemo(() => {
    return forms.filter((form: any) => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        form.name?.toLowerCase().includes(searchLower) ||
        form.id?.toLowerCase().includes(searchLower);

      const matchesStatus =
        filterStatus === "all" || form.status === filterStatus;

      const hasTemplate = !!form.assigned_template;
      const matchesTemplate =
        filterTemplate === "all" ||
        (filterTemplate === "assigned" && hasTemplate) ||
        (filterTemplate === "unassigned" && !hasTemplate);

      return matchesSearch && matchesStatus && matchesTemplate;
    });
  }, [forms, searchQuery, filterStatus, filterTemplate]);

  const totalForms = forms.length;
  const activeForms = forms.filter((f: any) => f.status === "ACTIVE").length;
  const formsWithTemplate = forms.filter((f: any) => f.assigned_template).length;
  const runningAutomations = forms.filter((f: any) => f.automation_active).length;
  const filteredCount = filteredForms.length;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 via-indigo-50 to-violet-50 p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="flex items-center gap-3 text-3xl font-bold text-slate-900">
                <Zap className="text-indigo-600" size={34} />
                Facebook Lead Automation
              </h1>
              <p className="mt-1 text-slate-600">
                Manage lead form mapping and automation actions from one place.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/80 bg-white/90 px-4 py-3 shadow-sm">
              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${
                  isRunning
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-rose-100 text-rose-700"
                }`}
              >
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    isRunning ? "animate-pulse bg-emerald-500" : "bg-rose-500"
                  }`}
                />
                {isRunning ? "Automation Running" : "Automation Stopped"}
              </span>

              <button
                onClick={toggleSystem}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors ${
                  isRunning
                    ? "bg-rose-500 hover:bg-rose-600"
                    : "bg-emerald-500 hover:bg-emerald-600"
                }`}
              >
                {isRunning ? (
                  <>
                    <Pause size={16} />
                    Stop Sync
                  </>
                ) : (
                  <>
                    <Play size={16} />
                    Start Sync
                  </>
                )}
              </button>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <div className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Visible Forms</p>
                <p className="text-2xl font-bold text-slate-900">{filteredCount}</p>
                {filteredCount !== totalForms && (
                  <p className="text-xs text-slate-400">of {totalForms} total</p>
                )}
              </div>
              <FileText className="text-blue-500" size={24} />
            </div>
          </div>

          <div className="rounded-xl border border-emerald-100 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Active Forms</p>
                <p className="text-2xl font-bold text-slate-900">{activeForms}</p>
              </div>
              <CheckCircle className="text-emerald-500" size={24} />
            </div>
          </div>

          <div className="rounded-xl border border-violet-100 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Mapped Forms</p>
                <p className="text-2xl font-bold text-slate-900">
                  {formsWithTemplate}
                </p>
              </div>
              <Zap className="text-violet-500" size={24} />
            </div>
          </div>

          <div className="rounded-xl border border-amber-100 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Running</p>
                <p className="text-2xl font-bold text-slate-900">
                  {runningAutomations}
                </p>
              </div>
              <Play className="text-amber-500" size={24} />
            </div>
          </div>
        </section>

        {forms.length > 0 && (
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid gap-3 lg:grid-cols-12">
              <div className="relative lg:col-span-6">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={18}
                />
                <input
                  type="text"
                  placeholder="Search by form name or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-4 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="relative lg:col-span-3">
                <Filter
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={16}
                />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="all">All Status</option>
                  <option value="ACTIVE">Active</option>
                  <option value="PAUSED">Paused</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </div>

              <div className="lg:col-span-3">
                <select
                  value={filterTemplate}
                  onChange={(e) => setFilterTemplate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="all">All Templates</option>
                  <option value="assigned">With Template</option>
                  <option value="unassigned">Without Template</option>
                </select>
              </div>
            </div>

            {(searchQuery || filterStatus !== "all" || filterTemplate !== "all") && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-sm text-slate-500">Active filters:</span>
                {searchQuery && (
                  <span className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                    Search: "{searchQuery}"
                    <button
                      onClick={() => setSearchQuery("")}
                      className="text-blue-800 hover:text-blue-950"
                    >
                      x
                    </button>
                  </span>
                )}
                {filterStatus !== "all" && (
                  <span className="inline-flex items-center gap-2 rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700">
                    Status: {filterStatus}
                    <button
                      onClick={() => setFilterStatus("all")}
                      className="text-violet-800 hover:text-violet-950"
                    >
                      x
                    </button>
                  </span>
                )}
                {filterTemplate !== "all" && (
                  <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                    Template: {filterTemplate === "assigned" ? "With" : "Without"}
                    <button
                      onClick={() => setFilterTemplate("all")}
                      className="text-emerald-800 hover:text-emerald-950"
                    >
                      x
                    </button>
                  </span>
                )}
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setFilterStatus("all");
                    setFilterTemplate("all");
                  }}
                  className="text-xs font-medium text-rose-600 hover:text-rose-700"
                >
                  Clear all
                </button>
              </div>
            )}
          </section>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="mb-5 flex items-center gap-2 text-xl font-semibold text-slate-900">
            <FileText className="text-indigo-600" size={22} />
            Lead Forms
            {filteredForms.length > 0 && (
              <span className="ml-1 rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-medium text-indigo-700">
                {filteredForms.length}
              </span>
            )}
          </h2>

          {filteredForms.length === 0 && forms.length > 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 py-16 text-center">
              <Filter className="mx-auto mb-3 text-slate-300" size={52} />
              <p className="text-lg text-slate-600">No forms match your filters</p>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setFilterStatus("all");
                  setFilterTemplate("all");
                }}
                className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-800"
              >
                Clear all filters
              </button>
            </div>
          ) : filteredForms.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 py-16 text-center">
              <AlertCircle className="mx-auto mb-3 text-slate-300" size={52} />
              <p className="text-lg text-slate-600">No forms found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredForms.map((form: any) => (
                <article
                  key={form.id}
                  className="rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-white p-4 shadow-sm sm:p-5"
                >
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,430px)]">
                    <div className="min-w-0 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100">
                          <FileText className="text-blue-600" size={18} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="break-words text-lg font-semibold text-slate-900">
                            {form.name || "Unnamed Form"}
                          </h3>
                          <p className="mt-1 break-all font-mono text-xs text-slate-500">
                            ID: {form.id}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            form.status === "ACTIVE"
                              ? "bg-emerald-100 text-emerald-700"
                              : form.status === "PAUSED"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {form.status || "Unknown"}
                        </span>

                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            form.assigned_template
                              ? "bg-violet-100 text-violet-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {form.assigned_template ? "Template Mapped" : "No Template"}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 sm:p-4">
                      <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                        <Zap className="text-violet-600" size={16} />
                        Template Assignment
                      </label>

                      <select
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                        value={form.assigned_template || ""}
                        onChange={(e) => handleTemplateChange(form, e.target.value)}
                        disabled={form.automation_active}
                      >
                        <option value="" disabled>
                          {form.automation_active
                            ? "Stop automation to change template"
                            : "Select a template"}
                        </option>
                        {templates.map((t: { id: string; name: string }) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>

                      {form.assigned_template && (
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() =>
                              toggleFormAutomation(form.id, form.automation_active)
                            }
                            disabled={toggleFormMutation.isPending}
                            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                              form.automation_active
                                ? "bg-rose-500 hover:bg-rose-600"
                                : "bg-emerald-500 hover:bg-emerald-600"
                            }`}
                          >
                            {toggleFormMutation.isPending ? (
                              <>
                                <Loader className="animate-spin" size={14} />
                                Processing...
                              </>
                            ) : form.automation_active ? (
                              <>
                                <Pause size={14} />
                                Stop Automation
                              </>
                            ) : (
                              <>
                                <Play size={14} />
                                Run Automation
                              </>
                            )}
                          </button>

                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                              form.automation_active
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-slate-200 text-slate-600"
                            }`}
                          >
                            <span
                              className={`h-2 w-2 rounded-full ${
                                form.automation_active
                                  ? "animate-pulse bg-emerald-500"
                                  : "bg-slate-400"
                              }`}
                            />
                            {form.automation_active ? "Running" : "Stopped"}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {form.assigned_template && (
                    <div className="mt-4 border-t border-slate-200 pt-3">
                      <div className="mb-2 flex items-start gap-2">
                        <div
                          className={`mt-0.5 ${
                            form.automation_active
                              ? "text-emerald-600"
                              : "text-slate-400"
                          }`}
                        >
                          {form.automation_active ? (
                            <CheckCircle size={15} />
                          ) : (
                            <AlertCircle size={15} />
                          )}
                        </div>
                        <p className="text-xs text-slate-600">
                          {form.automation_active
                            ? "Automation is active: new leads are fetched every 10 minutes and template messages are sent automatically."
                            : 'Automation is currently stopped. Click "Run Automation" to resume lead sync and message delivery.'}
                        </p>
                      </div>

                      {form.automation_active && form.last_sync && (
                        <p className="inline-flex items-center gap-1 text-xs text-slate-500">
                          <Clock size={12} />
                          Last synced: {new Date(form.last_sync).toLocaleString()}
                        </p>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}
