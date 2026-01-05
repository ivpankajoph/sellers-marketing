import React, { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  Play,
  Pause,
  Calendar,
  Clock,
  Users,
  FileSpreadsheet,
} from "lucide-react";
import * as XLSX from "xlsx";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Campaign, Step, Template } from "./helper";

const API_BASE = "/api";

export default function DripCampaignApp() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [showNewCampaign, setShowNewCampaign] = useState(false);
  const [campaignName, setCampaignName] = useState("");
  const [steps, setSteps] = useState<Step[]>([]);
  const [contacts, setContacts] = useState<string[]>([]); // Now explicitly string[]
  const [fileName, setFileName] = useState("");
  const [errors, setErrors] = useState<string | null>(null);

  useEffect(() => {
    fetchCampaigns();
    fetchTemplates();
  }, []);

  const fetchCampaigns = async () => {
    try {
      const response = await fetch(`${API_BASE}/drip-campaigns`);
      if (!response.ok) throw new Error("Failed to fetch campaigns");
      const data = await response.json();

      const normalized = data.map((c: any) => ({
        ...c,
        contacts: Array.isArray(c.contacts) ? c.contacts : [],
        steps: Array.isArray(c.steps) ? c.steps : [],
      }));

      setCampaigns(normalized);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
      setErrors("Failed to load campaigns. Please try again later.");
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await fetch(`${API_BASE}/templates`);
      if (!response.ok) throw new Error("Failed to fetch templates");
      const data = await response.json();
      setTemplates(data);
    } catch (error) {
      console.error("Error fetching templates:", error);
      setErrors("Failed to load message templates.");
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.group("📂 Excel Upload Debug");

    setErrors(null);
    const file = e.target.files?.[0];

    console.log("File selected:", file);

    if (!file) {
      console.warn("No file selected");
      console.groupEnd();
      return;
    }

    setFileName("");
    setContacts([]);

    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        console.log("FileReader loaded");

        const buffer = event.target?.result as ArrayBuffer;
        console.log("ArrayBuffer size:", buffer.byteLength);

        const data = new Uint8Array(buffer);
        const workbook = XLSX.read(data, { type: "array" });

        console.log("Workbook:", workbook);
        console.log("Sheet names:", workbook.SheetNames);

        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        console.log("Using sheet:", sheetName);
        console.log("Worksheet ref:", worksheet["!ref"]);

        // -------- HEADER DEBUGGING --------
        const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:A1");
        const headers: string[] = [];

        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddress = XLSX.utils.encode_cell({ r: 0, c: C });
          const cell = worksheet[cellAddress];
          let header = cell ? cell.v : "";
          if (typeof header === "string") header = header.trim();
          headers[C] = header;
        }

        console.log("Raw headers:", headers);

        const normalizedHeaders = headers.map((h) =>
          h.toLowerCase().replace(/\s+/g, " ").trim()
        );

        console.log("Normalized headers:", normalizedHeaders);

        const whatsappColIndex = normalizedHeaders.findIndex(
          (h) => h === "whatsapp number" || h === "whatsappnumber"
        );
        const phoneColIndex = normalizedHeaders.findIndex(
          (h) => h === "phone" || h === "phone number"
        );

        console.log("WhatsApp column index:", whatsappColIndex);
        console.log("Phone column index:", phoneColIndex);

        if (whatsappColIndex === -1 && phoneColIndex === -1) {
          setErrors(
            "No 'WhatsApp number' or 'Phone' column found. Please ensure your Excel file has one of these columns."
          );
          console.error("Required columns not found");
          console.groupEnd();
          return;
        }

        // -------- ROW DEBUGGING --------
        const json: any[] = XLSX.utils.sheet_to_json(worksheet, {
          defval: "",
          raw: true,
          header: 1,
        });

        console.log("Total rows (including header):", json.length);
        console.log("First 5 rows:", json.slice(0, 5));

        const extractedContacts: string[] = [];

        for (let i = 1; i < json.length; i++) {
          const row = json[i];
          console.log(`Row ${i}:`, row);

          let whatsapp = null;

          if (whatsappColIndex !== -1 && row[whatsappColIndex] !== undefined) {
            whatsapp = row[whatsappColIndex];
            console.log(`Row ${i} WhatsApp raw:`, whatsapp);
          } else if (phoneColIndex !== -1 && row[phoneColIndex] !== undefined) {
            whatsapp = row[phoneColIndex];
            console.log(`Row ${i} Phone raw:`, whatsapp);
          }

          if (!whatsapp) {
            console.warn(`Row ${i} skipped (empty number)`);
            continue;
          }

          if (typeof whatsapp === "number") {
            // Convert number to full string without scientific notation
            whatsapp = Math.trunc(whatsapp).toString();
          }

          if (typeof whatsapp !== "string") {
            console.warn(`Row ${i} invalid type:`, typeof whatsapp);
            continue;
          }

          const cleanNumber = whatsapp.replace(/\D/g, "");
          console.log(`Row ${i} cleaned number:`, cleanNumber);

          if (!cleanNumber) continue;

          if (cleanNumber.length === 10) {
            extractedContacts.push("91" + cleanNumber);
            console.log(`Row ${i} accepted →`, "91" + cleanNumber);
          } else if (
            cleanNumber.length === 12 &&
            cleanNumber.startsWith("91")
          ) {
            extractedContacts.push(cleanNumber);
            console.log(`Row ${i} accepted →`, cleanNumber);
          } else {
            console.warn(`Row ${i} rejected (invalid length):`, cleanNumber);
          }
        }

        console.log("Final extracted contacts:", extractedContacts);
        console.log("Total valid contacts:", extractedContacts.length);

        if (extractedContacts.length === 0) {
          setErrors(
            "No valid WhatsApp numbers found. Ensure your 'WhatsApp number' or 'Phone' column contains 10-digit numbers."
          );
          console.error("No valid numbers extracted");
          console.groupEnd();
          return;
        }

        setContacts(extractedContacts);
        setFileName(file.name);
        console.log("Upload successful");
      } catch (err) {
        console.error("File parsing error:", err);
        setErrors(
          "Invalid file format. Please upload a valid Excel (.xlsx/.xls) or CSV file."
        );
      } finally {
        console.groupEnd();
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const addStep = () => {
    const newStep: Step = {
      id: Date.now().toString(),
      templateId: "",
      scheduleType: "delay",
      delayDays: 0,
      delayHours: 0,
    };
    setSteps([...steps, newStep]);
  };

  const updateStep = (id: string, field: keyof Step, value: any) => {
    setSteps(
      steps.map((step) => (step.id === id ? { ...step, [field]: value } : step))
    );
  };

  const removeStep = (id: string) => {
    setSteps(steps.filter((step) => step.id !== id));
  };

  const saveCampaign = async () => {
    setErrors(null);

    if (!campaignName.trim()) {
      setErrors("Campaign name is required.");
      return;
    }
    if (steps.length === 0) {
      setErrors("At least one campaign step is required.");
      return;
    }
    if (contacts.length === 0) {
      setErrors("Please upload a valid contacts file.");
      return;
    }

    for (const step of steps) {
      if (!step.templateId) {
        setErrors("Please select a template for all steps.");
        return;
      }

      if (step.scheduleType === "specific") {
        if (!step.specificDate || !step.specificTime) {
          setErrors(
            "Please set date and time for all 'Specific' schedule steps."
          );
          return;
        }
      }
    }

    const campaign = {
      name: campaignName.trim(),
      steps,
      contacts, // Now array of strings like ["918000000000", ...]
      status: "draft" as const,
    };

    try {
      const response = await fetch(`${API_BASE}/drip-campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(campaign),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to save campaign");
      }

      const data = await response.json();
      const normalized = {
        ...data,
        contacts: Array.isArray(data.contacts) ? data.contacts : [],
        steps: Array.isArray(data.steps) ? data.steps : [],
      };
      setCampaigns([...campaigns, normalized]);
      resetForm();
    } catch (error: any) {
      console.error("Error saving campaign:", error);
      setErrors(error.message || "An unexpected error occurred while saving.");
    }
  };

  const toggleCampaignStatus = async (
    _id: string,
    action: "start" | "pause"
  ) => {
    try {
      const response = await fetch(
        `${API_BASE}/drip-campaigns/${_id}/${action}`,
        {
          method: "PATCH",
        }
      );
      if (!response.ok) throw new Error("Operation failed");
      const data = await response.json();
      setCampaigns(
        campaigns.map((c) => (c._id === _id ? { ...c, ...data } : c))
      );
    } catch (error) {
      console.error("Error updating campaign:", error);
      setErrors("Failed to update campaign status.");
    }
  };

  const deleteCampaign = async (id: string) => {
    if (!confirm("Are you sure you want to delete this campaign?")) return;

    try {
      const response = await fetch(`${API_BASE}/drip-campaigns/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Deletion failed");
      setCampaigns(campaigns.filter((c) => c._id !== id)); // Use _id consistently
    } catch (error) {
      console.error("Error deleting campaign:", error);
      setErrors("Failed to delete campaign.");
    }
  };

  const resetForm = () => {
    setCampaignName("");
    setSteps([]);
    setContacts([]);
    setFileName("");
    setErrors(null);
    setShowNewCampaign(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "running":
        return "bg-green-100 text-green-800";
      case "paused":
        return "bg-yellow-100 text-yellow-800";
      case "completed":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatStepSchedule = (step: Step) => {
    if (step.scheduleType === "specific") {
      return `${step.specificDate} at ${step.specificTime}`;
    }
    return `${step.delayDays || 0}d ${step.delayHours || 0}h delay`;
  };

  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  };

  const getTemplateName = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    return template ? `${template.name} (${template.type})` : "—";
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Drip Campaign Manager
                </h1>
                <p className="text-gray-600">
                  Create and manage WhatsApp drip campaigns
                </p>
              </div>
              <button
                onClick={() => setShowNewCampaign(!showNewCampaign)}
                className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 flex items-center gap-1 text-sm"
              >
                <Plus size={16} />
                New Campaign
              </button>
            </div>

            {errors && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
                {errors}
              </div>
            )}

            {showNewCampaign && (
              <div className="bg-gray-50 rounded-lg p-5 mb-6 border border-gray-200">
                <h2 className="text-lg font-semibold mb-4 text-gray-900">
                  Create New Campaign
                </h2>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Campaign Name
                  </label>
                  <input
                    type="text"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="e.g., Onboarding Series"
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Upload Contacts (Excel)
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 px-3 py-2 bg-white border border-dashed border-gray-300 rounded-md cursor-pointer hover:border-gray-400">
                      <FileSpreadsheet size={16} className="text-gray-500" />
                      <span className="text-gray-700 text-sm">Choose File</span>
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                    {fileName && (
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <FileSpreadsheet size={14} className="text-green-600" />
                        <span>
                          {fileName} ({contacts.length} WhatsApp numbers)
                        </span>
                      </div>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    File must contain a column named{" "}
                    <strong>WhatsApp number</strong> (or <strong>Phone</strong>
                    ). Numbers should be 10 digits (e.g., 8000000000).
                  </p>
                </div>

                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Campaign Steps
                    </label>
                    <button
                      onClick={addStep}
                      className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 text-xs font-medium"
                    >
                      <Plus size={12} />
                      Add Step
                    </button>
                  </div>

                  <div className="space-y-3">
                    {steps.map((step, index) => (
                      <div
                        key={step.id}
                        className="bg-white p-3 rounded border border-gray-200"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                            {index + 1}
                          </div>

                          <div className="flex-1 space-y-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                Template
                              </label>
                              <select
                                value={step.templateId}
                                onChange={(e) =>
                                  updateStep(
                                    step.id,
                                    "templateId",
                                    e.target.value
                                  )
                                }
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                              >
                                <option value="">— Select Template —</option>
                                {templates.map((tpl) => (
                                  <option key={tpl.id} value={tpl.id}>
                                    {tpl.name} ({tpl.type})
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                Schedule Type
                              </label>
                              <div className="flex gap-4">
                                <label className="flex items-center gap-1 cursor-pointer">
                                  <input
                                    type="radio"
                                    name={`schedule-${step.id}`}
                                    checked={step.scheduleType === "delay"}
                                    onChange={() =>
                                      updateStep(
                                        step.id,
                                        "scheduleType",
                                        "delay"
                                      )
                                    }
                                    className="text-indigo-600"
                                  />
                                  <span className="text-xs text-gray-700">
                                    Delay from previous
                                  </span>
                                </label>
                                <label className="flex items-center gap-1 cursor-pointer">
                                  <input
                                    type="radio"
                                    name={`schedule-${step.id}`}
                                    checked={step.scheduleType === "specific"}
                                    onChange={() =>
                                      updateStep(
                                        step.id,
                                        "scheduleType",
                                        "specific"
                                      )
                                    }
                                    className="text-indigo-600"
                                  />
                                  <span className="text-xs text-gray-700">
                                    Specific date & time
                                  </span>
                                </label>
                              </div>
                            </div>

                            {step.scheduleType === "delay" ? (
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">
                                    Delay (Days)
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    value={step.delayDays || 0}
                                    onChange={(e) =>
                                      updateStep(
                                        step.id,
                                        "delayDays",
                                        parseInt(e.target.value) || 0
                                      )
                                    }
                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">
                                    Delay (Hours)
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    max="23"
                                    value={step.delayHours || 0}
                                    onChange={(e) =>
                                      updateStep(
                                        step.id,
                                        "delayHours",
                                        parseInt(e.target.value) || 0
                                      )
                                    }
                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                  />
                                </div>
                              </div>
                            ) : (
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                                    <Calendar size={12} />
                                    Date
                                  </label>
                                  <input
                                    type="date"
                                    min={getTodayDate()}
                                    value={step.specificDate || ""}
                                    onChange={(e) =>
                                      updateStep(
                                        step.id,
                                        "specificDate",
                                        e.target.value
                                      )
                                    }
                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                                    <Clock size={12} />
                                    Time
                                  </label>
                                  <input
                                    type="time"
                                    value={step.specificTime || ""}
                                    onChange={(e) =>
                                      updateStep(
                                        step.id,
                                        "specificTime",
                                        e.target.value
                                      )
                                    }
                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                  />
                                </div>
                              </div>
                            )}
                          </div>

                          <button
                            onClick={() => removeStep(step.id)}
                            className="text-red-600 hover:text-red-800 p-1"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {steps.length === 0 && (
                    <div className="text-center py-4 text-gray-500 border border-dashed border-gray-300 rounded">
                      No steps added yet.
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={saveCampaign}
                    className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 text-sm font-medium"
                  >
                    Save Campaign
                  </button>
                  <button
                    onClick={resetForm}
                    className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-sm font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div>
              <h2 className="text-lg font-semibold mb-4 text-gray-900">
                Your Campaigns
              </h2>

              {campaigns.length === 0 ? (
                <div className="text-center py-8 text-gray-500 bg-gray-50 rounded border border-gray-200">
                  <Users size={24} className="mx-auto mb-2" />
                  <p>No campaigns yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {campaigns.map((campaign) => (
                    <div
                      key={campaign._id}
                      className="bg-white border border-gray-200 rounded-lg p-4"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-medium text-gray-900">
                            {campaign.name}
                          </h3>
                          <div className="flex items-center gap-3 text-xs text-gray-600 mt-1">
                            <span className="flex items-center gap-1">
                              <Users size={12} />
                              {Array.isArray(campaign.contacts)
                                ? campaign.contacts.length
                                : 0}{" "}
                              contacts
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar size={12} />
                              {Array.isArray(campaign.steps)
                                ? campaign.steps.length
                                : 0}{" "}
                              steps
                            </span>
                          </div>
                        </div>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                            campaign.status
                          )}`}
                        >
                          {campaign.status}
                        </span>
                      </div>

                      <div className="mb-3">
                        <div className="text-xs font-medium text-gray-700 mb-1">
                          Steps:
                        </div>
                        <div className="space-y-1">
                          {campaign.steps.map((step, idx) => (
                            <div
                              key={step.id}
                              className="flex items-center gap-2 text-xs bg-gray-50 p-2 rounded"
                            >
                              <span className="flex-shrink-0 w-5 h-5 bg-indigo-100 text-indigo-800 rounded-full flex items-center justify-center text-[10px] font-bold">
                                {idx + 1}
                              </span>
                              <span className="font-medium text-gray-900">
                                {getTemplateName(step.templateId)}
                              </span>
                              <span className="text-gray-600 flex items-center gap-1">
                                {step.scheduleType === "specific" ? (
                                  <>
                                    <Calendar size={12} />
                                    {formatStepSchedule(step)}
                                  </>
                                ) : (
                                  <>
                                    <Clock size={12} />
                                    {formatStepSchedule(step)}
                                  </>
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2 border-t border-gray-100">
                        {campaign.status === "running" ? (
                          <button
                            onClick={() =>
                              toggleCampaignStatus(campaign._id, "pause")
                            }
                            className="flex items-center gap-1 px-3 py-1.5 bg-yellow-600 text-white rounded text-xs hover:bg-yellow-700"
                          >
                            <Pause size={12} />
                            Pause
                          </button>
                        ) : (
                          <button
                            onClick={() =>
                              toggleCampaignStatus(campaign._id, "start")
                            }
                            disabled={campaign.status === "completed"}
                            className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Play size={12} />
                            Start
                          </button>
                        )}
                        <button
                          onClick={() => deleteCampaign(campaign._id)}
                          className="flex items-center gap-1 px-3 py-1.5 border border-red-300 text-red-600 rounded text-xs hover:bg-red-50"
                        >
                          <Trash2 size={12} />
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
