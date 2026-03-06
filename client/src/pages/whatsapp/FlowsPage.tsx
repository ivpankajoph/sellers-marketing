import React, { useEffect, useMemo, useState } from 'react';
import {
  Loader2,
  RefreshCw,
  Sparkles,
  Upload,
  Plus,
  Save,
  Trash2,
  Send,
  ExternalLink,
  Eye,
  FileJson,
  Copy,
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { getAuthHeaders } from '@/contexts/AuthContext';
import { useLocation } from 'wouter';

const API_BASE = '/api/webhook/whatsapp/flows';

const FLOW_CATEGORIES = [
  'SIGN_UP',
  'SIGN_IN',
  'APPOINTMENT_BOOKING',
  'LEAD_GENERATION',
  'CONTACT_US',
  'CUSTOMER_SUPPORT',
  'SURVEY',
  'OTHER',
] as const;

type FlowCategory = (typeof FLOW_CATEGORIES)[number];

interface FlowRecord {
  _id: string;
  flowId: string;
  name: string;
  status: 'DRAFT' | 'PUBLISHED' | 'DEPRECATED' | 'BLOCKED' | 'THROTTLED';
  categories: string[];
  endpointUri?: string;
  previewUrl?: string;
  previewExpiresAt?: string;
  validationErrors?: string[];
  draftValidationErrors?: string[];
  jsonVersion?: string;
  dataApiVersion?: string;
  updatedAt?: string;
  lastSyncedAt?: string;
}

interface FlowListResponse {
  flows: FlowRecord[];
  total: number;
}

interface FlowMetaResponse {
  success: boolean;
  flow: FlowRecord;
  meta: Record<string, unknown>;
}

interface FlowAsset {
  id: string;
  name?: string;
  asset_type?: string;
}

interface FlowAssetsResponse {
  success: boolean;
  data?: FlowAsset[];
}

interface FlowAssetDownloadResponse {
  success: boolean;
  asset: FlowAsset;
  text: string;
}

function withPreviewCacheBuster(rawUrl: string, nonce: number): string {
  try {
    const url = new URL(rawUrl);
    url.searchParams.set('_ts', String(nonce));
    return url.toString();
  } catch {
    const separator = rawUrl.includes('?') ? '&' : '?';
    return `${rawUrl}${separator}_ts=${nonce}`;
  }
}

interface CreateFlowForm {
  name: string;
  categories: FlowCategory[];
  endpointUri: string;
  cloneFlowId: string;
}

interface SendTestForm {
  phoneNumber: string;
  mode: 'published' | 'draft';
  ctaText: string;
  headerText: string;
  bodyText: string;
  footerText: string;
  screen: string;
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...getAuthHeaders(),
    ...(init?.headers as Record<string, string>),
  };

  if (init?.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(path, { ...init, headers });
  const rawText = await response.text();
  let payload: any = {};

  if (rawText) {
    try {
      payload = JSON.parse(rawText);
    } catch {
      payload = { error: rawText };
    }
  }

  if (!response.ok) {
    const baseMessage = payload.error || payload.message || `Request failed (${response.status})`;
    const hint = payload.hint ? ` Hint: ${payload.hint}` : '';
    throw new Error(`${baseMessage}${hint}`);
  }

  return payload as T;
}

function statusClass(status?: string) {
  const v = String(status || '').toUpperCase();
  if (v === 'PUBLISHED') return 'bg-green-100 text-green-700 border-green-200';
  if (v === 'DRAFT') return 'bg-amber-100 text-amber-700 border-amber-200';
  if (v === 'DEPRECATED') return 'bg-slate-100 text-slate-700 border-slate-200';
  if (v === 'BLOCKED') return 'bg-red-100 text-red-700 border-red-200';
  if (v === 'THROTTLED') return 'bg-orange-100 text-orange-700 border-orange-200';
  return 'bg-gray-100 text-gray-700 border-gray-200';
}

function toPretty(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function WhatsAppFlowsPage() {
  const [, setLocation] = useLocation();
  const [flows, setFlows] = useState<FlowRecord[]>([]);
  const [totalFlows, setTotalFlows] = useState(0);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  const [selectedFlow, setSelectedFlow] = useState<FlowRecord | null>(null);
  const [selectedMeta, setSelectedMeta] = useState<Record<string, unknown> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [assets, setAssets] = useState<FlowAsset[]>([]);
  const [assetViewer, setAssetViewer] = useState<FlowAssetDownloadResponse | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<CreateFlowForm>({
    name: '',
    categories: ['OTHER'],
    endpointUri: '',
    cloneFlowId: '',
  });
  const [metaForm, setMetaForm] = useState({
    name: '',
    endpointUri: '',
    categoriesCsv: '',
  });
  const [sendTestForm, setSendTestForm] = useState<SendTestForm>({
    phoneNumber: '',
    mode: 'published',
    ctaText: 'Start',
    headerText: 'Flow Message',
    bodyText: 'Please complete this flow',
    footerText: '',
    screen: '0',
  });
  const [sendingTest, setSendingTest] = useState(false);
  const [previewNonce, setPreviewNonce] = useState<number>(Date.now());

  const selectedFlowFromList = useMemo(
    () => flows.find((flow) => flow._id === selectedFlowId) || null,
    [flows, selectedFlowId]
  );

  const previewSrc = useMemo(() => {
    if (!selectedFlow?.previewUrl) return '';
    return withPreviewCacheBuster(selectedFlow.previewUrl, previewNonce);
  }, [selectedFlow?.previewUrl, previewNonce]);

  async function loadFlows() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter) params.set('status', statusFilter);
      const data = await apiRequest<FlowListResponse>(`${API_BASE}${params.toString() ? `?${params.toString()}` : ''}`);
      setFlows(data.flows || []);
      setTotalFlows(data.total || 0);
      if (!selectedFlowId && data.flows.length > 0) setSelectedFlowId(data.flows[0]._id);
      if (selectedFlowId && !data.flows.find((flow) => flow._id === selectedFlowId)) {
        setSelectedFlowId(data.flows[0]?._id || null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load flows');
    } finally {
      setLoading(false);
    }
  }

  async function loadAssets(id: string) {
    try {
      const assetsData = await apiRequest<FlowAssetsResponse>(`${API_BASE}/${id}/assets`);
      setAssets(Array.isArray(assetsData.data) ? assetsData.data : []);
    } catch (err: any) {
      setAssets([]);
      setError(err.message || 'Failed to load assets');
    }
  }

  async function loadSelectedFlow(id: string) {
    setDetailLoading(true);
    setError(null);
    try {
      const response = await apiRequest<FlowMetaResponse>(`${API_BASE}/${id}/meta`);
      setSelectedFlow(response.flow);
      setSelectedMeta(response.meta || null);
      setPreviewNonce(Date.now());
      setMetaForm({
        name: response.flow.name || '',
        endpointUri: response.flow.endpointUri || '',
        categoriesCsv: (response.flow.categories || []).join(', '),
      });
      await loadAssets(id);
    } catch (err: any) {
      setError(err.message || 'Failed to load flow details');
    } finally {
      setDetailLoading(false);
    }
  }

  async function syncFlows() {
    setSyncing(true);
    setError(null);
    try {
      await apiRequest(`${API_BASE}/sync`, { method: 'POST' });
      setMessage('Flow sync completed');
      await loadFlows();
      if (selectedFlowId) await loadSelectedFlow(selectedFlowId);
    } catch (err: any) {
      setError(err.message || 'Failed to sync flows');
    } finally {
      setSyncing(false);
    }
  }

  async function createFlow() {
    if (!createForm.name.trim()) {
      setError('Flow name is required');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const result = await apiRequest<{ success: boolean; flow: FlowRecord }>(`${API_BASE}/create`, {
        method: 'POST',
        body: JSON.stringify({
          name: createForm.name.trim(),
          categories: createForm.categories,
          endpointUri: createForm.endpointUri.trim() || undefined,
          cloneFlowId: createForm.cloneFlowId || undefined,
        }),
      });
      setMessage('Flow created');
      setCreateForm({ name: '', categories: ['OTHER'], endpointUri: '', cloneFlowId: '' });
      await loadFlows();
      if (result.flow?._id) setSelectedFlowId(result.flow._id);
    } catch (err: any) {
      setError(err.message || 'Failed to create flow');
    } finally {
      setCreating(false);
    }
  }

  async function updateMetadata() {
    if (!selectedFlowId) return;
    const categories = metaForm.categoriesCsv.split(',').map((item) => item.trim()).filter(Boolean);
    try {
      await apiRequest(`${API_BASE}/${selectedFlowId}/meta`, {
        method: 'POST',
        body: JSON.stringify({
          name: metaForm.name.trim() || undefined,
          endpointUri: metaForm.endpointUri.trim(),
          categories,
        }),
      });
      setMessage('Flow metadata updated');
      await loadSelectedFlow(selectedFlowId);
      await loadFlows();
    } catch (err: any) {
      setError(err.message || 'Failed to update metadata');
    }
  }

  async function publishFlow() {
    if (!selectedFlowId) return;
    try {
      await apiRequest(`${API_BASE}/${selectedFlowId}/publish-meta`, { method: 'POST' });
      setMessage('Flow published');
      await loadSelectedFlow(selectedFlowId);
      await loadFlows();
    } catch (err: any) {
      setError(err.message || 'Failed to publish flow');
    }
  }

  async function refreshPreview() {
    if (!selectedFlowId) return;
    try {
      const response = await apiRequest<FlowMetaResponse>(`${API_BASE}/${selectedFlowId}/preview/refresh`, { method: 'POST' });
      setSelectedFlow(response.flow);
      setSelectedMeta(response.meta || null);
      setPreviewNonce(Date.now());
      await loadAssets(selectedFlowId);
      setMessage('Preview refreshed');
      await loadFlows();
    } catch (err: any) {
      setError(err.message || 'Failed to refresh preview');
    }
  }

  async function cloneFlow() {
    if (!selectedFlowId || !selectedFlow) return;
    try {
      const cloneName = `${selectedFlow.name}_copy_${Date.now()}`;
      const response = await apiRequest<{ success: boolean; flow: FlowRecord }>(`${API_BASE}/${selectedFlowId}/clone`, {
        method: 'POST',
        body: JSON.stringify({
          name: cloneName,
          categories: selectedFlow.categories,
          endpointUri: selectedFlow.endpointUri,
        }),
      });
      setMessage(`Flow cloned: ${cloneName}`);
      await loadFlows();
      if (response.flow?._id) setSelectedFlowId(response.flow._id);
    } catch (err: any) {
      setError(err.message || 'Failed to clone flow');
    }
  }

  async function deprecateFlow() {
    if (!selectedFlowId) return;
    if (!window.confirm('Deprecate this flow in Meta?')) return;
    try {
      await apiRequest(`${API_BASE}/${selectedFlowId}/deprecate`, { method: 'POST' });
      setMessage('Flow deprecated');
      await loadSelectedFlow(selectedFlowId);
      await loadFlows();
    } catch (err: any) {
      setError(err.message || 'Failed to deprecate flow');
    }
  }

  async function deleteDraftFlow() {
    if (!selectedFlowId || !selectedFlow || selectedFlow.status !== 'DRAFT') return;
    if (!window.confirm('Delete this draft flow from Meta?')) return;
    try {
      await apiRequest(`${API_BASE}/${selectedFlowId}/meta`, { method: 'DELETE' });
      setMessage('Draft deleted');
      setSelectedFlowId(null);
      setSelectedFlow(null);
      setSelectedMeta(null);
      setAssets([]);
      await loadFlows();
    } catch (err: any) {
      setError(err.message || 'Failed to delete draft');
    }
  }

  async function sendTest() {
    if (!selectedFlowId) return;
    if (!sendTestForm.phoneNumber.trim()) {
      setError('Phone number is required');
      return;
    }
    setSendingTest(true);
    try {
      const response = await apiRequest<{ success: boolean; messageId: string }>(`${API_BASE}/${selectedFlowId}/send-test`, {
        method: 'POST',
        body: JSON.stringify({
          phoneNumber: sendTestForm.phoneNumber,
          mode: sendTestForm.mode,
          ctaText: sendTestForm.ctaText,
          headerText: sendTestForm.headerText,
          bodyText: sendTestForm.bodyText,
          footerText: sendTestForm.footerText,
          screen: sendTestForm.screen,
          flowAction: 'navigate',
        }),
      });
      setMessage(`Test accepted: ${response.messageId}`);
    } catch (err: any) {
      setError(err.message || 'Failed to send test');
    } finally {
      setSendingTest(false);
    }
  }

  async function openAssetViewer(asset: FlowAsset) {
    if (!selectedFlowId || !asset.id) return;
    try {
      const data = await apiRequest<FlowAssetDownloadResponse>(`${API_BASE}/${selectedFlowId}/assets/${asset.id}/download`);
      setAssetViewer(data);
    } catch (err: any) {
      setError(err.message || 'Failed to open asset');
    }
  }

  useEffect(() => {
    loadFlows();
  }, []);

  useEffect(() => {
    if (!selectedFlowId) return;
    loadSelectedFlow(selectedFlowId);
  }, [selectedFlowId]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 4500);
    return () => clearTimeout(timer);
  }, [message]);

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-[1400px] space-y-6">
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold text-slate-900">WhatsApp Flows</h1>
                <p className="text-sm text-slate-600">Create, publish, preview, test, and monitor Meta flows from dashboard.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setLocation('/create-whatsappflow')} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
                  <Upload className="h-4 w-4" />
                  Open Builder
                </button>
                <button onClick={loadFlows} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50">
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
                <button onClick={syncFlows} disabled={syncing} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-50">
                  <Sparkles className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                  Sync from Meta
                </button>
              </div>
            </div>
            {message && <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div>}
            {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          </div>

          <div className="grid gap-6 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-4">
              <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <h2 className="mb-3 text-lg font-semibold text-slate-900">Create Flow</h2>
                <div className="space-y-3">
                  <input value={createForm.name} onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))} placeholder="Flow name" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  <input value={createForm.endpointUri} onChange={(e) => setCreateForm((p) => ({ ...p, endpointUri: e.target.value }))} placeholder="Endpoint URI (optional)" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  <select value={createForm.cloneFlowId} onChange={(e) => setCreateForm((p) => ({ ...p, cloneFlowId: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                    <option value="">Create empty flow</option>
                    {flows.map((flow) => (
                      <option key={flow._id} value={flow.flowId}>Clone: {flow.name}</option>
                    ))}
                  </select>
                  <div className="grid grid-cols-1 gap-x-4 gap-y-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-2">
                    {FLOW_CATEGORIES.map((category) => {
                      const checked = createForm.categories.includes(category);
                      return (
                        <label key={category} className="flex min-w-0 items-center gap-2 text-xs text-slate-700">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              setCreateForm((prev) => {
                                const next = new Set(prev.categories);
                                if (e.target.checked) next.add(category);
                                else next.delete(category);
                                const categories = Array.from(next) as FlowCategory[];
                                return { ...prev, categories: categories.length > 0 ? categories : ['OTHER'] };
                              });
                            }}
                          />
                          <span className="truncate">{category}</span>
                        </label>
                      );
                    })}
                  </div>
                  <button onClick={createFlow} disabled={creating} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50">
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Create Flow
                  </button>
                </div>
              </div>

              <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <h2 className="mb-3 text-lg font-semibold text-slate-900">Flows ({totalFlows})</h2>
                <div className="mb-3 grid gap-2 sm:grid-cols-2">
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                    <option value="">All status</option>
                    <option value="DRAFT">Draft</option>
                    <option value="PUBLISHED">Published</option>
                    <option value="DEPRECATED">Deprecated</option>
                    <option value="BLOCKED">Blocked</option>
                    <option value="THROTTLED">Throttled</option>
                  </select>
                </div>
                <button onClick={loadFlows} className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">Apply Filters</button>
                <div className="max-h-[460px] space-y-2 overflow-auto pr-1">
                  {loading ? (
                    <div className="flex items-center justify-center py-10 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /></div>
                  ) : flows.length === 0 ? (
                    <p className="py-8 text-center text-sm text-slate-500">No flows found.</p>
                  ) : (
                    flows.map((flow) => (
                      <button key={flow._id} onClick={() => setSelectedFlowId(flow._id)} className={`w-full rounded-xl border p-3 text-left ${flow._id === selectedFlowId ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <p className="line-clamp-1 text-sm font-medium text-slate-900">{flow.name}</p>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusClass(flow.status)}`}>{flow.status}</span>
                        </div>
                        <p className="line-clamp-1 text-xs text-slate-500">Flow ID: {flow.flowId}</p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-6 lg:col-span-8">
              {!selectedFlowId ? (
                <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200 text-slate-500">Select a flow to open controls.</div>
              ) : detailLoading ? (
                <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200 text-slate-500"><Loader2 className="inline h-5 w-5 animate-spin" /> Loading...</div>
              ) : selectedFlow ? (
                <>
                  <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="text-xl font-semibold text-slate-900">{selectedFlow.name}</h2>
                        <p className="text-xs text-slate-500">Flow ID: {selectedFlow.flowId}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(selectedFlow.status)}`}>{selectedFlow.status}</span>
                        <button onClick={() => setLocation(`/create-whatsappflow/${selectedFlow._id}`)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700 hover:bg-slate-100">Open Draft Builder</button>
                        <button onClick={publishFlow} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs text-white hover:bg-emerald-700">Publish</button>
                        <button onClick={refreshPreview} className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700 hover:bg-slate-100">Refresh Preview</button>
                        <button onClick={cloneFlow} className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700 hover:bg-slate-100">Clone</button>
                        <button onClick={deprecateFlow} className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700 hover:bg-amber-100">Deprecate</button>
                        <button onClick={deleteDraftFlow} disabled={selectedFlow.status !== 'DRAFT'} className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 hover:bg-red-100 disabled:opacity-40"><Trash2 className="mr-1 inline h-3.5 w-3.5" />Delete Draft</button>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <input value={metaForm.name} onChange={(e) => setMetaForm((p) => ({ ...p, name: e.target.value }))} placeholder="Flow name" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                      <input value={metaForm.endpointUri} onChange={(e) => setMetaForm((p) => ({ ...p, endpointUri: e.target.value }))} placeholder="Endpoint URI" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                      <input value={metaForm.categoriesCsv} onChange={(e) => setMetaForm((p) => ({ ...p, categoriesCsv: e.target.value }))} placeholder="Categories comma separated" className="sm:col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                      <button onClick={updateMetadata} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 sm:col-span-2"><Save className="h-4 w-4" />Save Metadata</button>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-slate-900">Preview</h3>
                      <div className="flex items-center gap-2">
                        <button onClick={refreshPreview} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100">
                          <RefreshCw className="h-3.5 w-3.5" />
                          Refresh URL
                        </button>
                        {selectedFlow.previewUrl && (
                          <>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(selectedFlow.previewUrl || '').catch(() => undefined);
                                setMessage('Preview URL copied');
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                            >
                              <Copy className="h-3.5 w-3.5" />
                              Copy URL
                            </button>
                            <a href={selectedFlow.previewUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700">
                              Open in Meta <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </>
                        )}
                      </div>
                    </div>
                    {selectedFlow.previewExpiresAt && (
                      <p className="mb-2 text-xs text-slate-500">
                        Preview URL expires at: {new Date(selectedFlow.previewExpiresAt).toLocaleString()}
                      </p>
                    )}
                    <p className="mb-3 rounded-lg border border-blue-200 bg-blue-50 p-2 text-xs text-blue-700">
                      This panel renders Meta&apos;s `preview_url` (source of truth), not a local simulation.
                    </p>
                    {selectedFlow.previewUrl ? (
                      <iframe key={`${selectedFlow._id}-${previewNonce}`} title="Flow Preview" src={previewSrc} className="h-[420px] w-full rounded-lg border border-slate-200 bg-white" />
                    ) : (
                      <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">No preview URL yet. Publish and refresh preview.</p>
                    )}
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div>
                        <p className="mb-1 text-xs font-medium text-slate-600">Meta Validation Errors</p>
                        {selectedFlow.validationErrors?.length ? (
                          <ul className="space-y-1 text-xs text-red-700">{selectedFlow.validationErrors.map((item, idx) => <li key={`${item}-${idx}`}>{item}</li>)}</ul>
                        ) : (
                          <p className="text-xs text-emerald-700">No Meta validation errors.</p>
                        )}
                      </div>
                      <div>
                        <p className="mb-1 text-xs font-medium text-slate-600">Draft Validation Errors</p>
                        {selectedFlow.draftValidationErrors?.length ? (
                          <ul className="space-y-1 text-xs text-red-700">{selectedFlow.draftValidationErrors.map((item, idx) => <li key={`${item}-${idx}`}>{item}</li>)}</ul>
                        ) : (
                          <p className="text-xs text-emerald-700">Draft JSON looks valid.</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                      <h3 className="mb-3 text-lg font-semibold text-slate-900">Send Test</h3>
                      <div className="space-y-2">
                        <input value={sendTestForm.phoneNumber} onChange={(e) => setSendTestForm((p) => ({ ...p, phoneNumber: e.target.value }))} placeholder="Phone number with country code" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                        <select value={sendTestForm.mode} onChange={(e) => setSendTestForm((p) => ({ ...p, mode: e.target.value as SendTestForm['mode'] }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                          <option value="published">published (flow_id)</option>
                          <option value="draft">draft (flow_name)</option>
                        </select>
                        <input value={sendTestForm.ctaText} onChange={(e) => setSendTestForm((p) => ({ ...p, ctaText: e.target.value }))} placeholder="CTA text" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                        <textarea value={sendTestForm.bodyText} onChange={(e) => setSendTestForm((p) => ({ ...p, bodyText: e.target.value }))} placeholder="Body text" rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                        <button onClick={sendTest} disabled={sendingTest} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-50">
                          {sendingTest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                          Send Test
                        </button>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-slate-900">Assets</h3>
                        <button onClick={() => selectedFlowId && loadAssets(selectedFlowId)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100">Reload</button>
                      </div>
                      <div className="max-h-64 space-y-2 overflow-auto">
                        {assets.length === 0 ? (
                          <p className="text-sm text-slate-500">No assets found.</p>
                        ) : (
                          assets.map((asset) => (
                            <div key={asset.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-2">
                              <div className="min-w-0">
                                <p className="truncate text-xs font-medium text-slate-800">{asset.name || asset.id}</p>
                                <p className="truncate text-[11px] text-slate-500">{asset.asset_type || '-'}</p>
                              </div>
                              <button onClick={() => openAssetViewer(asset)} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100">
                                <Eye className="h-3.5 w-3.5" />
                                View
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                    <h3 className="mb-3 text-lg font-semibold text-slate-900">Raw Meta Snapshot</h3>
                    <pre className="max-h-80 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">{toPretty(selectedMeta || selectedFlowFromList)}</pre>
                  </div>
                </>
              ) : (
                <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200 text-slate-500">Flow details unavailable.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {assetViewer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-5xl rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <div>
                <h4 className="text-lg font-semibold text-slate-900">Flow Asset JSON</h4>
                <p className="text-xs text-slate-500">Asset ID: {assetViewer.asset?.id}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => navigator.clipboard.writeText(assetViewer.text)} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100">
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </button>
                <button
                  onClick={() => {
                    const blob = new Blob([assetViewer.text], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `${assetViewer.asset?.name || 'flow-asset'}.json`;
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                    URL.revokeObjectURL(url);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100"
                >
                  <FileJson className="h-3.5 w-3.5" />
                  Download
                </button>
                <button onClick={() => setAssetViewer(null)} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs text-white hover:bg-slate-700">Close</button>
              </div>
            </div>
            <div className="max-h-[70vh] overflow-auto p-5">
              <pre className="min-w-full overflow-x-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">{assetViewer.text}</pre>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
