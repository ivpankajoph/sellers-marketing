import React, { useState, useEffect } from 'react';
import {
  ExternalLink,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Clock,
  Plus,
  X,
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';

// ===== PHONE PREVIEW MOCK COMPONENT =====
const PhonePreviewMock = ({
  title,
  subtitle,
  content,
  buttons = [] as string[],
  headerTitle = "Welcome",
  showCloseButton = true,
}: {
  title: string;
  subtitle?: string;
  content: string;
  buttons?: string[];
  headerTitle?: string;
  showCloseButton?: boolean;
}) => {
  return (
    <div className="flex justify-center">
      <div className="relative bg-gray-900 rounded-3xl overflow-hidden" style={{ height: '500px', width: '300px' }}>
        {/* Status Bar */}
        <div className="h-8 bg-black flex items-center justify-between px-3 text-white text-xs">
          <span>9:41 AM</span>
          <div className="flex gap-1">
            <div className="w-2 h-2 bg-white rounded-full"></div>
            <div className="w-2 h-2 bg-white rounded-full"></div>
            <div className="w-2 h-2 bg-white rounded-full"></div>
          </div>
        </div>

        {/* App Header */}
        <div className="bg-white px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <div className="w-5"></div> {/* Spacer for back button */}
          <h3 className="text-sm font-medium text-gray-900">{headerTitle}</h3>
          {showCloseButton && (
            <button className="text-gray-500 hover:text-gray-700">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-4 bg-white h-[calc(100%-4rem)] overflow-y-auto">
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900">{title}</h2>
            {subtitle && <p className="text-sm text-gray-600">{subtitle}</p>}
            <div className="text-sm text-gray-800 whitespace-pre-line">{content}</div>

            {/* Buttons as Radio Options */}
            {buttons.length > 0 && (
              <div className="mt-4 space-y-2">
                {buttons.map((btn, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-800">{btn}</span>
                    <div className="w-5 h-5 border border-gray-300 rounded-full flex items-center justify-center">
                      <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Next Button */}
            <button className="w-full mt-6 py-2 bg-gray-100 text-gray-800 rounded-lg font-medium hover:bg-gray-200 transition-colors">
              Next
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 text-xs text-gray-500 text-center">
          Managed by the business. <a href="#" className="text-blue-600 hover:underline">Learn more</a>
        </div>
      </div>
    </div>
  );
};

// ===== MAIN COMPONENT =====
interface Flow {
  id: string;
  name: string;
  status: string;
  categories: string[];
  validation_errors: any[];
}

interface FlowDetail {
  id: string;
  name: string;
  categories: string[];
  preview?: {
    preview_url?: string;
    expires_at?: string;
  };
  status: string;
  validation_errors: any[];
  json_version: string;
  data_api_version: string;
  health_status: {
    can_send_message: string;
    entities: Array<{
      entity_type: string;
      id: string;
      can_send_message: string;
    }>;
  };
  whatsapp_business_account: {
    id: string;
    name: string;
    currency: string;
    timezone_id: string;
    message_template_namespace: string;
  };
  application?: {
    category: string;
    link?: string;
    name: string;
    id: string;
  };
}

// ✅ Fixed: Removed trailing space in API_BASE
const API_BASE = 'https://graph.facebook.com/v21.0';
const BEARER_TOKEN = 'EAAO1YPeIbdABQH1TresAdKODLNRGydKZBByQHNNKXsZASpIV5lZAD6MLMGdgL8t3rHGhlZBr089UfdURhsQJTd9aZCsbbGeFSsZAhZAAholXOt5z88zGHxfwNfx0wIEuWSpglj95e5ZAK5u4DlytGbWT6OqNxq4bEuNxAjtAYxnoMVXhAQIWZBo1ZCk77rgvdGkgZDZD';
const WABA_ID = '3646219455517188';

export default function WhatsAppFlowManager() {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [selectedFlow, setSelectedFlow] = useState<FlowDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    categories: 'OTHER',
    endpoint_uri: '',
  });

  const fetchFlows = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/${WABA_ID}/flows`, {
        headers: {
          Authorization: `Bearer ${BEARER_TOKEN}`,
        },
      });
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error.message);
      }
      setFlows(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch flows');
    } finally {
      setLoading(false);
    }
  };

  const fetchFlowDetail = async (flowId: string) => {
    setDetailLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${API_BASE}/${flowId}?fields=id,name,categories,preview,status,validation_errors,json_version,data_api_version,health_status,whatsapp_business_account,application`,
        {
          headers: {
            Authorization: `Bearer ${BEARER_TOKEN}`,
          },
        }
      );
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error.message);
      }
      setSelectedFlow(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch flow details');
    } finally {
      setDetailLoading(false);
    }
  };

  const publishFlow = async (flowId: string) => {
    if (publishing) return;
    setPublishing(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/${flowId}/publish`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${BEARER_TOKEN}`,
        },
      });
      const result = await response.json();
      if (result.error) {
        throw new Error(result.error.message);
      }

      // Refresh flow details to reflect new status
      await fetchFlowDetail(flowId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish flow');
    } finally {
      setPublishing(false);
    }
  };

  const handleCreateFlow = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);

    const formData = new FormData();
    formData.append('name', createForm.name);
    formData.append('categories', JSON.stringify([createForm.categories]));
    if (createForm.endpoint_uri) {
      formData.append('endpoint_uri', createForm.endpoint_uri);
    }

    try {
      const response = await fetch(`${API_BASE}/${WABA_ID}/flows`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${BEARER_TOKEN}`,
        },
        body: formData,
      });

      const result = await response.json();

      if (result.error) {
        throw new Error(result.error.message);
      }

      await fetchFlows();
      setShowCreateModal(false);
      setCreateForm({ name: '', categories: 'OTHER', endpoint_uri: '' });

      if (result.preview?.preview_url) {
        window.open(result.preview.preview_url, '_blank');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create flow');
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => {
    fetchFlows();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'published':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'draft':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getHealthStatusIcon = (status: string) => {
    return status === 'AVAILABLE' ? (
      <CheckCircle className="w-4 h-4 text-green-600" />
    ) : (
      <AlertCircle className="w-4 h-4 text-red-600" />
    );
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  WhatsApp Flow Manager
                </h1>
                <p className="text-gray-600">Manage and monitor your WhatsApp flows</p>
              </div>
              <div className="flex gap-3">
                {/* <button
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Create Flow
                </button> */}
                <button
                  onClick={fetchFlows}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Flow List */}
              <div className="lg:col-span-1">
                <h2 className="text-xl font-semibold mb-4 text-gray-800">Available Flows</h2>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="w-8 h-8 animate-spin text-green-600" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    {flows.map((flow) => (
                      <button
                        key={flow.id}
                        onClick={() => fetchFlowDetail(flow.id)}
                        className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                          selectedFlow?.id === flow.id
                            ? 'border-green-500 bg-green-50'
                            : 'border-gray-200 hover:border-green-300 bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-semibold text-gray-900">{flow.name}</h3>
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(
                              flow.status
                            )}`}
                          >
                            {flow.status}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {flow.categories.map((cat) => (
                            <span
                              key={cat}
                              className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full"
                            >
                              {cat}
                            </span>
                          ))}
                        </div>
                      </button>
                    ))}
                    {flows.length === 0 && !loading && (
                      <p className="text-gray-500 text-center py-8">No flows available</p>
                    )}
                  </div>
                )}
              </div>

              {/* Flow Details */}
              <div className="lg:col-span-2">
                <h2 className="text-xl font-semibold mb-4 text-gray-800">Flow Details</h2>
                {detailLoading ? (
                  <div className="flex items-center justify-center py-12 bg-white rounded-lg border-2 border-gray-200">
                    <RefreshCw className="w-8 h-8 animate-spin text-green-600" />
                  </div>
                ) : selectedFlow ? (
                  <div className="bg-white rounded-lg border-2 border-gray-200 overflow-hidden">
                    <div className="p-6 bg-gradient-to-r from-green-600 to-blue-600 text-white">
                      <h3 className="text-2xl font-bold mb-2">{selectedFlow.name}</h3>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="px-3 py-1 bg-white/20 rounded-full">
                          {selectedFlow.status}
                        </span>
                        <span>JSON v{selectedFlow.json_version}</span>
                        <span>API v{selectedFlow.data_api_version}</span>
                        {selectedFlow.status !== 'PUBLISHED' && (
                          <button
                            onClick={() => publishFlow(selectedFlow.id)}
                            disabled={publishing}
                            className="px-3 py-1 bg-orange-500 text-white text-xs rounded hover:bg-orange-600 disabled:opacity-50 flex items-center gap-1"
                          >
                            {publishing ? (
                              <>
                                <RefreshCw className="w-3 h-3 animate-spin" />
                                Publishing...
                              </>
                            ) : (
                              'Publish Flow'
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="p-6 space-y-6">
                      {/* Mobile Preview Mock + Real Link */}
                      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-semibold text-gray-900">Phone Preview</h4>
                          {selectedFlow.preview?.expires_at && (
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Clock className="w-4 h-4" />
                              Expires: {new Date(selectedFlow.preview.expires_at).toLocaleDateString()}
                            </div>
                          )}
                        </div>

                        {/* Static Mock Preview */}
                        <div className="mb-4">
                          <PhonePreviewMock
                            title={selectedFlow.name}
                            subtitle="To serve you better, please select your category:"
                            content={`Your Category\nCompany/Startup 🏢\nPersonal Brand 👤`}
                            buttons={["Company/Startup 🏢", "Personal Brand 👤"]}
                            headerTitle="Welcome"
                          />
                        </div>

                        {/* Real Preview Link */}
                        {selectedFlow.preview?.preview_url && (
                          <a
                            href={selectedFlow.preview.preview_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
                          >
                            Open in Meta Flow Builder
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>

                      {/* Health Status */}
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-3">Health Status</h4>
                        <div className="space-y-2">
                          {selectedFlow.health_status.entities.map((entity, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                            >
                              <div>
                                <span className="font-medium text-gray-900">
                                  {entity.entity_type}
                                </span>
                                <span className="text-xs text-gray-500 ml-2">{entity.id}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {getHealthStatusIcon(entity.can_send_message)}
                                <span className="text-sm text-gray-700">
                                  {entity.can_send_message}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* WhatsApp Business Account */}
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-3">
                          WhatsApp Business Account
                        </h4>
                        <div className="grid grid-cols-2 gap-4 p-4 bg-green-50 rounded-lg border border-green-200">
                          <div>
                            <p className="text-xs text-gray-600 mb-1">Name</p>
                            <p className="font-medium text-gray-900">
                              {selectedFlow.whatsapp_business_account.name}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 mb-1">Currency</p>
                            <p className="font-medium text-gray-900">
                              {selectedFlow.whatsapp_business_account.currency}
                            </p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-xs text-gray-600 mb-1">ID</p>
                            <p className="font-mono text-sm text-gray-700">
                              {selectedFlow.whatsapp_business_account.id}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Application */}
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-3">Application</h4>
                        {selectedFlow.application ? (
                          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="flex items-center justify-between mb-2">
                              <p className="font-medium text-gray-900">
                                {selectedFlow.application.name}
                              </p>
                              <span className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded-full">
                                {selectedFlow.application.category}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">
                              ID: {selectedFlow.application.id}
                            </p>
                            {selectedFlow.application.link && (
                              <a
                                href={selectedFlow.application.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
                              >
                                View Application
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            )}
                          </div>
                        ) : (
                          <p className="text-gray-500 italic">No associated application</p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-12 bg-white rounded-lg border-2 border-gray-200">
                    <p className="text-gray-500">Select a flow to view details</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Create Flow Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold text-gray-900">Create New Flow</h3>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <form onSubmit={handleCreateFlow}>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Flow Name
                      </label>
                      <input
                        type="text"
                        required
                        value={createForm.name}
                        onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        placeholder="e.g. Order Confirmation"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Category
                      </label>
                      <select
                        value={createForm.categories}
                        onChange={(e) =>
                          setCreateForm({ ...createForm, categories: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      >
                        <option value="OTHER">Other</option>
                        <option value="SURVEY">Survey</option>
                        <option value="APPOINTMENT_BOOKING">Appointment Booking</option>
                        <option value="CART_ABANDONMENT">Cart Abandonment</option>
                        <option value="LEAD_GENERATION">Lead Generation</option>
                        <option value="TICKETING">Ticketing</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Data Endpoint URI (optional)
                      </label>
                      <input
                        type="url"
                        value={createForm.endpoint_uri}
                        onChange={(e) =>
                          setCreateForm({ ...createForm, endpoint_uri: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        placeholder="https://your-server.com/flow-data"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Your server endpoint to provide dynamic data
                      </p>
                    </div>
                  </div>

                  {error && !loading && !creating && (
                    <div className="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">
                      {error}
                    </div>
                  )}

                  <div className="flex gap-3 mt-6">
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={creating}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {creating ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Create Flow'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}