import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Play,
  Pause,
  Zap,
  FileText,
  Search,
  Filter,
  CheckCircle,
  Clock,
  AlertCircle,
  Download,
  Loader,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";

// --- API Helpers ---
const fetchForms = async () => (await fetch("/api/forms")).json();
const fetchTemplates = async () => (await fetch("/api/templates")).json();
const fetchStatus = async () => (await fetch("/api/status")).json();

export default function LeadManager() {
  const queryClient = useQueryClient();

  // State
  const [isRunning, setIsRunning] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterTemplate, setFilterTemplate] = useState("all");

  // Fetch Data
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

  // Mutations
  const triggerMutation = useMutation({
    mutationFn: async (payload: {
      form_id: any;
      form_name: any;
      template_id: any;
      template_name: any;
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

  // Handlers
  const handleTemplateChange = (
    form: { id: any; name: any },
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

  // Filtered forms
  const filteredForms = useMemo(() => {
    return forms.filter((form: any) => {
      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        form.name?.toLowerCase().includes(searchLower) ||
        form.id?.toLowerCase().includes(searchLower);

      // Status filter
      const matchesStatus =
        filterStatus === "all" || form.status === filterStatus;

      // Template filter
      const hasTemplate = !!form.assigned_template;
      const matchesTemplate =
        filterTemplate === "all" ||
        (filterTemplate === "assigned" && hasTemplate) ||
        (filterTemplate === "unassigned" && !hasTemplate);

      return matchesSearch && matchesStatus && matchesTemplate;
    });
  }, [forms, searchQuery, filterStatus, filterTemplate]);

  // Stats
  const totalForms = forms.length;
  const activeForms = forms.filter((f: any) => f.status === "ACTIVE").length;
  const formsWithTemplate = forms.filter(
    (f: any) => f.assigned_template
  ).length;
  const runningAutomations = forms.filter(
    (f: any) => f.automation_active
  ).length;
  const filteredCount = filteredForms.length;

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="max-w-7xl mx-auto p-6">
          {/* Header */}
          <div className="mb-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
                  <Zap className="text-blue-600" size={40} />
                  Facebook Lead Automation
                </h1>
                <p className="text-gray-600">
                  Manage your lead forms and automation templates
                </p>
              </div>

              {/* System Control */}
              <div className="flex items-center gap-4 bg-white rounded-xl shadow-lg p-4 border border-gray-100">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      isRunning ? "bg-green-500 animate-pulse" : "bg-red-500"
                    }`}
                  ></div>
                  <span
                    className={`font-semibold ${
                      isRunning ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {isRunning ? "RUNNING" : "STOPPED"}
                  </span>
                </div>
                {isRunning && (
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    <Clock size={14} />
                    <span>Every 10 </span>
                  </div>
                )}
                <button
                  onClick={toggleSystem}
                  className={`px-4 py-2 rounded-lg text-white font-medium transition-all flex items-center gap-2 ${
                    isRunning
                      ? "bg-red-500 hover:bg-red-600"
                      : "bg-green-500 hover:bg-green-600"
                  }`}
                >
                  {isRunning ? (
                    <>
                      <Pause size={18} />
                      Stop Sync
                    </>
                  ) : (
                    <>
                      <Play size={18} />
                      Start Sync
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-md p-4 border-l-4 border-blue-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Total Forms</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {filteredCount}
                  </p>
                  {filteredCount !== totalForms && (
                    <p className="text-xs text-gray-500">of {totalForms}</p>
                  )}
                </div>
                <FileText className="text-blue-500" size={28} />
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-md p-4 border-l-4 border-green-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Active Forms</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {activeForms}
                  </p>
                </div>
                <CheckCircle className="text-green-500" size={28} />
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-md p-4 border-l-4 border-purple-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Templates</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {templates.length}
                  </p>
                </div>
                <Zap className="text-purple-500" size={28} />
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-md p-4 border-l-4 border-amber-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Running</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {runningAutomations}
                  </p>
                </div>
                <Play className="text-amber-500" size={28} />
              </div>
            </div>
          </div>

          {/* Search and Filter Bar */}
          {forms.length > 0 && (
            <div className="bg-white rounded-xl shadow-lg p-4 mb-6 border border-gray-100">
              <div className="grid md:grid-cols-2 gap-4">
                {/* Search Bar */}
                <div className="relative">
                  <Search
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                    size={20}
                  />
                  <input
                    type="text"
                    placeholder="Search by form name or ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  />
                </div>

                {/* Filter Controls */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Filter
                      className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                      size={18}
                    />
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
                    >
                      <option value="all">All Status</option>
                      <option value="ACTIVE">Active</option>
                      <option value="PAUSED">Paused</option>
                      <option value="ARCHIVED">Archived</option>
                    </select>
                  </div>

                  <div className="relative flex-1">
                    <select
                      value={filterTemplate}
                      onChange={(e) => setFilterTemplate(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
                    >
                      <option value="all">All Templates</option>
                      <option value="assigned">With Template</option>
                      <option value="unassigned">Without Template</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Active Filters Display */}
              {(searchQuery ||
                filterStatus !== "all" ||
                filterTemplate !== "all") && (
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <span className="text-sm text-gray-600">Active filters:</span>
                  {searchQuery && (
                    <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm flex items-center gap-1">
                      Search: "{searchQuery}"
                      <button
                        onClick={() => setSearchQuery("")}
                        className="ml-1 hover:text-blue-900"
                      >
                        ×
                      </button>
                    </span>
                  )}
                  {filterStatus !== "all" && (
                    <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm flex items-center gap-1">
                      Status: {filterStatus}
                      <button
                        onClick={() => setFilterStatus("all")}
                        className="ml-1 hover:text-purple-900"
                      >
                        ×
                      </button>
                    </span>
                  )}
                  {filterTemplate !== "all" && (
                    <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm flex items-center gap-1">
                      Template:{" "}
                      {filterTemplate === "assigned" ? "With" : "Without"}
                      <button
                        onClick={() => setFilterTemplate("all")}
                        className="ml-1 hover:text-green-900"
                      >
                        ×
                      </button>
                    </span>
                  )}
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setFilterStatus("all");
                      setFilterTemplate("all");
                    }}
                    className="text-sm text-red-600 hover:text-red-800 underline"
                  >
                    Clear all
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Forms List */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="text-indigo-600" size={24} />
              Lead Forms
              {filteredForms.length > 0 && (
                <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-sm font-medium ml-2">
                  {filteredForms.length}
                </span>
              )}
            </h2>

            {filteredForms.length === 0 && forms.length > 0 ? (
              <div className="text-center py-16">
                <Filter className="mx-auto text-gray-300 mb-4" size={64} />
                <p className="text-gray-600 text-lg mb-2">
                  No forms match your filters
                </p>
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setFilterStatus("all");
                    setFilterTemplate("all");
                  }}
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  Clear all filters
                </button>
              </div>
            ) : filteredForms.length === 0 ? (
              <div className="text-center py-16">
                <AlertCircle className="mx-auto text-gray-300 mb-4" size={64} />
                <p className="text-gray-600 text-lg">No forms found</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[700px] overflow-y-auto pr-2">
                {filteredForms.map((form: any) => (
                  <div
                    key={form.id}
                    className="bg-gradient-to-r from-gray-50 to-white rounded-lg border border-gray-200 p-5 hover:shadow-md transition-shadow duration-200"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                      {/* Form Info */}
                      <div className="flex-1">
                        <div className="flex items-start gap-3 mb-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <FileText className="text-blue-600" size={20} />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-gray-900 mb-1">
                              {form.name || "Unnamed Form"}
                            </h3>
                            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
                              <span className="font-mono">ID: {form.id}</span>
                              <span>•</span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                  form.status === "ACTIVE"
                                    ? "bg-green-100 text-green-700"
                                    : form.status === "PAUSED"
                                    ? "bg-yellow-100 text-yellow-700"
                                    : "bg-gray-100 text-gray-600"
                                }`}
                              >
                                {form.status || "Unknown"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Template Assignment & Controls */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Zap className="text-purple-600" size={18} />
                          <label className="text-sm font-medium text-gray-700">
                            Template:
                          </label>
                        </div>
                        <select
                          className="border border-gray-300 px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white min-w-[200px]"
                          value={form.assigned_template || ""}
                          onChange={(e) =>
                            handleTemplateChange(form, e.target.value)
                          }
                        >
                          <option value="" disabled>
                            Select a Template
                          </option>
                          {templates.map((t: { id: string; name: string }) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>

                        {form.assigned_template && (
                          <>
                            {/* Automation Toggle Button */}
                            <button
                              onClick={() =>
                                toggleFormAutomation(
                                  form.id,
                                  form.automation_active
                                )
                              }
                              disabled={toggleFormMutation.isPending}
                              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                                form.automation_active
                                  ? "bg-red-500 hover:bg-red-600 text-white"
                                  : "bg-green-500 hover:bg-green-600 text-white"
                              }`}
                            >
                              {toggleFormMutation.isPending ? (
                                <>
                                  <Loader className="animate-spin" size={16} />
                                  Processing...
                                </>
                              ) : form.automation_active ? (
                                <>
                                  <Pause size={16} />
                                  Stop Automation
                                </>
                              ) : (
                                <>
                                  <Play size={16} />
                                  Run Automation
                                </>
                              )}
                            </button>

                            {/* Status Badge */}
                            <span
                              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium ${
                                form.automation_active
                                  ? "bg-green-100 text-green-700"
                                  : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {form.automation_active ? (
                                <>
                                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                  Running
                                </>
                              ) : (
                                <>
                                  <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                                  Stopped
                                </>
                              )}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Template Info if assigned */}
                    {form.assigned_template && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="flex items-start gap-2 mb-2">
                          <div
                            className={`mt-0.5 ${
                              form.automation_active
                                ? "text-green-600"
                                : "text-gray-400"
                            }`}
                          >
                            {form.automation_active ? (
                              <CheckCircle size={16} />
                            ) : (
                              <AlertCircle size={16} />
                            )}
                          </div>
                          <p className="text-xs text-gray-600">
                            {form.automation_active
                              ? "Automation is running - Fetching new leads every 10 minutes and sending template messages automatically"
                              : 'Automation is stopped - Click "Run Automation" to start fetching leads and sending messages'}
                          </p>
                        </div>
                        {form.automation_active && form.last_sync && (
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Clock size={12} />
                            <span>
                              Last synced:{" "}
                              {new Date(form.last_sync).toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
