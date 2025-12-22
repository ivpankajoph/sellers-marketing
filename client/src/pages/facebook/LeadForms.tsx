import DashboardLayout from "@/components/layout/DashboardLayout";
import React, { useState, useEffect } from "react";

interface LeadgenForm {
  id: string;
  name: string;
  locale: string;
  status: "ACTIVE" | "ARCHIVED";
}

const LeadgenFormsViewer: React.FC = () => {
  const [forms, setForms] = React.useState<LeadgenForm[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  useEffect(() => {
    const fetchForms = async () => {
      try {
        // Validate user login
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
  }, []); // Only run once on mount

  const getStatusColor = (status: string) => {
    return status === "ACTIVE"
      ? "bg-green-100 text-green-800"
      : "bg-gray-100 text-gray-800";
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
                className="border border-gray-200 rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow bg-white"
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
    </DashboardLayout>
  );
};

export default LeadgenFormsViewer;
