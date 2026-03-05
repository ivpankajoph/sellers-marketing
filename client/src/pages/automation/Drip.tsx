import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Swal from "sweetalert2";
import {
  Zap,
  FileText,
  Search,
  Filter,
  CheckCircle,
  Clock,
  AlertCircle,
  Play,
  Pause,
  Plus,
  Trash2,
  Edit2,
  Calendar,
  Users,
  Send,
  ChevronDown,
  ChevronUp,
  Copy,
  BarChart3,
  Settings,
} from "lucide-react";

// --- API Helpers ---
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const extractErrorMessage = async (
  res: Response,
  fallback: string
): Promise<string> => {
  const raw = await res.text().catch(() => "");
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw);
    return String(parsed?.error || parsed?.message || fallback);
  } catch {
    return raw;
  }
};

const fetchForms = async () => {
  const res = await fetch("/api/forms", { credentials: "include" });
  if (!res.ok) {
    throw new Error(await extractErrorMessage(res, "Failed to fetch forms"));
  }
  return res.json();
};

const fetchTemplates = async () => {
  await fetch("/api/templates/sync-meta", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  }).catch(() => null);

  const res = await fetch("/api/templates?metaOnly=true", {
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error(
      await extractErrorMessage(res, "Failed to fetch templates")
    );
  }

  const data = await res.json();
  const normalized = (Array.isArray(data) ? data : [])
    .map((tpl: any) => ({
      ...tpl,
      id: String(tpl.id || tpl._id || tpl.metaTemplateId || tpl.name),
      status: String(tpl.status || "").toLowerCase(),
    }))
    .filter((tpl: any) => tpl.status === "approved");

  return Array.from(
    new Map(normalized.map((tpl: any) => [String(tpl.name).toLowerCase(), tpl]))
      .values()
  );
};
const fetchDripCampaigns = async () =>
  (
    await fetch("/api/drip-campaigns", {
      credentials: "include",
    })
  ).json();

interface DripStep {
  id: string;
  template_id: string;
  template_name: string;
  delay_value: number;
  delay_unit: "minutes" | "hours" | "days";
  send_at_time?: string; // HH:MM format
  order: number;
}

interface DripCampaign {
  id: string;
  form_id: string;
  form_name: string;
  campaign_name: string;
  is_active: boolean;
  steps: DripStep[];
  total_leads?: number;
  active_leads?: number;
  completed_leads?: number;
  created_at: string;
  updated_at: string;
}

export default function DripCampaignManager() {
  const queryClient = useQueryClient();

  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(
    new Set()
  );
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<DripCampaign | null>(
    null
  );

  // Fetch Data
  const { data: forms = [] } = useQuery({
    queryKey: ["forms"],
    queryFn: fetchForms,
  });
  const { data: templates = [] } = useQuery({
    queryKey: ["templates"],
    queryFn: fetchTemplates,
  });
  const { data: campaigns = [] } = useQuery({
    queryKey: ["campaigns"],
    queryFn: fetchDripCampaigns,
  });

  // Mutations
  const createCampaignMutation = useMutation({
    mutationFn: async (payload: any) => {
      let res: Response | null = null;
      let lastNetworkError: unknown = null;

      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          res = await fetch("/api/drip-campaigns", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(payload),
          });
          break;
        } catch (networkError) {
          lastNetworkError = networkError;
          if (attempt < 1) {
            await sleep(300);
            continue;
          }
        }
      }

      if (!res) {
        const networkMessage =
          lastNetworkError instanceof Error
            ? lastNetworkError.message
            : "Unable to reach server";
        throw new Error(
          `${networkMessage}. Please verify backend is running and retry.`
        );
      }

      if (!res.ok) {
        throw new Error(
          await extractErrorMessage(res, "Failed to create campaign")
        );
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      setShowCreateModal(false);
      Swal.fire({
        icon: "success",
        title: "Campaign Created!",
        text: "Your drip campaign has been created successfully.",
        timer: 2000,
        showConfirmButton: false,
      });
    },
    onError: (error: any) => {
      Swal.fire({
        icon: "error",
        title: "Creation Failed",
        text: error.message || "An error occurred while creating the campaign.",
      });
    },
  });

  const toggleCampaignMutation = useMutation({
    mutationFn: async ({
      campaignId,
      isActive,
    }: {
      campaignId: string;
      isActive: boolean;
    }) => {
      const res = await fetch(`/api/drip-campaigns/${campaignId}/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ is_active: isActive }),
      });
      if (!res.ok) {
        throw new Error(
          await extractErrorMessage(res, "Failed to update campaign status")
        );
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    },
    onError: (error: any) => {
      Swal.fire({
        icon: "error",
        title: "Update Failed",
        text: error.message || "Could not toggle campaign status.",
      });
    },
  });

  const deleteCampaignMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      const res = await fetch(`/api/drip-campaigns/${campaignId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(
          await extractErrorMessage(res, "Failed to delete campaign")
        );
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      Swal.fire({
        icon: "success",
        title: "Deleted!",
        text: "Campaign has been deleted.",
        timer: 1500,
        showConfirmButton: false,
      });
    },
    onError: (error: any) => {
      Swal.fire({
        icon: "error",
        title: "Deletion Failed",
        text: error.message || "Could not delete the campaign.",
      });
    },
  });

  // Toggle campaign expansion
  const toggleExpand = (campaignId: string) => {
    const newExpanded = new Set(expandedCampaigns);
    if (newExpanded.has(campaignId)) {
      newExpanded.delete(campaignId);
    } else {
      newExpanded.add(campaignId);
    }
    setExpandedCampaigns(newExpanded);
  };

  // Filtered campaigns
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((campaign: DripCampaign) => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        campaign.campaign_name?.toLowerCase().includes(searchLower) ||
        campaign.form_name?.toLowerCase().includes(searchLower);

      const matchesStatus =
        filterStatus === "all" ||
        (filterStatus === "active" && campaign.is_active) ||
        (filterStatus === "inactive" && !campaign.is_active);

      return matchesSearch && matchesStatus;
    });
  }, [campaigns, searchQuery, filterStatus]);

  // Stats
  const totalCampaigns = campaigns.length;
  const activeCampaigns = campaigns.filter(
    (c: DripCampaign) => c.is_active
  ).length;
  const totalSteps = campaigns.reduce(
    (sum: number, c: DripCampaign) => sum + (c.steps?.length || 0),
    0
  );
  const totalLeads = campaigns.reduce(
    (sum: number, c: DripCampaign) => sum + (c.active_leads || 0),
    0
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
                <Zap className="text-blue-600" size={40} />
                Drip Campaign Manager
              </h1>
              <p className="text-gray-600">
                Create automated message sequences for your leads
              </p>
            </div>

            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-all shadow-lg"
            >
              <Plus size={20} />
              Create Campaign
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-md p-4 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Total Campaigns</p>
                <p className="text-2xl font-bold text-gray-900">
                  {totalCampaigns}
                </p>
              </div>
              <BarChart3 className="text-blue-500" size={28} />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-4 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Active</p>
                <p className="text-2xl font-bold text-gray-900">
                  {activeCampaigns}
                </p>
              </div>
              <Play className="text-green-500" size={28} />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-4 border-l-4 border-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Total Steps</p>
                <p className="text-2xl font-bold text-gray-900">{totalSteps}</p>
              </div>
              <Send className="text-purple-500" size={28} />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-4 border-l-4 border-amber-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Active Leads</p>
                <p className="text-2xl font-bold text-gray-900">{totalLeads}</p>
              </div>
              <Users className="text-amber-500" size={28} />
            </div>
          </div>
        </div>

        {/* Search and Filter Bar */}
        {campaigns.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-4 mb-6 border border-gray-100">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                  size={20}
                />
                <input
                  type="text"
                  placeholder="Search campaigns..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                />
              </div>

              <div className="flex gap-2">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Campaigns List */}
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Zap className="text-indigo-600" size={24} />
            Drip Campaigns
            {filteredCampaigns.length > 0 && (
              <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-sm font-medium ml-2">
                {filteredCampaigns.length}
              </span>
            )}
          </h2>

          {filteredCampaigns.length === 0 ? (
            <div className="text-center py-16">
              <Zap className="mx-auto text-gray-300 mb-4" size={64} />
              <p className="text-gray-600 text-lg mb-4">
                {campaigns.length === 0
                  ? "No campaigns created yet"
                  : "No campaigns match your filters"}
              </p>
              {campaigns.length === 0 && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  Create your first campaign
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
              {filteredCampaigns.map((campaign: DripCampaign) => (
                <CampaignCard
                  key={campaign.id}
                  campaign={campaign}
                  isExpanded={expandedCampaigns.has(campaign.id)}
                  onToggleExpand={() => toggleExpand(campaign.id)}
                  onToggleActive={(isActive: any) =>
                    toggleCampaignMutation.mutate({
                      campaignId: campaign.id,
                      isActive,
                    })
                  }
                  onEdit={() => setEditingCampaign(campaign)}
                  onDelete={async () => {
                    const result = await Swal.fire({
                      title: "Are you sure?",
                      text: "You won't be able to revert this!",
                      icon: "warning",
                      showCancelButton: true,
                      confirmButtonColor: "#d33",
                      cancelButtonColor: "#3085d6",
                      confirmButtonText: "Yes, delete it!",
                    });
                    if (result.isConfirmed) {
                      deleteCampaignMutation.mutate(campaign.id);
                    }
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Create/Edit Campaign Modal */}
        {(showCreateModal || editingCampaign) && (
          <CampaignModal
            campaign={editingCampaign}
            forms={forms}
            templates={templates}
            onClose={() => {
              setShowCreateModal(false);
              setEditingCampaign(null);
            }}
            onSave={(data: any) => createCampaignMutation.mutate(data)}
          />
        )}
      </div>
    </div>
  );
}

// Campaign Card Component
function CampaignCard({
  campaign,
  isExpanded,
  onToggleExpand,
  onToggleActive,
  onEdit,
  onDelete,
}: any) {
  return (
    <div className="bg-gradient-to-r from-gray-50 to-white rounded-lg border border-gray-200 p-5 hover:shadow-md transition-shadow duration-200">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Campaign Info */}
        <div className="flex-1">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Zap className="text-blue-600" size={20} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                {campaign.campaign_name}
              </h3>
              <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <FileText size={14} />
                  {campaign.form_name}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Send size={14} />
                  {campaign.steps?.length || 0} steps
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Users size={14} />
                  {campaign.active_leads || 0} active leads
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleExpand}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="View Details"
          >
            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>

          <button
            onClick={onEdit}
            className="p-2 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors"
            title="Edit Campaign"
          >
            <Edit2 size={18} />
          </button>

          <button
            onClick={onDelete}
            className="p-2 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
            title="Delete Campaign"
          >
            <Trash2 size={18} />
          </button>

          <button
            onClick={() => onToggleActive(!campaign.is_active)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              campaign.is_active
                ? "bg-red-500 hover:bg-red-600 text-white"
                : "bg-green-500 hover:bg-green-600 text-white"
            }`}
          >
            {campaign.is_active ? (
              <>
                <Pause size={16} />
                Stop
              </>
            ) : (
              <>
                <Play size={16} />
                Start
              </>
            )}
          </button>

          <span
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium ${
              campaign.is_active
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {campaign.is_active ? (
              <>
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                Active
              </>
            ) : (
              <>
                <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                Inactive
              </>
            )}
          </span>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <Clock size={16} />
            Campaign Steps
          </h4>
          <div className="space-y-3">
            {campaign.steps?.map((step: DripStep, index: number) => (
              <div
                key={step.id}
                className="flex items-center gap-3 bg-white p-3 rounded-lg border border-gray-200"
              >
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">
                    {step.template_name}
                  </p>
                  <p className="text-sm text-gray-500">
                    {index === 0
                      ? "Immediately"
                      : `After ${step.delay_value} ${step.delay_unit}`}
                    {step.send_at_time && ` at ${step.send_at_time}`}
                  </p>
                </div>
                <Send className="text-gray-400" size={16} />
              </div>
            ))}
          </div>

          {/* Campaign Stats */}
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-xs text-gray-600 mb-1">Total Leads</p>
              <p className="text-xl font-bold text-blue-600">
                {campaign.total_leads || 0}
              </p>
            </div>
            <div className="bg-green-50 p-3 rounded-lg">
              <p className="text-xs text-gray-600 mb-1">In Progress</p>
              <p className="text-xl font-bold text-green-600">
                {campaign.active_leads || 0}
              </p>
            </div>
            <div className="bg-purple-50 p-3 rounded-lg">
              <p className="text-xs text-gray-600 mb-1">Completed</p>
              <p className="text-xl font-bold text-purple-600">
                {campaign.completed_leads || 0}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Campaign Modal Component
function CampaignModal({ campaign, forms, templates, onClose, onSave }: any) {
  const [formData, setFormData] = useState({
    campaign_name: campaign?.campaign_name || "",
    form_id: campaign?.form_id || "",
    steps: campaign?.steps || [],
  });

  const addStep = () => {
    setFormData({
      ...formData,
      steps: [
        ...formData.steps,
        {
          id: Date.now().toString(),
          template_id: "",
          template_name: "",
          delay_value: 1,
          delay_unit: "days",
          order: formData.steps.length,
        },
      ],
    });
  };

  const removeStep = (index: number) => {
    setFormData({
      ...formData,
      steps: formData.steps.filter((_: any, i: number) => i !== index),
    });
  };

  const updateStep = (index: number, field: string, value: any) => {
    const newSteps = [...formData.steps];
    newSteps[index] = { ...newSteps[index], [field]: value };

    if (field === "template_id") {
      const template = templates.find((t: any) => t.id === value);
      newSteps[index].template_name = template?.name || "";
    }

    setFormData({ ...formData, steps: newSteps });
  };

  const handleSave = () => {
    const isValid =
      formData.campaign_name.trim() !== "" &&
      formData.form_id !== "" &&
      formData.steps.length > 0 &&
      formData.steps.every(
        (s: { template_id: string }) => s.template_id !== ""
      );

    if (!isValid) {
      Swal.fire({
        icon: "warning",
        title: "Validation Error",
        text: "Please fill in all required fields: campaign name, form, and at least one valid step with a template.",
      });
      return;
    }

    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            {campaign ? "Edit Campaign" : "Create New Campaign"}
          </h2>
        </div>

        <div className="p-6 space-y-6">
          {/* Campaign Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Campaign Name *
            </label>
            <input
              type="text"
              value={formData.campaign_name}
              onChange={(e) =>
                setFormData({ ...formData, campaign_name: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="e.g., Welcome Series"
            />
          </div>

          {/* Form Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Form *
            </label>
            <select
              value={formData.form_id}
              onChange={(e) =>
                setFormData({ ...formData, form_id: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
            >
              <option value="">Select a form...</option>
              {forms.map((form: any) => (
                <option key={form.id} value={form.id}>
                  {form.name}
                </option>
              ))}
            </select>
          </div>

          {/* Steps */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">
                Campaign Steps *
              </label>
              <button
                onClick={addStep}
                className="flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                <Plus size={16} />
                Add Step
              </button>
            </div>

            <div className="space-y-4">
              {formData.steps.map((step: any, index: number) => (
                <div
                  key={step.id}
                  className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium text-gray-900">
                      Step {index + 1}
                    </span>
                    <button
                      onClick={() => removeStep(index)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Template *
                      </label>
                      <select
                        value={step.template_id}
                        onChange={(e) =>
                          updateStep(index, "template_id", e.target.value)
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                      >
                        <option value="">Select template...</option>
                        {templates.map((t: any) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {index > 0 && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Delay
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={step.delay_value}
                            onChange={(e) =>
                              updateStep(
                                index,
                                "delay_value",
                                parseInt(e.target.value) || 0
                              )
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Unit
                          </label>
                          <select
                            value={step.delay_unit}
                            onChange={(e) =>
                              updateStep(index, "delay_unit", e.target.value)
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                          >
                            <option value="minutes">Minutes</option>
                            <option value="hours">Hours</option>
                            <option value="days">Days</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {index > 0 && (
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Send at specific time (optional)
                        </label>
                        <input
                          type="time"
                          value={step.send_at_time || ""}
                          onChange={(e) =>
                            updateStep(index, "send_at_time", e.target.value)
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Save Campaign
          </button>
        </div>
      </div>
    </div>
  );
}
