import DashboardLayout from "@/components/layout/DashboardLayout";
import React, { useState, useEffect } from "react";

interface LeadgenForm {
  id: string;
  name: string;
  locale: string;
  status: "ACTIVE" | "ARCHIVED";
}

interface LeadField {
  name: string;
  values: string[];
}

interface Lead {
  id: string;
  created_time: string;
  field_data: LeadField[];
}

const LeadgenFormsViewer: React.FC = () => {
  const [forms, setForms] = useState<LeadgenForm[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedForm, setSelectedForm] = useState<LeadgenForm | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadsLoading, setLeadsLoading] = useState<boolean>(false);
  const [leadsError, setLeadsError] = useState<string | null>(null);

  useEffect(() => {
    const fetchForms = async () => {
      try {
        const userDataString = localStorage.getItem("whatsapp_auth_user");
        if (!userDataString) {
          setError("User not logged in");
          setLoading(false);
          return;
        }

        const userData = JSON.parse(userDataString);
        const userId = userData.id;

        const pageIdRes = await fetch(
          `/api/integrations/key?key=FB_PAGE_ID&userId=${userId}`
        );
        if (!pageIdRes.ok) throw new Error("Failed to fetch FB_PAGE_ID");
        const { value: FB_PAGE_ID } = await pageIdRes.json();

        const tokenRes = await fetch(
          `/api/integrations/key?key=FB_PAGE_ACCESS_TOKEN&userId=${userId}`
        );
        if (!tokenRes.ok)
          throw new Error("Failed to fetch FB_PAGE_ACCESS_TOKEN");
        const { value: FB_PAGE_ACCESS_TOKEN } = await tokenRes.json();

        const response = await fetch(
          `https://graph.facebook.com/v18.0/${FB_PAGE_ID}/leadgen_forms?access_token=${FB_PAGE_ACCESS_TOKEN}`
        );

        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        setForms(data.data || []);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "An unknown error occurred"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchForms();
  }, []);

  // Open modal and fetch leads
  const handleFormClick = async (form: LeadgenForm) => {
    setSelectedForm(form);
    setLeads([]);
    setLeadsLoading(true);
    setLeadsError(null);

    try {
      const userDataString = localStorage.getItem("whatsapp_auth_user");
      if (!userDataString) throw new Error("User not logged in");
      const userData = JSON.parse(userDataString);
      const userId = userData.id;

      const tokenRes = await fetch(
        `/api/integrations/key?key=FB_PAGE_ACCESS_TOKEN&userId=${userId}`
      );
      if (!tokenRes.ok) throw new Error("Failed to fetch access token");
      const { value: FB_PAGE_ACCESS_TOKEN } = await tokenRes.json();

      const response = await fetch(
        `https://graph.facebook.com/v18.0/${form.id}/leads?access_token=${FB_PAGE_ACCESS_TOKEN}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch leads: ${response.status}`);
      }

      const data = await response.json();
      setLeads(data.data || []);
    } catch (err) {
      setLeadsError(
        err instanceof Error ? err.message : "Failed to load leads"
      );
    } finally {
      setLeadsLoading(false);
    }
  };

  const closeModal = () => {
    setSelectedForm(null);
  };

  const getStatusColor = (status: string) => {
    return status === "ACTIVE"
      ? "bg-green-100 text-green-800"
      : "bg-gray-100 text-gray-800";
  };

  // Normalize field data into an object for easier access
  const normalizeLead = (lead: Lead) => {
    const normalized: Record<string, string> = {};
    lead.field_data.forEach((field) => {
      normalized[field.name] = field.values.join(", ");
    });
    return normalized;
  };

  // Extract all unique field names across leads for table headers
  const getFieldNames = () => {
    const allFields = new Set<string>();
    leads.forEach((lead) => {
      lead.field_data.forEach((field) => allFields.add(field.name));
    });
    return Array.from(allFields).sort();
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-600">Loading forms...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="p-6 text-center">
          <div className="text-red-600 font-medium">Error loading forms</div>
          <div className="text-sm text-gray-500 mt-1">{error}</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 max-w-6xl mx-auto">
        <h1 className="text-2xl font-semibold text-gray-800 mb-6">
          Leadgen Forms
        </h1>

        {forms.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No forms found.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {forms.map((form) => (
              <div
                key={form.id}
                onClick={() => handleFormClick(form)}
                className="border border-gray-200 rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow bg-white cursor-pointer"
              >
                <div className="flex justify-between items-start mb-3">
                  <h2 className="font-medium text-gray-900 text-sm line-clamp-2">
                    {form.name}
                  </h2>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                      form.status
                    )}`}
                  >
                    {form.status.charAt(0).toUpperCase() + form.status.slice(1)}
                  </span>
                </div>
                <div className="flex items-center text-xs text-gray-500 mt-2 space-x-3">
                  <span>Locale: {form.locale}</span>
                  <span>•</span>
                  <span>ID: {form.id.substring(0, 8)}...</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center z-50 p-4">
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-xl font-semibold">
                Leads for: {selectedForm.name}
              </h2>
              <button
                onClick={closeModal}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            {leadsLoading ? (
              <div className="p-8 text-center text-gray-600">
                Loading leads...
              </div>
            ) : leadsError ? (
              <div className="p-6 text-center text-red-600">{leadsError}</div>
            ) : leads.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No leads found.
              </div>
            ) : (
              <div className="p-4 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created At
                      </th>
                      {getFieldNames().map((field) => (
                        <th
                          key={field}
                          className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          {field}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {leads.map((lead) => {
                      const normalized = normalizeLead(lead);
                      return (
                        <tr key={lead.id}>
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                            {new Date(lead.created_time).toLocaleString()}
                          </td>
                          {getFieldNames().map((field) => (
                            <td
                              key={`${lead.id}-${field}`}
                              className="px-4 py-2 text-sm text-gray-700"
                            >
                              {normalized[field] || "—"}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default LeadgenFormsViewer;
