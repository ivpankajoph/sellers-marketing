import { Types } from 'mongoose';
import { WhatsAppFlow, IWhatsAppFlow, FlowSyncCheckpoint } from './flows.model';
import * as integrationService from '../integrations/integration.service';
import * as credentialsService from '../credentials/credentials.service';

const GRAPH_API_VERSION = process.env.WHATSAPP_GRAPH_API_VERSION || 'v21.0';

const EXTENDED_FLOW_FIELDS = [
  'id',
  'name',
  'status',
  'categories',
  'validation_errors',
  'json_version',
  'data_api_version',
  'data_channel_uri',
  'endpoint_uri',
  'preview',
  'updated_at',
  'health_status',
  'application',
  'whatsapp_business_account',
].join(',');

const SAFE_FLOW_FIELDS = [
  'id',
  'name',
  'status',
  'categories',
  'validation_errors',
  'json_version',
  'data_api_version',
  'data_channel_uri',
  'endpoint_uri',
  'preview',
  'updated_at',
].join(',');

const DEFAULT_METRIC_NAMES = [
  'ENDPOINT_REQUEST_COUNT',
  'ENDPOINT_REQUEST_ERROR',
  'ENDPOINT_REQUEST_ERROR_RATE',
  'ENDPOINT_REQUEST_LATENCY_SECONDS_CEIL_P50',
  'ENDPOINT_REQUEST_LATENCY_SECONDS_CEIL_P90',
  'ENDPOINT_REQUEST_LATENCY_SECONDS_CEIL_P95',
  'ENDPOINT_REQUEST_LATENCY_SECONDS_CEIL_P99',
];

interface MetaPreview {
  preview_url?: string;
  expires_at?: string;
}

interface MetaValidationError {
  error?: string;
  message?: string;
  details?: string;
}

interface MetaFlowResponse {
  id: string;
  name: string;
  status: string;
  categories?: string[];
  validation_errors?: MetaValidationError[];
  json_version?: string;
  data_api_version?: string;
  data_channel_uri?: string;
  endpoint_uri?: string;
  preview?: MetaPreview;
  updated_at?: string;
  health_status?: Record<string, unknown>;
  whatsapp_business_account?: Record<string, unknown>;
  application?: Record<string, unknown>;
}

interface MetaFlowsListResponse {
  data: MetaFlowResponse[];
  paging?: {
    cursors?: {
      after?: string;
      before?: string;
    };
    next?: string;
  };
}

interface FlowCredentials {
  accessToken: string;
  wabaId?: string;
  phoneNumberId?: string;
  appId?: string;
}

interface MetaRequestOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  token: string;
  query?: Record<string, unknown>;
  body?: unknown;
}

type MetaApiError = Error & {
  status?: number;
  code?: number;
  subcode?: number;
  details?: string;
  fbtraceId?: string;
  meta?: unknown;
};

function toSafeDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function normalizeStatus(status?: string): IWhatsAppFlow['status'] {
  const normalized = String(status || '').toUpperCase();
  if (
    normalized === 'DRAFT' ||
    normalized === 'PUBLISHED' ||
    normalized === 'DEPRECATED' ||
    normalized === 'BLOCKED' ||
    normalized === 'THROTTLED'
  ) {
    return normalized;
  }

  return 'DRAFT';
}

function parseValidationErrors(errors?: MetaValidationError[]): string[] {
  if (!Array.isArray(errors)) return [];
  return errors
    .map((item) => item?.error || item?.message || item?.details)
    .filter((value): value is string => Boolean(value));
}

function extractMetaError(responsePayload: unknown, statusCode: number): MetaApiError {
  const payload = responsePayload as Record<string, any>;
  const errorObject = payload?.error || payload;
  const error = new Error(
    errorObject?.message || `Meta API request failed (${statusCode})`
  ) as MetaApiError;

  error.status = statusCode;
  error.code = errorObject?.code;
  error.subcode = errorObject?.error_subcode;
  error.fbtraceId = errorObject?.fbtrace_id;
  error.details = errorObject?.error_data?.details;
  error.meta = payload;

  return error;
}

function isFlowFieldPermissionError(error: unknown): boolean {
  const err = error as MetaApiError;
  const message = String(err?.message || '').toLowerCase();
  const details = String(err?.details || '').toLowerCase();

  if (Number(err?.code) !== 200) return false;

  return (
    message.includes('permission') ||
    message.includes('access this field') ||
    details.includes('permission') ||
    details.includes('access this field')
  );
}

function appendQueryParams(url: URL, query?: Record<string, unknown>) {
  if (!query) return;

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;

    if (Array.isArray(value)) {
      for (const item of value) {
        if (item === undefined || item === null || item === '') continue;
        url.searchParams.append(key, String(item));
      }
      continue;
    }

    url.searchParams.append(key, String(value));
  }
}

async function requestMeta<T = any>(path: string, options: MetaRequestOptions): Promise<T> {
  const baseUrl = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/${path.replace(/^\//, '')}`);
  appendQueryParams(baseUrl, options.query);

  const method = options.method || 'GET';
  const headers: Record<string, string> = {
    Authorization: `Bearer ${options.token}`,
  };

  let body: BodyInit | undefined;
  if (options.body !== undefined && options.body !== null) {
    if (options.body instanceof FormData) {
      body = options.body;
    } else {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(options.body);
    }
  }

  const response = await fetch(baseUrl.toString(), {
    method,
    headers,
    body,
  });

  const rawText = await response.text();
  let payload: any = {};

  if (rawText) {
    try {
      payload = JSON.parse(rawText);
    } catch {
      payload = { raw: rawText };
    }
  }

  if (!response.ok) {
    throw extractMetaError(payload, response.status);
  }

  return payload as T;
}

function buildFlowLookupQuery(userId: string, idOrFlowId: string) {
  const conditions: Record<string, unknown>[] = [{ flowId: idOrFlowId }];

  if (Types.ObjectId.isValid(idOrFlowId)) {
    conditions.push({ _id: new Types.ObjectId(idOrFlowId) });
  }

  return {
    userId,
    $or: conditions,
  };
}

async function getFlowDocumentOrThrow(userId: string, idOrFlowId: string): Promise<IWhatsAppFlow> {
  const flow = await WhatsAppFlow.findOne(buildFlowLookupQuery(userId, idOrFlowId));
  if (!flow) {
    throw new Error('Flow not found');
  }

  return flow;
}

function mapMetaFlowToLocal(userId: string, flow: MetaFlowResponse) {
  return {
    userId,
    flowId: flow.id,
    name: flow.name,
    status: normalizeStatus(flow.status),
    categories: Array.isArray(flow.categories) ? flow.categories : [],
    validationErrors: parseValidationErrors(flow.validation_errors),
    jsonVersion: flow.json_version || undefined,
    dataApiVersion: flow.data_api_version || undefined,
    dataChannelUri: flow.data_channel_uri || undefined,
    endpointUri: flow.endpoint_uri || undefined,
    previewUrl: flow.preview?.preview_url || undefined,
    previewExpiresAt: toSafeDate(flow.preview?.expires_at),
    healthStatus: flow.health_status,
    whatsappBusinessAccount: flow.whatsapp_business_account,
    application: flow.application,
    metaUpdatedAt: toSafeDate(flow.updated_at),
    lastSyncedAt: new Date(),
    lastMetaSnapshot: flow as unknown as Record<string, unknown>,
  };
}

async function upsertFlowFromMeta(userId: string, flow: MetaFlowResponse): Promise<IWhatsAppFlow> {
  const payload = mapMetaFlowToLocal(userId, flow);
  const existing = await WhatsAppFlow.findOne({ userId, flowId: flow.id });

  if (existing) {
    Object.assign(existing, payload);
    await existing.save();
    return existing;
  }

  return WhatsAppFlow.create({
    ...payload,
    entryPoints: [
      {
        id: 'default',
        name: 'Default Entry',
        type: 'CTA',
      },
    ],
  });
}

async function resolveMetaCredentials(
  userId: string,
  requirements?: { requireWabaId?: boolean; requirePhoneNumberId?: boolean; requireAppId?: boolean }
): Promise<FlowCredentials> {
  let accessToken: string | undefined;
  let wabaId: string | undefined;
  let phoneNumberId: string | undefined;
  let appId: string | undefined;

  const integrationCreds = await integrationService.getDecryptedCredentials(userId, 'whatsapp');
  if (integrationCreds) {
    accessToken = integrationCreds.accessToken || accessToken;
    wabaId = integrationCreds.businessAccountId || wabaId;
    phoneNumberId = integrationCreds.phoneNumberId || phoneNumberId;
    appId = integrationCreds.appId || appId;
  }

  const storedCreds = await credentialsService.getDecryptedCredentials(userId);
  if (storedCreds) {
    accessToken = accessToken || storedCreds.whatsappToken;
    wabaId = wabaId || storedCreds.businessAccountId;
    phoneNumberId = phoneNumberId || storedCreds.phoneNumberId;
    appId = appId || storedCreds.appId;
  }

  accessToken =
    accessToken ||
    process.env.WHATSAPP_TOKEN_NEW ||
    process.env.WHATSAPP_TOKEN ||
    process.env.SYSTEM_USER_TOKEN_META ||
    process.env.FB_PAGE_ACCESS_TOKEN;

  wabaId = wabaId || process.env.BUSINESS_ACCOUNT_ID || process.env.WABA_ID;
  phoneNumberId = phoneNumberId || process.env.PHONE_NUMBER_ID;
  appId = appId || process.env.META_APP_ID || process.env.FACEBOOK_APP_ID || process.env.APP_ID;

  if (!accessToken) {
    throw new Error('WhatsApp access token is missing. Configure Connected Apps or Settings API credentials.');
  }

  if (requirements?.requireWabaId && !wabaId) {
    throw new Error('Missing WhatsApp Business Account ID (WABA ID).');
  }

  if (requirements?.requirePhoneNumberId && !phoneNumberId) {
    throw new Error('Missing WhatsApp Phone Number ID.');
  }

  if (requirements?.requireAppId && !appId) {
    throw new Error('Missing Meta App ID.');
  }

  return {
    accessToken,
    wabaId,
    phoneNumberId,
    appId,
  };
}

async function fetchMetaFlowById(
  accessToken: string,
  flowId: string,
  options?: { invalidatePreview?: boolean }
): Promise<MetaFlowResponse> {
  try {
    return await requestMeta<MetaFlowResponse>(flowId, {
      token: accessToken,
      query: {
        fields: EXTENDED_FLOW_FIELDS,
        invalidate_preview: options?.invalidatePreview ? true : undefined,
      },
    });
  } catch (error) {
    if (!isFlowFieldPermissionError(error)) {
      throw error;
    }

    return requestMeta<MetaFlowResponse>(flowId, {
      token: accessToken,
      query: {
        fields: SAFE_FLOW_FIELDS,
        invalidate_preview: options?.invalidatePreview ? true : undefined,
      },
    });
  }
}

export function validateFlowJson(flowJson: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!flowJson || typeof flowJson !== 'object') {
    return { valid: false, errors: ['Flow JSON is required and must be an object'] };
  }

  if (!flowJson.version || typeof flowJson.version !== 'string') {
    errors.push('Field "version" is required and must be a string');
  }

  if (!flowJson.data_api_version || typeof flowJson.data_api_version !== 'string') {
    errors.push('Field "data_api_version" is required and must be a string');
  }

  if (!flowJson.routing_model || typeof flowJson.routing_model !== 'object') {
    errors.push('Field "routing_model" is required and must be an object');
  }

  if (!Array.isArray(flowJson.screens) || flowJson.screens.length === 0) {
    errors.push('At least one screen is required in "screens"');
  } else {
    flowJson.screens.forEach((screen: any, index: number) => {
      if (!screen?.id) {
        errors.push(`screens[${index}].id is required`);
      }
      if (!screen?.title) {
        errors.push(`screens[${index}].title is required`);
      }
      if (!screen?.layout || typeof screen.layout !== 'object') {
        errors.push(`screens[${index}].layout is required`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export async function syncFlowsFromMeta(userId: string): Promise<{
  synced: number;
  created: number;
  updated: number;
  errors: string[];
}> {
  const result = {
    synced: 0,
    created: 0,
    updated: 0,
    errors: [] as string[],
  };

  const { accessToken, wabaId } = await resolveMetaCredentials(userId, { requireWabaId: true });

  await FlowSyncCheckpoint.findOneAndUpdate(
    { userId },
    {
      $set: {
        syncStatus: 'syncing',
        wabaId,
      },
    },
    { upsert: true }
  );

  try {
    let afterCursor: string | undefined;

    while (true) {
      let data: MetaFlowsListResponse;
      try {
        data = await requestMeta<MetaFlowsListResponse>(`${wabaId}/flows`, {
          token: accessToken,
          query: {
            fields: EXTENDED_FLOW_FIELDS,
            limit: 200,
            after: afterCursor,
          },
        });
      } catch (error) {
        if (!isFlowFieldPermissionError(error)) {
          throw error;
        }

        data = await requestMeta<MetaFlowsListResponse>(`${wabaId}/flows`, {
          token: accessToken,
          query: {
            fields: SAFE_FLOW_FIELDS,
            limit: 200,
            after: afterCursor,
          },
        });
      }

      const flows = Array.isArray(data.data) ? data.data : [];

      for (const metaFlow of flows) {
        try {
          const exists = await WhatsAppFlow.exists({ userId, flowId: metaFlow.id });
          await upsertFlowFromMeta(userId, metaFlow);
          if (exists) {
            result.updated += 1;
          } else {
            result.created += 1;
          }
          result.synced += 1;
        } catch (error: any) {
          result.errors.push(`Flow ${metaFlow.id}: ${error.message}`);
        }
      }

      if (!data.paging?.next || !data.paging.cursors?.after) {
        break;
      }

      afterCursor = data.paging.cursors.after;
    }

    await FlowSyncCheckpoint.findOneAndUpdate(
      { userId },
      {
        $set: {
          syncStatus: 'idle',
          lastSyncedAt: new Date(),
          nextCursor: undefined,
          lastError: undefined,
        },
      }
    );

    return result;
  } catch (error: any) {
    await FlowSyncCheckpoint.findOneAndUpdate(
      { userId },
      {
        $set: {
          syncStatus: 'error',
          lastError: error.message,
        },
      }
    );

    throw error;
  }
}

export async function getFlows(
  userId: string,
  filters?: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }
): Promise<{ flows: IWhatsAppFlow[]; total: number }> {
  const query: Record<string, any> = { userId };

  if (filters?.status) {
    query.status = String(filters.status).toUpperCase();
  }

  if (filters?.search) {
    query.name = { $regex: filters.search, $options: 'i' };
  }

  const page = Math.max(1, filters?.page || 1);
  const limit = Math.max(1, Math.min(100, filters?.limit || 50));

  const [flows, total] = await Promise.all([
    WhatsAppFlow.find(query)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    WhatsAppFlow.countDocuments(query),
  ]);

  return { flows, total };
}

export async function getFlowById(userId: string, id: string): Promise<IWhatsAppFlow | null> {
  return WhatsAppFlow.findOne(buildFlowLookupQuery(userId, id));
}

export async function getFlowByFlowId(userId: string, flowId: string): Promise<IWhatsAppFlow | null> {
  return WhatsAppFlow.findOne({ userId, flowId });
}

export async function getFlowDetailsFromMeta(
  userId: string,
  idOrFlowId: string,
  options?: { invalidatePreview?: boolean }
): Promise<{ flow: IWhatsAppFlow; meta: MetaFlowResponse }> {
  const flow = await getFlowDocumentOrThrow(userId, idOrFlowId);
  const { accessToken } = await resolveMetaCredentials(userId);

  const meta = await fetchMetaFlowById(accessToken, flow.flowId, {
    invalidatePreview: options?.invalidatePreview,
  });

  const localFlow = await upsertFlowFromMeta(userId, meta);
  return { flow: localFlow, meta };
}

export async function updateFlowEntryPoints(
  userId: string,
  id: string,
  entryPoints: { id: string; name: string; type: 'CTA' | 'BUTTON' | 'LIST' }[]
): Promise<IWhatsAppFlow | null> {
  return WhatsAppFlow.findOneAndUpdate(
    buildFlowLookupQuery(userId, id),
    { $set: { entryPoints } },
    { new: true }
  );
}

export async function attachFlowToTemplate(
  userId: string,
  flowId: string,
  templateId: string
): Promise<IWhatsAppFlow | null> {
  return WhatsAppFlow.findOneAndUpdate(
    buildFlowLookupQuery(userId, flowId),
    { $addToSet: { linkedTemplateIds: templateId } },
    { new: true }
  );
}

export async function detachFlowFromTemplate(
  userId: string,
  flowId: string,
  templateId: string
): Promise<IWhatsAppFlow | null> {
  return WhatsAppFlow.findOneAndUpdate(
    buildFlowLookupQuery(userId, flowId),
    { $pull: { linkedTemplateIds: templateId } },
    { new: true }
  );
}

export async function attachFlowToAgent(
  userId: string,
  flowId: string,
  agentId: string
): Promise<IWhatsAppFlow | null> {
  return WhatsAppFlow.findOneAndUpdate(
    buildFlowLookupQuery(userId, flowId),
    { $addToSet: { linkedAgentIds: agentId } },
    { new: true }
  );
}

export async function detachFlowFromAgent(
  userId: string,
  flowId: string,
  agentId: string
): Promise<IWhatsAppFlow | null> {
  return WhatsAppFlow.findOneAndUpdate(
    buildFlowLookupQuery(userId, flowId),
    { $pull: { linkedAgentIds: agentId } },
    { new: true }
  );
}

export async function deleteFlow(userId: string, id: string): Promise<boolean> {
  const result = await WhatsAppFlow.deleteOne(buildFlowLookupQuery(userId, id));
  return result.deletedCount > 0;
}

export async function getSyncStatus(userId: string): Promise<{
  lastSyncedAt?: Date;
  syncStatus: string;
  lastError?: string;
  totalFlows: number;
}> {
  const [checkpoint, totalFlows] = await Promise.all([
    FlowSyncCheckpoint.findOne({ userId }),
    WhatsAppFlow.countDocuments({ userId }),
  ]);

  return {
    lastSyncedAt: checkpoint?.lastSyncedAt,
    syncStatus: checkpoint?.syncStatus || 'idle',
    lastError: checkpoint?.lastError,
    totalFlows,
  };
}

export async function getFlowStats(userId: string): Promise<{
  totalFlows: number;
  publishedFlows: number;
  draftFlows: number;
  linkedToTemplates: number;
  linkedToAgents: number;
}> {
  const [total, published, draft, linkedTemplates, linkedAgents] = await Promise.all([
    WhatsAppFlow.countDocuments({ userId }),
    WhatsAppFlow.countDocuments({ userId, status: 'PUBLISHED' }),
    WhatsAppFlow.countDocuments({ userId, status: 'DRAFT' }),
    WhatsAppFlow.countDocuments({ userId, linkedTemplateIds: { $exists: true, $ne: [] } }),
    WhatsAppFlow.countDocuments({ userId, linkedAgentIds: { $exists: true, $ne: [] } }),
  ]);

  return {
    totalFlows: total,
    publishedFlows: published,
    draftFlows: draft,
    linkedToTemplates: linkedTemplates,
    linkedToAgents: linkedAgents,
  };
}

export type FlowCategory =
  | 'SIGN_UP'
  | 'SIGN_IN'
  | 'APPOINTMENT_BOOKING'
  | 'LEAD_GENERATION'
  | 'CONTACT_US'
  | 'CUSTOMER_SUPPORT'
  | 'SURVEY'
  | 'OTHER';

export async function createFlowInMeta(
  userId: string,
  data: {
    name: string;
    categories: FlowCategory[];
    endpointUri?: string;
    cloneFlowId?: string;
  }
): Promise<{ flowId: string; flow: IWhatsAppFlow; meta?: MetaFlowResponse }> {
  const { accessToken, wabaId } = await resolveMetaCredentials(userId, { requireWabaId: true });

  const createPayload: Record<string, unknown> = {
    name: data.name,
    categories: data.categories,
  };

  if (data.endpointUri) {
    createPayload.endpoint_uri = data.endpointUri;
  }

  if (data.cloneFlowId) {
    createPayload.clone_flow_id = data.cloneFlowId;
  }

  const createResponse = await requestMeta<{ id: string }>(`${wabaId}/flows`, {
    method: 'POST',
    token: accessToken,
    body: createPayload,
  });

  const flowId = createResponse.id;

  let flow: IWhatsAppFlow;
  let meta: MetaFlowResponse | undefined;

  try {
    meta = await fetchMetaFlowById(accessToken, flowId);
    flow = await upsertFlowFromMeta(userId, meta);
  } catch (error) {
    flow = await WhatsAppFlow.create({
      userId,
      flowId,
      name: data.name,
      status: 'DRAFT',
      categories: data.categories,
      endpointUri: data.endpointUri,
      validationErrors: [],
      entryPoints: [
        {
          id: 'default',
          name: 'Default Entry',
          type: 'CTA',
        },
      ],
      lastSyncedAt: new Date(),
    });
  }

  return { flowId, flow, meta };
}

export async function saveFlowDraft(
  userId: string,
  id: string,
  flowData: any,
  flowJson: any
): Promise<IWhatsAppFlow> {
  const flow = await getFlowDocumentOrThrow(userId, id);

  const validation = validateFlowJson(flowJson);

  flow.flowData = flowData;
  flow.flowJson = flowJson;
  flow.draftValidationErrors = validation.errors;
  flow.lastSyncedAt = new Date();

  await flow.save();
  return flow;
}

async function uploadFlowJsonAsset(
  accessToken: string,
  flowId: string,
  flowJson: Record<string, unknown>
): Promise<any> {
  const formData = new FormData();
  formData.append('name', `flow-${Date.now()}.json`);
  formData.append('asset_type', 'FLOW_JSON');
  formData.append(
    'file',
    new Blob([JSON.stringify(flowJson, null, 2)], { type: 'application/json' }),
    'flow.json'
  );

  return requestMeta(`${flowId}/assets`, {
    method: 'POST',
    token: accessToken,
    body: formData,
  });
}

export async function updateAndPublishFlow(userId: string, id: string): Promise<IWhatsAppFlow> {
  const flow = await getFlowDocumentOrThrow(userId, id);

  if (!flow.flowJson || typeof flow.flowJson !== 'object') {
    throw new Error('No valid Flow JSON found for this draft');
  }

  const validation = validateFlowJson(flow.flowJson);
  flow.draftValidationErrors = validation.errors;

  if (!validation.valid) {
    await flow.save();
    throw new Error(`Draft JSON validation failed: ${validation.errors.join('; ')}`);
  }

  const { accessToken } = await resolveMetaCredentials(userId);

  const uploadResult = await uploadFlowJsonAsset(accessToken, flow.flowId, flow.flowJson as Record<string, unknown>);
  const uploadValidationErrors = parseValidationErrors(uploadResult?.validation_errors);

  if (uploadValidationErrors.length > 0) {
    flow.validationErrors = uploadValidationErrors;
    await flow.save();
    throw new Error(`Flow JSON upload has validation errors: ${uploadValidationErrors.join('; ')}`);
  }

  await requestMeta(`${flow.flowId}/publish`, {
    method: 'POST',
    token: accessToken,
  });

  const refreshed = await getFlowDetailsFromMeta(userId, id, { invalidatePreview: true });
  return refreshed.flow;
}

export async function publishFlowInMeta(userId: string, id: string): Promise<IWhatsAppFlow> {
  const flow = await getFlowDocumentOrThrow(userId, id);
  const { accessToken } = await resolveMetaCredentials(userId);

  await requestMeta(`${flow.flowId}/publish`, {
    method: 'POST',
    token: accessToken,
  });

  const refreshed = await getFlowDetailsFromMeta(userId, id, { invalidatePreview: true });
  return refreshed.flow;
}

export async function deprecateFlowInMeta(userId: string, id: string): Promise<IWhatsAppFlow> {
  const flow = await getFlowDocumentOrThrow(userId, id);
  const { accessToken } = await resolveMetaCredentials(userId);

  await requestMeta(`${flow.flowId}/deprecate`, {
    method: 'POST',
    token: accessToken,
  });

  const refreshed = await getFlowDetailsFromMeta(userId, id);
  return refreshed.flow;
}

export async function deleteFlowInMeta(userId: string, id: string): Promise<boolean> {
  const flow = await getFlowDocumentOrThrow(userId, id);

  if (flow.status !== 'DRAFT') {
    throw new Error('Only draft flows can be deleted from Meta');
  }

  const { accessToken } = await resolveMetaCredentials(userId);

  await requestMeta(flow.flowId, {
    method: 'DELETE',
    token: accessToken,
  });

  await WhatsAppFlow.deleteOne({ _id: flow._id });
  return true;
}

export async function updateFlowMetadataInMeta(
  userId: string,
  id: string,
  updates: {
    name?: string;
    categories?: string[];
    endpointUri?: string;
  }
): Promise<{ flow: IWhatsAppFlow; meta: MetaFlowResponse }> {
  const flow = await getFlowDocumentOrThrow(userId, id);
  const { accessToken } = await resolveMetaCredentials(userId);

  const payload: Record<string, unknown> = {};
  if (updates.name) payload.name = updates.name;
  if (Array.isArray(updates.categories) && updates.categories.length > 0) payload.categories = updates.categories;
  if (updates.endpointUri !== undefined) payload.endpoint_uri = updates.endpointUri;

  if (Object.keys(payload).length === 0) {
    throw new Error('At least one field is required to update flow metadata');
  }

  await requestMeta(flow.flowId, {
    method: 'POST',
    token: accessToken,
    body: payload,
  });

  return getFlowDetailsFromMeta(userId, id, { invalidatePreview: true });
}

export async function cloneFlowInMeta(
  userId: string,
  id: string,
  options?: {
    name?: string;
    categories?: FlowCategory[];
    endpointUri?: string;
  }
): Promise<{ flowId: string; flow: IWhatsAppFlow; meta?: MetaFlowResponse }> {
  const sourceFlow = await getFlowDocumentOrThrow(userId, id);

  const categories =
    options?.categories && options.categories.length > 0
      ? options.categories
      : (sourceFlow.categories.filter(Boolean) as FlowCategory[]);

  return createFlowInMeta(userId, {
    name: options?.name || `${sourceFlow.name}_copy`,
    categories: categories.length > 0 ? categories : ['OTHER'],
    endpointUri: options?.endpointUri || sourceFlow.endpointUri,
    cloneFlowId: sourceFlow.flowId,
  });
}

export async function getFlowAssetsFromMeta(userId: string, id: string): Promise<any> {
  const flow = await getFlowDocumentOrThrow(userId, id);
  const { accessToken } = await resolveMetaCredentials(userId);

  return requestMeta(`${flow.flowId}/assets`, {
    token: accessToken,
    query: {
      limit: 200,
    },
  });
}

export async function getFlowAssetContentFromMeta(
  userId: string,
  id: string,
  assetId?: string
): Promise<{
  asset: Record<string, any>;
  downloadUrl: string;
  contentType?: string | null;
  text: string;
  json?: unknown;
}> {
  const flow = await getFlowDocumentOrThrow(userId, id);
  const { accessToken } = await resolveMetaCredentials(userId);

  const assetsResponse = await requestMeta<{ data?: Record<string, any>[] }>(`${flow.flowId}/assets`, {
    token: accessToken,
    query: {
      limit: 200,
    },
  });

  const assets = Array.isArray(assetsResponse.data) ? assetsResponse.data : [];

  const targetAsset =
    (assetId && assets.find((item) => String(item.id) === String(assetId))) ||
    assets.find((item) => String(item.asset_type || '').toUpperCase() === 'FLOW_JSON');

  if (!targetAsset) {
    throw new Error('No flow asset found for this flow');
  }

  let downloadUrl =
    targetAsset.download_url ||
    targetAsset.url ||
    targetAsset.asset_url ||
    targetAsset.asset_download_url;

  if (!downloadUrl && targetAsset.id) {
    const assetDetails = await requestMeta<Record<string, any>>(String(targetAsset.id), {
      token: accessToken,
      query: {
        fields: 'id,name,asset_type,download_url',
      },
    });

    downloadUrl =
      assetDetails.download_url ||
      assetDetails.url ||
      assetDetails.asset_url ||
      assetDetails.asset_download_url;
  }

  if (!downloadUrl) {
    throw new Error('Flow asset exists but no download URL is available');
  }

  const downloadResponse = await fetch(downloadUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!downloadResponse.ok) {
    const payload = await downloadResponse.text();
    throw new Error(`Failed to download flow asset: ${payload || downloadResponse.statusText}`);
  }

  const text = await downloadResponse.text();
  let json: unknown;

  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }

  return {
    asset: targetAsset,
    downloadUrl,
    contentType: downloadResponse.headers.get('content-type'),
    text,
    json,
  };
}

export async function getFlowMetricsFromMeta(
  userId: string,
  id: string,
  options?: {
    start?: string;
    end?: string;
    granularity?: 'DAY' | 'HOUR';
    metricNames?: string[];
  }
): Promise<any> {
  const flow = await getFlowDocumentOrThrow(userId, id);
  const { accessToken } = await resolveMetaCredentials(userId);

  const metricNames =
    Array.isArray(options?.metricNames) && options.metricNames.length > 0
      ? options.metricNames
      : DEFAULT_METRIC_NAMES;

  return requestMeta(`${flow.flowId}/metrics`, {
    token: accessToken,
    query: {
      metric_name: metricNames,
      granularity: options?.granularity || 'DAY',
      since: options?.start,
      until: options?.end,
    },
  });
}

function normalizePhoneNumber(input: string): string {
  return String(input || '').replace(/\D/g, '');
}

export async function sendFlowTestMessage(
  userId: string,
  id: string,
  data: {
    phoneNumber: string;
    mode?: 'published' | 'draft';
    ctaText?: string;
    headerText?: string;
    bodyText?: string;
    footerText?: string;
    flowToken?: string;
    flowAction?: 'navigate' | 'data_exchange';
    screen?: string;
    data?: Record<string, unknown>;
  }
): Promise<{
  messageId: string;
  payload: Record<string, unknown>;
  response: Record<string, unknown>;
}> {
  const flow = await getFlowDocumentOrThrow(userId, id);
  const { accessToken, phoneNumberId } = await resolveMetaCredentials(userId, {
    requirePhoneNumberId: true,
  });

  const to = normalizePhoneNumber(data.phoneNumber);
  if (!to) {
    throw new Error('Valid recipient phone number is required');
  }

  const sendMode: 'published' | 'draft' =
    data.mode || (flow.status === 'DRAFT' ? 'draft' : 'published');

  const parameters: Record<string, unknown> = {
    flow_message_version: '3',
    flow_token: data.flowToken || `flow_${Date.now()}`,
    flow_cta: data.ctaText || 'Start',
    flow_action: data.flowAction || 'navigate',
  };

  if (sendMode === 'draft') {
    parameters.mode = 'draft';
    parameters.flow_name = flow.name;
  } else {
    parameters.flow_id = flow.flowId;
  }

  const actionPayload: Record<string, unknown> = {
    screen: data.screen || '0',
  };

  if (data.data && Object.keys(data.data).length > 0) {
    actionPayload.data = data.data;
  }

  parameters.flow_action_payload = actionPayload;

  const payload: Record<string, any> = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'interactive',
    interactive: {
      type: 'flow',
      body: {
        text: data.bodyText || `Please complete flow: ${flow.name}`,
      },
      action: {
        name: 'flow',
        parameters,
      },
    },
  };

  if (data.headerText) {
    payload.interactive.header = {
      type: 'text',
      text: data.headerText,
    };
  }

  if (data.footerText) {
    payload.interactive.footer = {
      text: data.footerText,
    };
  }

  const response = await requestMeta<Record<string, any>>(`${phoneNumberId}/messages`, {
    method: 'POST',
    token: accessToken,
    body: payload,
  });

  const messageId = response?.messages?.[0]?.id;

  if (!messageId) {
    throw new Error('Flow message accepted but message ID is missing in response');
  }

  return {
    messageId,
    payload,
    response,
  };
}

export async function getPhoneNumberEncryptionStatus(
  userId: string,
  businessPhoneNumberId?: string
): Promise<Record<string, unknown>> {
  const { accessToken, phoneNumberId } = await resolveMetaCredentials(userId, {
    requirePhoneNumberId: !businessPhoneNumberId,
  });

  const targetPhoneId = businessPhoneNumberId || phoneNumberId;
  if (!targetPhoneId) {
    throw new Error('Business Phone Number ID is required');
  }

  const response = await requestMeta<Record<string, unknown>>(`${targetPhoneId}/whatsapp_business_encryption`, {
    token: accessToken,
  });

  return {
    phoneNumberId: targetPhoneId,
    ...response,
  };
}

export async function setPhoneNumberEncryptionPublicKey(
  userId: string,
  payload: {
    businessPhoneNumberId?: string;
    businessPublicKey: string;
  }
): Promise<Record<string, unknown>> {
  if (!payload.businessPublicKey || !payload.businessPublicKey.trim()) {
    throw new Error('businessPublicKey is required');
  }

  const { accessToken, phoneNumberId } = await resolveMetaCredentials(userId, {
    requirePhoneNumberId: !payload.businessPhoneNumberId,
  });

  const targetPhoneId = payload.businessPhoneNumberId || phoneNumberId;
  if (!targetPhoneId) {
    throw new Error('Business Phone Number ID is required');
  }

  const updateResponse = await requestMeta<Record<string, unknown>>(`${targetPhoneId}/whatsapp_business_encryption`, {
    method: 'POST',
    token: accessToken,
    body: {
      business_public_key: payload.businessPublicKey,
    },
  });

  const status = await getPhoneNumberEncryptionStatus(userId, targetPhoneId);

  return {
    phoneNumberId: targetPhoneId,
    updateResponse,
    status,
  };
}
