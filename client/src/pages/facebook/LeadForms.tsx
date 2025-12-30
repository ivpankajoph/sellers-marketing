import React, { useState, useEffect, useMemo } from "react";
import {
  Users,
  Mail,
  Phone,
  Calendar,
  Tag,
  CheckCircle,
  FileText,
  RefreshCw,
  Search,
  Filter,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";

// --- Types ---
interface LeadField {
  name: string;
  values: string[];
}

interface Lead {
  id: string;
  created_time: string;
  field_data: LeadField[];
}

interface LeadgenForm {
  id: string;
  name?: string;
  status?: string;
}

interface NormalizedLead {
  id: string;
  created_time: string;
  FULL_NAME?: string;
  EMAIL?: string;
  PHONE?: string;
  DOB?: string;
  CATEGORY?: string;
  OPT_IN?: string;
  [key: string]: string | undefined;
}

const PAGE_ID = import.meta.env.VITE_FB_PAGE_ID || "118584934681142";
const ACCESS_TOKEN =
  // import.meta.env.VITE_SYSTEM_USER_TOKEN_META ||
  "EAAO1YPeIbdABQKM6Nr3v5WZCKPxFNvu9d76NziriPSnzNwZBzMEhG8229w9XY3Xdt5DKqfqYnThZAaL72GzL1bb4K0ZCKO05wRSjNW1zu1fx49Igthy1n43BZA5KvrbZAaHd5UZAV2FkYEPx2Gb94aaUkt73q7TaFfYXR4ouf9MxpoppMttBCGu83jvOZAMTFbT9iSQZD";

const FacebookLeadsManager: React.FC = () => {
  const [forms, setForms] = useState<LeadgenForm[]>([]);
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [leads, setLeads] = useState<NormalizedLead[]>([]);
  const [loadingForms, setLoadingForms] = useState(true);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterOptIn, setFilterOptIn] = useState("all");

  // --- Fetch all leads with auto-pagination ---
  const fetchAllLeads = async (formId: string): Promise<Lead[]> => {
    let allLeads: Lead[] = [];
    let url:
      | string
      | null = `https://graph.facebook.com/v18.0/${formId}/leads?access_token=${ACCESS_TOKEN}&limit=100`;

    while (url) {
      const res: any = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch leads: ${res.statusText}`);
      }
      const data = await res.json();
      allLeads = allLeads.concat(data.data || []);

      url = data.paging?.cursors?.after
        ? `https://graph.facebook.com/v18.0/${formId}/leads?access_token=${ACCESS_TOKEN}&limit=100&after=${data.paging.cursors.after}`
        : null;
    }

    return allLeads;
  };

  // --- Normalize lead field_data into flat object ---
  const normalizeLead = (lead: Lead): NormalizedLead => {
    const normalized: NormalizedLead = {
      id: lead.id,
      created_time: lead.created_time,
    };

    lead.field_data.forEach((field) => {
      const key = field.name;
      const value = field.values?.[0] || "";
      if (key === "0") {
        normalized.CATEGORY = value;
      } else if (key === "1") {
        normalized.OPT_IN = value;
      } else {
        normalized[key] = value;
      }
    });

    return normalized;
  };

  // --- Fetch Forms on Mount ---
  useEffect(() => {
    const loadForms = async () => {
      try {
        setLoadingForms(true);
        setError(null);
        const res = await fetch(
          `https://graph.facebook.com/v18.0/${PAGE_ID}/leadgen_forms?access_token=${ACCESS_TOKEN}`
        );
        if (!res.ok) throw new Error("Failed to fetch forms");
        const data = await res.json();
        setForms(data.data || []);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoadingForms(false);
      }
    };

    loadForms();
  }, []);

  // --- Handle Form Click ---
  const handleFormClick = async (formId: string) => {
    if (selectedFormId === formId) return;
    setSelectedFormId(formId);
    setLoadingLeads(true);
    setError(null);

    try {
      const rawLeads = await fetchAllLeads(formId);
      const normalizedLeads = rawLeads.map(normalizeLead);
      setLeads(normalizedLeads);
    } catch (err) {
      setError((err as Error).message);
      setLeads([]);
    } finally {
      setLoadingLeads(false);
    }
  };

  // Stats calculations
  const totalLeads = leads.length;
  const leadsWithEmail = leads.filter((l) => l.EMAIL).length;
  const leadsWithPhone = leads.filter((l) => l.PHONE).length;
  const optedInLeads = leads.filter(
    (l) => l.OPT_IN?.toLowerCase() === "yes" || l.OPT_IN === "1"
  ).length;

  // Get unique categories for filter dropdown
  const uniqueCategories = useMemo(() => {
    const categories = leads.map((l) => l.CATEGORY).filter(Boolean);
    return Array.from(new Set(categories));
  }, [leads]);

  // Filtered and searched leads
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        lead.FULL_NAME?.toLowerCase().includes(searchLower) ||
        lead.EMAIL?.toLowerCase().includes(searchLower) ||
        lead.PHONE?.toLowerCase().includes(searchLower) ||
        lead.CATEGORY?.toLowerCase().includes(searchLower);

      // Category filter
      const matchesCategory =
        filterCategory === "all" || lead.CATEGORY === filterCategory;

      // Opt-in filter
      const isOptedIn =
        lead.OPT_IN?.toLowerCase() === "yes" || lead.OPT_IN === "1";
      const matchesOptIn =
        filterOptIn === "all" ||
        (filterOptIn === "yes" && isOptedIn) ||
        (filterOptIn === "no" && !isOptedIn);

      return matchesSearch && matchesCategory && matchesOptIn;
    });
  }, [leads, searchQuery, filterCategory, filterOptIn]);

  // Stats for filtered results
  const filteredTotalLeads = filteredLeads.length;
  const filteredLeadsWithEmail = filteredLeads.filter((l) => l.EMAIL).length;
  const filteredLeadsWithPhone = filteredLeads.filter((l) => l.PHONE).length;
  const filteredOptedInLeads = filteredLeads.filter(
    (l) => l.OPT_IN?.toLowerCase() === "yes" || l.OPT_IN === "1"
  ).length;

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="max-w-7xl mx-auto p-6">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
              <Users className="text-blue-600" size={40} />
              Facebook Leads Manager
            </h1>
            <p className="text-gray-600">
              Manage and view your lead generation forms and submissions
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Forms Sidebar */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                    <FileText className="text-blue-600" size={24} />
                    Lead Forms
                  </h2>
                  <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
                    {forms.length}
                  </span>
                </div>

                {loadingForms ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw
                      className="animate-spin text-blue-600"
                      size={32}
                    />
                  </div>
                ) : error ? (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-700 text-sm">Error: {error}</p>
                  </div>
                ) : forms.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    No forms found
                  </p>
                ) : (
                  <div className="space-y-3 max-h-[600px] overflow-y-auto">
                    {forms.map((form) => (
                      <button
                        key={form.id}
                        onClick={() => handleFormClick(form.id)}
                        className={`w-full text-left p-4 rounded-lg border-2 transition-all duration-200 ${
                          selectedFormId === form.id
                            ? "bg-blue-50 border-blue-500 shadow-md"
                            : "bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm"
                        }`}
                      >
                        <div className="font-medium text-gray-900 mb-1">
                          {form.name || "Unnamed Form"}
                        </div>
                        <div className="text-xs text-gray-500 font-mono">
                          ID: {form.id.slice(0, 20)}...
                        </div>
                        {form.status && (
                          <div className="mt-2">
                            <span
                              className={`text-xs px-2 py-1 rounded-full ${
                                form.status === "ACTIVE"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {form.status}
                            </span>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Leads Content */}
            <div className="lg:col-span-2">
              {/* Search and Filter Bar */}
              {selectedFormId && !loadingLeads && leads.length > 0 && (
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
                        placeholder="Search by name, email, phone, category..."
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
                          value={filterCategory}
                          onChange={(e) => setFilterCategory(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
                        >
                          <option value="all">All Categories</option>
                          {uniqueCategories.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="relative flex-1">
                        <select
                          value={filterOptIn}
                          onChange={(e) => setFilterOptIn(e.target.value)}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
                        >
                          <option value="all">All Opt-in Status</option>
                          <option value="yes">Opted In</option>
                          <option value="no">Not Opted In</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Active Filters Display */}
                  {(searchQuery ||
                    filterCategory !== "all" ||
                    filterOptIn !== "all") && (
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      <span className="text-sm text-gray-600">
                        Active filters:
                      </span>
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
                      {filterCategory !== "all" && (
                        <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm flex items-center gap-1">
                          Category: {filterCategory}
                          <button
                            onClick={() => setFilterCategory("all")}
                            className="ml-1 hover:text-purple-900"
                          >
                            ×
                          </button>
                        </span>
                      )}
                      {filterOptIn !== "all" && (
                        <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm flex items-center gap-1">
                          Opt-in: {filterOptIn === "yes" ? "Yes" : "No"}
                          <button
                            onClick={() => setFilterOptIn("all")}
                            className="ml-1 hover:text-green-900"
                          >
                            ×
                          </button>
                        </span>
                      )}
                      <button
                        onClick={() => {
                          setSearchQuery("");
                          setFilterCategory("all");
                          setFilterOptIn("all");
                        }}
                        className="text-sm text-red-600 hover:text-red-800 underline"
                      >
                        Clear all
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Stats Cards */}
              {selectedFormId && !loadingLeads && leads.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-white rounded-xl shadow-md p-4 border-l-4 border-blue-500">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-600 text-sm">Total Leads</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {filteredTotalLeads}
                        </p>
                        {filteredTotalLeads !== totalLeads && (
                          <p className="text-xs text-gray-500">
                            of {totalLeads}
                          </p>
                        )}
                      </div>
                      <Users className="text-blue-500" size={28} />
                    </div>
                  </div>

                  <div className="bg-white rounded-xl shadow-md p-4 border-l-4 border-green-500">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-600 text-sm">With Email</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {filteredLeadsWithEmail}
                        </p>
                        {filteredLeadsWithEmail !== leadsWithEmail && (
                          <p className="text-xs text-gray-500">
                            of {leadsWithEmail}
                          </p>
                        )}
                      </div>
                      <Mail className="text-green-500" size={28} />
                    </div>
                  </div>

                  <div className="bg-white rounded-xl shadow-md p-4 border-l-4 border-purple-500">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-600 text-sm">With Phone</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {filteredLeadsWithPhone}
                        </p>
                        {filteredLeadsWithPhone !== leadsWithPhone && (
                          <p className="text-xs text-gray-500">
                            of {leadsWithPhone}
                          </p>
                        )}
                      </div>
                      <Phone className="text-purple-500" size={28} />
                    </div>
                  </div>

                  <div className="bg-white rounded-xl shadow-md p-4 border-l-4 border-amber-500">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-600 text-sm">Opted In</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {filteredOptedInLeads}
                        </p>
                        {filteredOptedInLeads !== optedInLeads && (
                          <p className="text-xs text-gray-500">
                            of {optedInLeads}
                          </p>
                        )}
                      </div>
                      <CheckCircle className="text-amber-500" size={28} />
                    </div>
                  </div>
                </div>
              )}

              {/* Leads List */}
              <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Users className="text-indigo-600" size={24} />
                  Lead Submissions
                  {filteredLeads.length > 0 && (
                    <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-sm font-medium ml-2">
                      {filteredLeads.length}
                    </span>
                  )}
                </h2>

                {loadingLeads ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <RefreshCw
                      className="animate-spin text-indigo-600 mb-4"
                      size={40}
                    />
                    <p className="text-gray-600">Loading leads...</p>
                  </div>
                ) : error && !loadingForms ? (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                    <p className="text-red-700">Error loading leads: {error}</p>
                  </div>
                ) : filteredLeads.length === 0 && leads.length > 0 ? (
                  <div className="text-center py-16">
                    <Filter className="mx-auto text-gray-300 mb-4" size={64} />
                    <p className="text-gray-600 text-lg mb-2">
                      No leads match your filters
                    </p>
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setFilterCategory("all");
                        setFilterOptIn("all");
                      }}
                      className="text-blue-600 hover:text-blue-800 underline"
                    >
                      Clear all filters
                    </button>
                  </div>
                ) : leads.length === 0 ? (
                  <div className="text-center py-16">
                    <Users className="mx-auto text-gray-300 mb-4" size={64} />
                    <p className="text-gray-600 text-lg">
                      {selectedFormId
                        ? "No leads found for this form."
                        : "Select a form to view leads."}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[700px] overflow-y-auto pr-2">
                    {filteredLeads.map((lead) => (
                      <div
                        key={lead.id}
                        className="bg-gradient-to-r from-gray-50 to-white rounded-lg border border-gray-200 p-5 hover:shadow-md transition-shadow duration-200"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                              <Users className="text-blue-600" size={20} />
                            </div>
                            {lead.FULL_NAME || "Unnamed Lead"}
                          </h3>
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                            {new Date(lead.created_time).toLocaleDateString()}
                          </span>
                        </div>

                        <div className="grid md:grid-cols-2 gap-3">
                          <div className="flex items-center gap-2 text-gray-700">
                            <Mail className="text-green-600" size={16} />
                            <span className="text-sm font-medium">Email:</span>
                            <span className="text-sm">{lead.EMAIL || "—"}</span>
                          </div>

                          <div className="flex items-center gap-2 text-gray-700">
                            <Phone className="text-purple-600" size={16} />
                            <span className="text-sm font-medium">Phone:</span>
                            <span className="text-sm">{lead.PHONE || "—"}</span>
                          </div>

                          <div className="flex items-center gap-2 text-gray-700">
                            <Calendar className="text-blue-600" size={16} />
                            <span className="text-sm font-medium">DOB:</span>
                            <span className="text-sm">{lead.DOB || "—"}</span>
                          </div>

                          <div className="flex items-center gap-2 text-gray-700">
                            <Tag className="text-orange-600" size={16} />
                            <span className="text-sm font-medium">
                              Category:
                            </span>
                            <span className="text-sm">
                              {lead.CATEGORY || "—"}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-gray-700 md:col-span-2">
                            <CheckCircle className="text-amber-600" size={16} />
                            <span className="text-sm font-medium">Opt-in:</span>
                            <span
                              className={`text-sm px-2 py-0.5 rounded ${
                                lead.OPT_IN?.toLowerCase() === "yes" ||
                                lead.OPT_IN === "1"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {lead.OPT_IN || "—"}
                            </span>
                          </div>
                        </div>

                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <p className="text-xs text-gray-500">
                            Submitted:{" "}
                            {new Date(lead.created_time).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default FacebookLeadsManager;
