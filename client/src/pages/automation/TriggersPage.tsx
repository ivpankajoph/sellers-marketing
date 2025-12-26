import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DashboardLayout from '@/components/layout/DashboardLayout';

// --- API Helpers ---
const fetchForms = async () => (await fetch('http://localhost:8080/api/forms')).json();
const fetchTemplates = async () => (await fetch('http://localhost:8080/api/templates')).json();
const fetchStatus = async () => (await fetch('http://localhost:8080/api/status')).json();

export default function LeadManager() {
  const queryClient = useQueryClient();
  
  // 1. Fetch Data
  const { data: forms = [] } = useQuery({ queryKey: ['forms'], queryFn: fetchForms });
  const { data: templates = [] } = useQuery({ queryKey: ['templates'], queryFn: fetchTemplates });
  const { data: statusData } = useQuery({ queryKey: ['status'], queryFn: fetchStatus });

  const [isRunning, setIsRunning] = useState(true);

  useEffect(() => {
    if (statusData) setIsRunning(statusData.is_running);
  }, [statusData]);

  // 2. Mutations
  const triggerMutation = useMutation({
    mutationFn: async (payload: { form_id: any; form_name: any; template_id: any; template_name: any; }) => {
      return fetch('http://localhost:8080/api/set-trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      alert("Template mapped successfully! Scanning for new leads...");
      queryClient.invalidateQueries({ queryKey: ['forms'] });
    }
  });

  const controlMutation = useMutation({
    mutationFn: async (shouldRun: boolean) => {
      return fetch('http://localhost:8080/api/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ run: shouldRun }),
      });
    }
  });

  // 3. Handlers
  const handleTemplateChange = (form: { id: any; name: any; }, templateId: string) => {
    const template = templates.find((t: { id: string; }) => t.id === templateId);
    if (!template) return;

    triggerMutation.mutate({
      form_id: form.id,
      form_name: form.name,
      template_id: template.id,
      template_name: template.name
    });
  };

  const toggleSystem = () => {
    const newState = !isRunning;
    setIsRunning(newState);
    controlMutation.mutate(newState);
  };

  return (
   <DashboardLayout>
     <div className="p-10 container mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Facebook Lead Automation</h1>
        
        <div className="flex items-center gap-4">
          <span className={`font-semibold ${isRunning ? 'text-green-600' : 'text-red-600'}`}>
            Status: {isRunning ? "RUNNING (Every 10m)" : "STOPPED"}
          </span>
          <button 
            onClick={toggleSystem}
            className={`px-4 py-2 rounded text-white ${isRunning ? 'bg-red-500' : 'bg-green-500'}`}
          >
            {isRunning ? 'Stop Sync' : 'Start Sync'}
          </button>
        </div>
      </div>

      <div className="grid gap-4">
        {forms.map((form: { id: any; name: any; status?: any; assigned_template?: any; }) => (
          <div key={form.id} className="border p-4 rounded shadow flex justify-between items-center bg-white">
            <div>
              <h3 className="font-bold">{form.name}</h3>
              <p className="text-sm text-gray-500">ID: {form.id} | Status: {form.status}</p>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm">Send Template:</label>
              <select 
                className="border p-2 rounded"
                value={form.assigned_template || ""}
                onChange={(e) => handleTemplateChange(form, e.target.value)}
              >
                <option value="" disabled>Select a Template</option>
                {templates.map((t: { id: string; name: string; }) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            
            {form.assigned_template && (
              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                Active Trigger
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
   </DashboardLayout>
  );
}