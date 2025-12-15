import React, { useState, useEffect } from 'react';
import { ExternalLink, RefreshCw, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';

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
  preview: {
    preview_url: string;
    expires_at: string;
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
  application: {
    category: string;
    link: string;
    name: string;
    id: string;
  };
}

const API_BASE = 'https://graph.facebook.com/v18.0';
const BEARER_TOKEN = 'EAAO1YPeIbdABQH1TresAdKODLNRGydKZBByQHNNKXsZASpIV5lZAD6MLMGdgL8t3rHGhlZBr089UfdURhsQJTd9aZCsbbGeFSsZAhZAAholXOt5z88zGHxfwNfx0wIEuWSpglj95e5ZAK5u4DlytGbWT6OqNxq4bEuNxAjtAYxnoMVXhAQIWZBo1ZCk77rgvdGkgZDZD';
const WABA_ID = '3646219455517188';

export default function WhatsAppFlowManager() {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [selectedFlow, setSelectedFlow] = useState<FlowDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFlows = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/${WABA_ID}/flows`, {
        headers: {
          'Authorization': `Bearer ${BEARER_TOKEN}`,
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
        `${API_BASE}/${flowId}?fields=id,name,categories,preview,status,validation_errors,json_version,data_api_version,data_channel_uri,health_status,whatsapp_business_account,application`,
        {
          headers: {
            'Authorization': `Bearer ${BEARER_TOKEN}`,
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
            <button
              onClick={fetchFlows}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
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
                    </div>
                  </div>

                  <div className="p-6 space-y-6">
                    {/* Preview */}
                    {selectedFlow.preview && (
                      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-gray-900">Preview</h4>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Clock className="w-4 h-4" />
                            Expires: {new Date(selectedFlow.preview.expires_at).toLocaleDateString()}
                          </div>
                        </div>
                        <a
                          href={selectedFlow.preview.preview_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Open Preview
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    )}

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
                              <span className="text-xs text-gray-500 ml-2">
                                {entity.id}
                              </span>
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
                        <a
                          href={selectedFlow.application.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
                        >
                          View Application
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
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
    </div>
  </DashboardLayout>
  );
}