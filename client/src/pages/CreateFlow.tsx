import React, { useState, useRef, useEffect } from 'react';
import { Plus, Trash2, GripVertical, Save, RefreshCw, XCircle, CheckCircle } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { getAuthHeaders } from '@/contexts/AuthContext';
import { useParams } from 'wouter';
// SweetAlert2 CDN
declare global {
  interface Window {
    Swal: any;
  }
}

interface FormField {
  id: string;
  type: 'header' | 'body' | 'caption' | 'text' | 'textarea' | 'checkbox' | 'radio' | 'select' | 'date' | 'submit';
  label: string;
  required?: boolean;
  options?: string[];
}

interface FlowData {
  flowName: string;
  screenName: string;
  formTitle: string;
  flowCategory: string;
  replyMessage: string;
  fields: FormField[];
}

const WhatsAppFlowBuilder: React.FC = () => {
  const API_BASE = '/api/webhook/whatsapp/flows';

  const [flowData, setFlowData] = useState<FlowData>({
    flowName: '',
    screenName: '',
    formTitle: '',
    flowCategory: '',
    replyMessage: '',
    fields: []
  });

  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [apiResponse, setApiResponse] = useState<string>('');
  const [swalLoaded, setSwalLoaded] = useState(false);
  const [currentFlowId, setCurrentFlowId] = useState<string | null>(null); // MongoDB ID

  const params = useParams();
  const flowIdFromRoute = params?.id;

  useEffect(() => {
    if (flowIdFromRoute) {
      loadFlowDraft(flowIdFromRoute);
    }
  }, [flowIdFromRoute]);

  const loadFlowDraft = async (id: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE}/${id}`, {
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to load flow draft');
      const data = await response.json();

      setCurrentFlowId(data._id);
      if (data.flowData) {
        setFlowData(data.flowData);
      } else {
        // Fallback initialized state if no draft exists
        setFlowData(prev => ({
          ...prev,
          flowName: data.name,
          flowCategory: data.categories?.[0] || ''
        }));
      }
    } catch (error) {
      console.error("Error loading flow draft", error);
      if (swalLoaded) {
        window.Swal.fire({ title: 'Error', text: 'Could not load existing flow.', icon: 'error' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const dragCounter = useRef(0);

  // Load SweetAlert2
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/sweetalert2@11';
    script.async = true;
    script.onload = () => setSwalLoaded(true);
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  const flowCategories = [
    'SIGN_IN',
    'APPOINTMENT_BOOKING',
    'LEAD_GENERATION',
    'CONTACT_US',
    'CUSTOMER_SUPPORT',
    'SURVEY',
    'OTHER'
  ];

  const fieldTypes: Array<{ type: FormField['type']; icon: string; label: string; color: string }> = [
    { type: 'header', icon: 'H', label: 'Header', color: 'from-purple-500 to-purple-600' },
    { type: 'body', icon: 'T', label: 'Text Body', color: 'from-slate-500 to-slate-600' },
    { type: 'caption', icon: 'C', label: 'Text Caption', color: 'from-zinc-500 to-zinc-600' },
    { type: 'text', icon: 'I', label: 'Text Field', color: 'from-blue-500 to-blue-600' },
    { type: 'textarea', icon: 'A', label: 'Text Area', color: 'from-cyan-500 to-cyan-600' },
    { type: 'checkbox', icon: 'C', label: 'Checkbox Group', color: 'from-green-500 to-green-600' },
    { type: 'radio', icon: 'R', label: 'Radio Group', color: 'from-yellow-500 to-yellow-600' },
    { type: 'select', icon: 'D', label: 'Dropdown', color: 'from-orange-500 to-orange-600' },
    { type: 'date', icon: 'Dt', label: 'Date Field', color: 'from-pink-500 to-pink-600' },
    { type: 'submit', icon: 'Go', label: 'Submit Button', color: 'from-indigo-500 to-indigo-600' }
  ];

  const handleDragStart = (e: React.DragEvent, fieldType: string) => {
    setDraggedItem(fieldType);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDragLeave = () => {
    dragCounter.current--;
  };

  const getDefaultLabel = (fieldType: FormField['type']) => {
    switch (fieldType) {
      case 'header':
        return 'Section Header';
      case 'body':
        return 'Helpful instruction text for user';
      case 'caption':
        return 'Additional short helper text';
      case 'text':
        return 'Text Field';
      case 'textarea':
        return 'Long Text Field';
      case 'checkbox':
        return 'Choose options';
      case 'radio':
        return 'Select one option';
      case 'select':
        return 'Select from dropdown';
      case 'date':
        return 'Choose date';
      case 'submit':
        return 'Submit';
      default:
        return 'New Field';
    }
  };
  const addFieldToCanvas = (fieldType: FormField['type']) => {
    const newField: FormField = {
      id: `field-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      type: fieldType,
      label: getDefaultLabel(fieldType),
      required: false,
      options: ['checkbox', 'radio', 'select'].includes(fieldType) ? ['Option 1', 'Option 2'] : undefined
    };
    setFlowData(prev => ({
      ...prev,
      fields: [...prev.fields, newField]
    }));
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    if (draggedItem) {
      addFieldToCanvas(draggedItem as FormField['type']);
      setDraggedItem(null);
    }
  };

  const removeField = (fieldId: string) => {
    setFlowData(prev => ({
      ...prev,
      fields: prev.fields.filter(f => f.id !== fieldId)
    }));
  };

  const updateField = (fieldId: string, updates: Partial<FormField>) => {
    setFlowData(prev => ({
      ...prev,
      fields: prev.fields.map(f => f.id === fieldId ? { ...f, ...updates } : f)
    }));
  };

  const clearForm = () => {
    if (!swalLoaded) {
      if (window.confirm('Are you sure you want to clear all fields?')) {
        setFlowData({
          flowName: '',
          screenName: '',
          formTitle: '',
          flowCategory: '',
          replyMessage: '',
          fields: []
        });
        setApiResponse('');
      }
      return;
    }

    window.Swal.fire({
      title: 'Clear All Fields?',
      text: "This will reset the entire form. This action cannot be undone!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, clear it!',
      cancelButtonText: 'Cancel'
    }).then((result: any) => {
      if (result.isConfirmed) {
        setFlowData({
          flowName: '',
          screenName: '',
          formTitle: '',
          flowCategory: '',
          replyMessage: '',
          fields: []
        });
        setApiResponse('');

        window.Swal.fire({
          title: 'Cleared!',
          text: 'All fields have been cleared successfully.',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });
      }
    });
  };

  const generateFlowJson = (data: FlowData) => {
    const children = data.fields.map(field => {
      switch (field.type) {
        case 'header':
          return { type: 'TextHeading', text: field.label };
        case 'body':
          return { type: 'TextBody', text: field.label };
        case 'caption':
          return { type: 'TextCaption', text: field.label };
        case 'text':
        case 'textarea':
          return { type: 'TextInput', name: field.id, label: field.label, required: field.required };
        case 'checkbox':
          return {
            type: 'CheckboxGroup',
            name: field.id,
            "data-source": field.options?.map((opt, i) => ({ id: `opt_${i}`, title: opt })),
            required: field.required
          };
        case 'radio':
          return {
            type: 'RadioButtonsGroup',
            name: field.id,
            "data-source": field.options?.map((opt, i) => ({ id: `opt_${i}`, title: opt })),
            required: field.required
          };
        case 'select':
          return {
            type: 'Dropdown',
            name: field.id,
            label: field.label,
            "data-source": field.options?.map((opt, i) => ({ id: `opt_${i}`, title: opt })),
            required: field.required
          };
        case 'date':
          return { type: 'DatePicker', name: field.id, label: field.label, required: field.required };
        case 'submit':
          return { type: 'Footer', label: field.label, "on-click-action": { name: "complete", payload: {} } };
        default:
          return null;
      }
    }).filter(Boolean);

    if (!children.find((c: any) => c?.type === 'Footer')) {
      children.push({ type: 'Footer', label: 'Submit', "on-click-action": { name: "complete", payload: {} } });
    }

    return {
      version: "3.1",
      data_api_version: "3.0",
      routing_model: {
        [data.screenName || "FORM_SCREEN"]: []
      },
      screens: [
        {
          id: data.screenName || "FORM_SCREEN",
          title: data.formTitle || data.flowName,
          data: {},
          layout: {
            type: "SingleColumnLayout",
            children: children
          }
        }
      ]
    };
  };

  const saveFlowDraft = async () => {
    if (!flowData.flowName || !flowData.flowCategory) {
      const msg = 'Please fill in Flow Name and Flow Category';
      if (swalLoaded) window.Swal.fire({ title: 'Missing Information', text: msg, icon: 'error' });
      else alert(msg);
      return;
    }

    setIsLoading(true);
    setApiResponse('');

    try {
      let flowDbId = currentFlowId;

      if (!flowDbId) {
        // Step 1: Create flow in Meta and MongoDB via backend
        const createRes = await fetch(`${API_BASE}/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify({ name: flowData.flowName, categories: [flowData.flowCategory] })
        });
        const createData = await createRes.json();
        if (!createRes.ok) throw new Error(createData.error || 'Failed to create flow');

        flowDbId = createData.flow._id;
        setCurrentFlowId(flowDbId);
      }

      // Step 2: Generate JSON and save draft
      const flowJson = generateFlowJson(flowData);
      const draftRes = await fetch(`${API_BASE}/${flowDbId}/draft`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ flowData, flowJson })
      });
      const draftData = await draftRes.json();
      if (!draftRes.ok) throw new Error(draftData.error || 'Failed to save draft');

      setApiResponse("Draft saved successfully.\n" + JSON.stringify(flowJson, null, 2));
      if (swalLoaded) window.Swal.fire({ title: 'Success!', text: 'Flow draft saved successfully!', icon: 'success' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setApiResponse(`Error: ${errorMessage}`);
      if (swalLoaded) window.Swal.fire({ title: 'Error', text: errorMessage, icon: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const publishFlow = async () => {
    if (!currentFlowId) {
      const msg = 'Please save the draft first before publishing!';
      if (swalLoaded) window.Swal.fire({ title: 'Warning', text: msg, icon: 'warning' });
      else alert(msg);
      return;
    }

    setIsPublishing(true);
    setApiResponse('');

    try {
      const res = await fetch(`${API_BASE}/${currentFlowId}/publish-meta`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to publish flow');

      setApiResponse("Flow published successfully.\n" + JSON.stringify(data, null, 2));
      if (swalLoaded) window.Swal.fire({ title: 'Published!', text: 'Flow is now live on Meta.', icon: 'success' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setApiResponse(`Publish Error: ${errorMessage}`);
      if (swalLoaded) window.Swal.fire({ title: 'Error Publishing', text: errorMessage, icon: 'error' });
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl shadow-xl p-8 mb-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">WhatsApp Flow Builder</h1>
                <p className="text-blue-100">Create interactive WhatsApp flows with drag & drop</p>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                <span className="text-4xl">💬</span>
              </div>
            </div>
          </div>

          {/* Warning */}
          <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 mb-6 shadow-sm">
            <p className="text-sm text-red-700 font-medium">
              ⚠️ Do not use any copy paste formatted text on label name
            </p>
          </div>

          {/* Form Configuration */}
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border border-gray-100">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <span className="text-2xl">⚙️</span>
              Flow Configuration
            </h2>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                  Flow Name <span className="text-blue-500 cursor-help" title="Unique identifier for your flow">ⓘ</span>
                </label>
                <input
                  type="text"
                  placeholder="Any name to identify it later"
                  value={flowData.flowName}
                  onChange={(e) => setFlowData(prev => ({ ...prev, flowName: e.target.value }))}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                  Flow Category <span className="text-blue-500 cursor-help" title="Select the purpose of your flow">ⓘ</span>
                </label>
                <select
                  value={flowData.flowCategory}
                  onChange={(e) => setFlowData(prev => ({ ...prev, flowCategory: e.target.value }))}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 transition-colors bg-white"
                >
                  <option value="">Select category</option>
                  {flowCategories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                  Screen Unique Name <span className="text-blue-500 cursor-help" title="Internal screen identifier">ⓘ</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., FORM_SCREEN"
                  value={flowData.screenName}
                  onChange={(e) => setFlowData(prev => ({ ...prev, screenName: e.target.value }))}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                  Form Title <span className="text-blue-500 cursor-help" title="Title shown to users">ⓘ</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., Contact Form"
                  value={flowData.formTitle}
                  onChange={(e) => setFlowData(prev => ({ ...prev, formTitle: e.target.value }))}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                Reply Sent After Form Submit <span className="text-blue-500 cursor-help" title="Auto-reply message">ⓘ</span>
              </label>
              <select
                value={flowData.replyMessage}
                onChange={(e) => setFlowData(prev => ({ ...prev, replyMessage: e.target.value }))}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 transition-colors bg-white"
              >
                <option value="">Please select reply message</option>
                <option value="thank_you">Thank you message</option>
                <option value="confirmation">Confirmation message</option>
                <option value="custom">Custom message</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-6">
            {/* Field Types Sidebar */}
            <div className="col-span-1">
              <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 sticky top-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                    <span className="text-2xl">🧩</span>
                    Components
                  </h2>
                </div>

                <div className="space-y-3">
                  {fieldTypes.map((field) => (
                    <button
                      type="button"
                      key={field.type}
                      onClick={() => addFieldToCanvas(field.type)}
                      draggable
                      onDragStart={(e) => handleDragStart(e, field.type)}
                      className={`flex items-center gap-3 p-4 bg-gradient-to-r ${field.color} text-white rounded-xl cursor-move hover:shadow-lg hover:scale-105 transition-all duration-200`}
                    >
                      <span className="text-2xl">{field.icon}</span>
                      <span className="text-sm font-semibold">{field.label}</span>
                    </button>
                  ))}
                </div>

                <div className="mt-8 pt-6 border-t-2 border-gray-200 space-y-3">
                  <button
                    onClick={saveFlowDraft}
                    disabled={isLoading || isPublishing}
                    className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-3 px-4 rounded-xl hover:from-green-600 hover:to-green-700 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl font-semibold"
                  >
                    {isLoading ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-5 h-5" />
                        Save Draft
                      </>
                    )}
                  </button>

                  <button
                    onClick={publishFlow}
                    disabled={isLoading || isPublishing || !currentFlowId}
                    className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-3 px-4 rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl font-semibold"
                  >
                    {isPublishing ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        Publishing...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        Publish Flow
                      </>
                    )}
                  </button>

                  <button
                    onClick={clearForm}
                    className="w-full bg-gradient-to-r from-red-500 to-red-600 text-white py-3 px-4 rounded-xl hover:from-red-600 hover:to-red-700 transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl font-semibold"
                  >
                    <XCircle className="w-5 h-5" />
                    Clear
                  </button>
                </div>
              </div>
            </div>

            {/* Canvas Area */}
            <div className="col-span-2">
              <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                    <span className="text-2xl">🎨</span>
                    Form Canvas
                  </h2>
                  <div className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-lg">
                    {flowData.fields.length} field{flowData.fields.length !== 1 ? 's' : ''}
                  </div>
                </div>

                <div
                  onDragEnter={handleDragEnter}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className="min-h-96 border-3 border-dashed border-gray-300 rounded-2xl p-8 bg-gradient-to-br from-gray-50 to-white"
                >
                  {flowData.fields.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 py-20">
                      <div className="text-6xl mb-4">📋</div>
                      <p className="text-lg font-medium">Drag or click components to build your flow</p>
                      <p className="text-sm mt-2">You can click a component from the left panel to add instantly</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {flowData.fields.map((field, index) => (
                        <div
                          key={field.id}
                          className="bg-white border-2 border-gray-200 rounded-xl p-5 hover:shadow-xl hover:border-blue-300 transition-all duration-200"
                        >
                          <div className="flex items-start gap-3">
                            <GripVertical className="w-6 h-6 text-gray-400 mt-2 cursor-move hover:text-gray-600" />

                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-3">
                                <span className="text-sm font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-lg">
                                  #{index + 1}
                                </span>
                                <span className="text-sm font-semibold text-gray-700 bg-blue-50 px-3 py-1 rounded-lg">
                                  {field.type.toUpperCase()}
                                </span>
                              </div>

                              <input
                                type="text"
                                value={field.label}
                                onChange={(e) => updateField(field.id, { label: e.target.value })}
                                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl mb-3 focus:outline-none focus:border-blue-500 transition-colors font-medium"
                                placeholder="Field label"
                              />

                              {['select', 'radio', 'checkbox'].includes(field.type) && (
                                <div className="mt-2 text-left">
                                  <label className="text-xs text-gray-500 font-semibold mb-1 block">Options (comma separated)</label>
                                  <input
                                    type="text"
                                    value={field.options?.join(', ') || ''}
                                    onChange={(e) => updateField(field.id, { options: e.target.value.split(',').map(o => o.trim()).filter(Boolean) })}
                                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl text-sm mb-3 focus:outline-none focus:border-blue-500"
                                    placeholder="Option 1, Option 2"
                                  />
                                </div>
                              )}

                              {!['submit', 'header', 'body', 'caption'].includes(field.type) && (
                                <label className="flex items-center gap-2 mb-4 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={field.required || false}
                                    onChange={(e) => updateField(field.id, { required: e.target.checked })}
                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                  />
                                  <span className="text-sm text-gray-600 font-medium">Required Field</span>
                                </label>
                              )}

                              {field.type === 'header' && (
                                <h2 className="text-2xl font-bold text-gray-800 py-2">{field.label}</h2>
                              )}

                              {field.type === 'body' && (
                                <p className="text-base text-gray-700 leading-relaxed py-2">{field.label}</p>
                              )}

                              {field.type === 'caption' && (
                                <p className="text-sm text-gray-500 leading-relaxed py-2">{field.label}</p>
                              )}

                              {field.type === 'text' && (
                                <input
                                  type="text"
                                  disabled
                                  placeholder="Text input field"
                                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl bg-gray-50"
                                />
                              )}

                              {field.type === 'textarea' && (
                                <textarea
                                  disabled
                                  placeholder="Text area field"
                                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl bg-gray-50 h-24 resize-none"
                                />
                              )}

                              {(field.type === 'checkbox' || field.type === 'radio') && field.options && (
                                <div className="space-y-3 bg-gray-50 p-4 rounded-xl">
                                  {field.options.map((opt, idx) => (
                                    <label key={idx} className="flex items-center gap-3 cursor-pointer hover:bg-white p-2 rounded-lg transition-colors">
                                      <input
                                        type={field.type}
                                        disabled
                                        className="w-5 h-5 text-blue-600"
                                      />
                                      <span className="text-sm font-medium text-gray-700">{opt}</span>
                                    </label>
                                  ))}
                                </div>
                              )}

                              {field.type === 'select' && field.options && (
                                <select disabled className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl bg-gray-50">
                                  <option>Select an option</option>
                                  {field.options.map((opt, idx) => (
                                    <option key={idx}>{opt}</option>
                                  ))}
                                </select>
                              )}

                              {field.type === 'date' && (
                                <input
                                  type="date"
                                  disabled
                                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl bg-gray-50"
                                />
                              )}

                              {field.type === 'submit' && (
                                <button
                                  disabled
                                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-6 rounded-xl font-semibold text-lg shadow-lg"
                                >
                                  {field.label}
                                </button>
                              )}
                            </div>

                            <button
                              onClick={() => removeField(field.id)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-all"
                            >
                              <Trash2 className="w-6 h-6" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {apiResponse && (
                <div className="mt-6 bg-gradient-to-br from-gray-900 to-gray-800 text-green-400 rounded-2xl p-6 font-mono text-sm overflow-auto max-h-96 shadow-xl border-2 border-gray-700">
                  <div className="flex items-center gap-2 mb-3 text-white font-bold">
                    <span className="text-xl">📡</span>
                    API Response:
                  </div>
                  <pre className="text-xs leading-relaxed">{apiResponse}</pre>
                </div>
              )}
            </div>

            {/* Preview Panel */}
            <div className="col-span-1">
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4 sticky top-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                    <span className="text-2xl">📱</span>
                    Local Preview
                  </h2>
                </div>
                <p className="mb-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                  This is an approximate builder preview. For exact rendering, use Meta preview URL from WhatsApp Flows page.
                </p>

                <div className="flex justify-center">
                  <div className="relative bg-gray-900 rounded-[2.5rem] overflow-hidden border-[6px] border-gray-900 shadow-xl" style={{ height: '520px', width: '280px' }}>
                    {/* Status Bar */}
                    <div className="h-6 bg-white flex items-center justify-between px-4 text-black text-[10px] font-medium">
                      <span>9:41</span>
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 bg-black rounded-full"></div>
                        <div className="w-1.5 h-1.5 bg-black rounded-full"></div>
                        <div className="w-1.5 h-1.5 bg-black rounded-full"></div>
                      </div>
                    </div>

                    {/* App Header */}
                    <div className="bg-white px-4 py-3 border-b border-gray-100 flex items-center justify-between shadow-sm relative z-10">
                      <div className="w-5 text-gray-400">✖</div>
                      <h3 className="text-sm font-semibold text-gray-800 truncate px-2">{flowData.formTitle || 'Form Title'}</h3>
                      <div className="w-5"></div>
                    </div>

                    {/* Content */}
                    <div className="p-4 bg-white h-[calc(100%-4rem)] overflow-y-auto w-full relative z-0 hide-scrollbar pb-16">
                      <div className="space-y-4">
                        {flowData.fields.map((field, idx) => (
                          <div key={idx} className="w-full">
                            {field.type === 'header' && (
                              <h2 className="text-lg font-bold text-gray-900 mb-1 leading-tight">{field.label || 'Header'}</h2>
                            )}
                            {field.type === 'body' && (
                              <p className="text-sm text-gray-700 mb-2 leading-relaxed">{field.label || 'Body text'}</p>
                            )}
                            {field.type === 'caption' && (
                              <p className="text-xs text-gray-500 mb-2 leading-relaxed">{field.label || 'Caption text'}</p>
                            )}
                            {['text', 'textarea', 'date'].includes(field.type) && (
                              <div className="mb-2">
                                <label className="block text-xs font-semibold text-gray-700 mb-1 truncate">
                                  {field.label || 'Input'} {field.required && <span className="text-red-500">*</span>}
                                </label>
                                <div className={`w-full border border-gray-300 rounded-lg bg-gray-50 ${field.type === 'textarea' ? 'h-20' : 'h-10'} px-3 flex items-center`}>
                                  <span className="text-gray-400 text-xs text-opacity-70">
                                    {field.type === 'date' ? 'dd/mm/yyyy' : 'Type here...'}
                                  </span>
                                </div>
                              </div>
                            )}
                            {field.type === 'select' && (
                              <div className="mb-2">
                                <label className="block text-xs font-semibold text-gray-700 mb-1 truncate">
                                  {field.label || 'Dropdown'} {field.required && <span className="text-red-500">*</span>}
                                </label>
                                <div className="w-full h-10 border border-gray-300 rounded-lg bg-gray-50 px-3 flex items-center justify-between">
                                  <span className="text-gray-400 text-xs text-opacity-70">Select...</span>
                                  <span className="text-gray-500 text-xs">▼</span>
                                </div>
                              </div>
                            )}
                            {['checkbox', 'radio'].includes(field.type) && (
                              <div className="mb-2">
                                <label className="block text-xs font-semibold text-gray-700 mb-1 truncate">
                                  {field.label || 'Choices'} {field.required && <span className="text-red-500">*</span>}
                                </label>
                                <div className="space-y-2">
                                  {(field.options && field.options.length > 0 ? field.options : ['Option 1']).map((opt, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                      <div className={`w-4 h-4 border border-gray-300 flex-shrink-0 ${field.type === 'radio' ? 'rounded-full' : 'rounded'} bg-gray-50`}></div>
                                      <span className="text-xs text-gray-600 break-words">{opt}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {field.type === 'submit' && (
                              <div className="mt-6 mb-4">
                                <div className="w-full py-2.5 bg-[#00A884] text-white rounded-lg flex items-center justify-center font-semibold text-sm shadow-sm px-4 text-center">
                                  {field.label || 'Submit'}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                        {flowData.fields.length === 0 && (
                          <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                            <span className="text-3xl mb-2">📱</span>
                            <span className="text-xs text-center px-4">Your interface preview will appear here</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default WhatsAppFlowBuilder;

