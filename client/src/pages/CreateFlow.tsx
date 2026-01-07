import React, { useState, useRef, useEffect } from 'react';
import { Plus, Trash2, GripVertical, Save, RefreshCw, XCircle, CheckCircle } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';

// SweetAlert2 CDN
declare global {
  interface Window {
    Swal: any;
  }
}

interface FormField {
  id: string;
  type: 'header' | 'text' | 'textarea' | 'checkbox' | 'radio' | 'select' | 'date' | 'submit';
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
  const [apiResponse, setApiResponse] = useState<string>('');
  const [swalLoaded, setSwalLoaded] = useState(false);
  
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

  const fieldTypes = [
    { type: 'header', icon: '📋', label: 'Header', color: 'from-purple-500 to-purple-600' },
    { type: 'text', icon: '📝', label: 'Text Field', color: 'from-blue-500 to-blue-600' },
    { type: 'textarea', icon: '📄', label: 'Text Area', color: 'from-cyan-500 to-cyan-600' },
    { type: 'checkbox', icon: '☑️', label: 'Checkbox Group', color: 'from-green-500 to-green-600' },
    { type: 'radio', icon: '🔘', label: 'Radio Group', color: 'from-yellow-500 to-yellow-600' },
    { type: 'select', icon: '📋', label: 'Select', color: 'from-orange-500 to-orange-600' },
    { type: 'date', icon: '📅', label: 'Date Field', color: 'from-pink-500 to-pink-600' },
    { type: 'submit', icon: '✅', label: 'Submit Button', color: 'from-indigo-500 to-indigo-600' }
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

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    
    if (draggedItem) {
      const newField: FormField = {
        id: `field-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: draggedItem as FormField['type'],
        label: `New ${draggedItem}`,
        required: false,
        options: ['checkbox', 'radio', 'select'].includes(draggedItem) ? ['Option 1', 'Option 2'] : undefined
      };
      
      setFlowData(prev => ({
        ...prev,
        fields: [...prev.fields, newField]
      }));
      
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

  const createWhatsAppFlow = async () => {
    if (!flowData.flowName || !flowData.flowCategory) {
      if (swalLoaded) {
        window.Swal.fire({
          title: 'Missing Information',
          text: 'Please fill in Flow Name and Flow Category',
          icon: 'error',
          confirmButtonColor: '#3b82f6'
        });
      } else {
        alert('Please fill in Flow Name and Flow Category');
      }
      return;
    }

    setIsLoading(true);
    setApiResponse('');

    try {
      const flowPayload = {
        name: flowData.flowName,
        categories: [flowData.flowCategory],
      };

      const WABA_ID = import.meta.env.VITE_WABA_ID;
      const ACCESS_TOKEN = import.meta.env.VITE_SYSTEM_USER_TOKEN_META; // Replace with your actual token

      const formData = new FormData();
      formData.append('name', flowPayload.name);
      formData.append('categories', JSON.stringify(flowPayload.categories));

      const response = await fetch(`https://graph.facebook.com/v21.0/${WABA_ID}/flows`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
        },
        body: formData
      });

      const data = await response.json();
      
      if (response.ok) {
        setApiResponse(JSON.stringify(data, null, 2));
        
        if (swalLoaded) {
          window.Swal.fire({
            title: 'Success!',
            html: `<p>Flow created successfully!</p><p><strong>Flow ID:</strong> ${data.id}</p>`,
            icon: 'success',
            confirmButtonColor: '#10b981'
          });
        } else {
          alert('✅ Flow created successfully! Flow ID: ' + data.id);
        }
      } else {
        setApiResponse(JSON.stringify(data, null, 2));
        
        if (swalLoaded) {
          window.Swal.fire({
            title: 'Error Creating Flow',
            text: data.error?.message || 'Unknown error occurred',
            icon: 'error',
            confirmButtonColor: '#ef4444'
          });
        } else {
          alert('❌ Error creating flow: ' + (data.error?.message || 'Unknown error'));
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setApiResponse(`Error: ${errorMessage}`);
      
      if (swalLoaded) {
        window.Swal.fire({
          title: 'Connection Error',
          text: errorMessage,
          icon: 'error',
          confirmButtonColor: '#ef4444'
        });
      } else {
        alert('❌ Failed to create flow: ' + errorMessage);
      }
    } finally {
      setIsLoading(false);
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
                  <div
                    key={field.type}
                    draggable
                    onDragStart={(e) => handleDragStart(e, field.type)}
                    className={`flex items-center gap-3 p-4 bg-gradient-to-r ${field.color} text-white rounded-xl cursor-move hover:shadow-lg hover:scale-105 transition-all duration-200`}
                  >
                    <span className="text-2xl">{field.icon}</span>
                    <span className="text-sm font-semibold">{field.label}</span>
                  </div>
                ))}
              </div>

              <div className="mt-8 pt-6 border-t-2 border-gray-200 space-y-3">
                <button
                  onClick={createWhatsAppFlow}
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-3 px-4 rounded-xl hover:from-green-600 hover:to-green-700 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl font-semibold"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Save Flow
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
          <div className="col-span-3">
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
                    <p className="text-lg font-medium">Drag components here to build your flow</p>
                    <p className="text-sm mt-2">Start by dragging a field from the left panel</p>
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
                            
                            {field.type === 'header' && (
                              <h2 className="text-2xl font-bold text-gray-800 py-2">{field.label}</h2>
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
        </div>
      </div>
    </div>
   </DashboardLayout>
  );
};

export default WhatsAppFlowBuilder;