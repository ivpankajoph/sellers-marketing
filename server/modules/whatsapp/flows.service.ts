import { WhatsAppFlow, IWhatsAppFlow, FlowSyncCheckpoint } from './flows.model';
import * as integrationService from '../integrations/integration.service';
import * as credentialsService from '../credentials/credentials.service';

interface MetaFlowResponse {
  id: string;
  name: string;
  status: string;
  categories?: string[];
  validation_errors?: { error: string }[];
  json_version?: string;
  data_api_version?: string;
  data_channel_uri?: string;
  preview?: { preview_url: string };
  updated_at?: string;
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

export async function syncFlowsFromMeta(userId: string): Promise<{
  synced: number;
  created: number;
  updated: number;
  errors: string[];
}> {
  const results = {
    synced: 0,
    created: 0,
    updated: 0,
    errors: [] as string[]
  };

  try {
    let accessToken: string | undefined;
    let wabaId: string | undefined;

    const integrationCreds = await integrationService.getDecryptedCredentials(userId, 'whatsapp');
    if (integrationCreds?.accessToken && integrationCreds?.businessAccountId) {
      accessToken = integrationCreds.accessToken;
      wabaId = integrationCreds.businessAccountId;
    } else {
      const storedCreds = await credentialsService.getDecryptedCredentials(userId);
      if (storedCreds?.whatsappToken && storedCreds?.businessAccountId) {
        accessToken = storedCreds.whatsappToken;
        wabaId = storedCreds.businessAccountId;
      }
    }

    if (!accessToken) {
      accessToken = process.env.WHATSAPP_TOKEN_NEW || process.env.WHATSAPP_TOKEN;
      wabaId = wabaId || process.env.BUSINESS_ACCOUNT_ID;
    }

    if (!wabaId || !accessToken) {
      throw new Error('WhatsApp credentials incomplete - missing Business Account ID or access token');
    }

    console.log(`[Flows] Starting sync for user ${userId} with WABA ID: ${wabaId}`);

    await FlowSyncCheckpoint.findOneAndUpdate(
      { userId },
      { $set: { syncStatus: 'syncing', wabaId } },
      { upsert: true }
    );

    let hasMore = true;
    let afterCursor: string | undefined;

    while (hasMore) {
      const url = new URL(`https://graph.facebook.com/v21.0/${wabaId}/flows`);
      url.searchParams.append('fields', 'id,name,status,categories,validation_errors,json_version,data_api_version,data_channel_uri,preview,updated_at');
      if (afterCursor) {
        url.searchParams.append('after', afterCursor);
      }

      console.log(`[Flows] Fetching from: ${url.toString().replace(accessToken!, '[REDACTED]')}`);
      
      const response = await fetch(url.toString(), {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      const responseText = await response.text();
      console.log(`[Flows] API Response status: ${response.status}`);
      
      if (!response.ok) {
        console.error(`[Flows] API Error: ${responseText}`);
        let errorMessage = 'Failed to fetch flows from Meta';
        try {
          const error = JSON.parse(responseText);
          errorMessage = error.error?.message || errorMessage;
        } catch {}
        throw new Error(errorMessage);
      }

      const data: MetaFlowsListResponse = JSON.parse(responseText);
      console.log(`[Flows] Received ${data.data?.length || 0} flows from API`);

      for (const flow of data.data) {
        try {
          const existingFlow = await WhatsAppFlow.findOne({ userId, flowId: flow.id });
          
          const flowData = {
            userId,
            flowId: flow.id,
            name: flow.name,
            status: flow.status as any,
            categories: flow.categories || [],
            validationErrors: flow.validation_errors?.map(e => e.error) || [],
            jsonVersion: flow.json_version,
            dataApiVersion: flow.data_api_version,
            dataChannelUri: flow.data_channel_uri,
            previewUrl: flow.preview?.preview_url,
            metaUpdatedAt: flow.updated_at ? new Date(flow.updated_at) : undefined,
            lastSyncedAt: new Date()
          };

          if (existingFlow) {
            await WhatsAppFlow.updateOne(
              { _id: existingFlow._id },
              { $set: flowData }
            );
            results.updated++;
          } else {
            await WhatsAppFlow.create({
              ...flowData,
              entryPoints: [{
                id: 'default',
                name: 'Default Entry',
                type: 'CTA'
              }]
            });
            results.created++;
          }
          results.synced++;
        } catch (flowError: any) {
          results.errors.push(`Flow ${flow.id}: ${flowError.message}`);
        }
      }

      if (data.paging?.next && data.paging?.cursors?.after) {
        afterCursor = data.paging.cursors.after;
      } else {
        hasMore = false;
      }
    }

    await FlowSyncCheckpoint.findOneAndUpdate(
      { userId },
      { 
        $set: { 
          syncStatus: 'idle', 
          lastSyncedAt: new Date(),
          nextCursor: undefined,
          lastError: undefined
        } 
      }
    );

    console.log(`[Flows] Synced ${results.synced} flows for user ${userId} (${results.created} new, ${results.updated} updated)`);
    return results;
  } catch (error: any) {
    await FlowSyncCheckpoint.findOneAndUpdate(
      { userId },
      { $set: { syncStatus: 'error', lastError: error.message } }
    );
    console.error('[Flows] Sync error:', error);
    throw error;
  }
}

export async function getFlows(userId: string, filters?: {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{ flows: IWhatsAppFlow[]; total: number }> {
  const query: any = { userId };
  
  if (filters?.status) query.status = filters.status;
  if (filters?.search) {
    query.name = { $regex: filters.search, $options: 'i' };
  }

  const page = filters?.page || 1;
  const limit = filters?.limit || 50;
  const skip = (page - 1) * limit;

  const [flows, total] = await Promise.all([
    WhatsAppFlow.find(query).sort({ updatedAt: -1 }).skip(skip).limit(limit),
    WhatsAppFlow.countDocuments(query)
  ]);

  return { flows, total };
}

export async function getFlowById(userId: string, id: string): Promise<IWhatsAppFlow | null> {
  return WhatsAppFlow.findOne({ _id: id, userId });
}

export async function getFlowByFlowId(userId: string, flowId: string): Promise<IWhatsAppFlow | null> {
  return WhatsAppFlow.findOne({ flowId, userId });
}

export async function updateFlowEntryPoints(
  userId: string, 
  id: string, 
  entryPoints: { id: string; name: string; type: 'CTA' | 'BUTTON' | 'LIST' }[]
): Promise<IWhatsAppFlow | null> {
  return WhatsAppFlow.findOneAndUpdate(
    { _id: id, userId },
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
    { _id: flowId, userId },
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
    { _id: flowId, userId },
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
    { _id: flowId, userId },
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
    { _id: flowId, userId },
    { $pull: { linkedAgentIds: agentId } },
    { new: true }
  );
}

export async function deleteFlow(userId: string, id: string): Promise<boolean> {
  const result = await WhatsAppFlow.deleteOne({ _id: id, userId });
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
    WhatsAppFlow.countDocuments({ userId })
  ]);

  return {
    lastSyncedAt: checkpoint?.lastSyncedAt,
    syncStatus: checkpoint?.syncStatus || 'idle',
    lastError: checkpoint?.lastError,
    totalFlows
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
    WhatsAppFlow.countDocuments({ userId, linkedAgentIds: { $exists: true, $ne: [] } })
  ]);

  return {
    totalFlows: total,
    publishedFlows: published,
    draftFlows: draft,
    linkedToTemplates: linkedTemplates,
    linkedToAgents: linkedAgents
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

export async function createFlowInMeta(userId: string, data: {
  name: string;
  categories: FlowCategory[];
  endpointUri?: string;
}): Promise<{ flowId: string; flow: IWhatsAppFlow }> {
  let accessToken: string | undefined;
  let wabaId: string | undefined;

  const integrationCreds = await integrationService.getDecryptedCredentials(userId, 'whatsapp');
  if (integrationCreds?.accessToken && integrationCreds?.businessAccountId) {
    accessToken = integrationCreds.accessToken;
    wabaId = integrationCreds.businessAccountId;
  } else {
    const storedCreds = await credentialsService.getDecryptedCredentials(userId);
    if (storedCreds?.whatsappToken && storedCreds?.businessAccountId) {
      accessToken = storedCreds.whatsappToken;
      wabaId = storedCreds.businessAccountId;
    }
  }

  if (!accessToken) {
    accessToken = process.env.WHATSAPP_TOKEN_NEW || process.env.WHATSAPP_TOKEN;
    wabaId = wabaId || process.env.BUSINESS_ACCOUNT_ID;
  }

  if (!wabaId || !accessToken) {
    throw new Error('WhatsApp credentials incomplete - missing Business Account ID or access token');
  }

  console.log(`[Flows] Creating flow "${data.name}" for user ${userId}`);

  const requestBody: any = {
    name: data.name,
    categories: data.categories
  };

  if (data.endpointUri) {
    requestBody.endpoint_uri = data.endpointUri;
  }

  const response = await fetch(`https://graph.facebook.com/v21.0/${wabaId}/flows`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  const responseText = await response.text();
  console.log(`[Flows] Create API Response status: ${response.status}`);

  if (!response.ok) {
    console.error(`[Flows] Create API Error: ${responseText}`);
    let errorMessage = 'Failed to create flow in Meta';
    try {
      const error = JSON.parse(responseText);
      errorMessage = error.error?.message || errorMessage;
    } catch {}
    throw new Error(errorMessage);
  }

  const result = JSON.parse(responseText);
  const flowId = result.id;

  console.log(`[Flows] Flow created with ID: ${flowId}`);

  const flow = await WhatsAppFlow.create({
    userId,
    flowId,
    name: data.name,
    status: 'DRAFT',
    categories: data.categories,
    validationErrors: [],
    entryPoints: [{
      id: 'default',
      name: 'Default Entry',
      type: 'CTA'
    }],
    lastSyncedAt: new Date()
  });

  return { flowId, flow };
}

export async function publishFlowInMeta(userId: string, id: string): Promise<IWhatsAppFlow> {
  const flow = await WhatsAppFlow.findOne({ _id: id, userId });
  if (!flow) {
    throw new Error('Flow not found');
  }

  let accessToken: string | undefined;

  const integrationCreds = await integrationService.getDecryptedCredentials(userId, 'whatsapp');
  if (integrationCreds?.accessToken) {
    accessToken = integrationCreds.accessToken;
  } else {
    const storedCreds = await credentialsService.getDecryptedCredentials(userId);
    if (storedCreds?.whatsappToken) {
      accessToken = storedCreds.whatsappToken;
    }
  }

  if (!accessToken) {
    accessToken = process.env.WHATSAPP_TOKEN_NEW || process.env.WHATSAPP_TOKEN;
  }

  if (!accessToken) {
    throw new Error('WhatsApp access token not found');
  }

  const response = await fetch(`https://graph.facebook.com/v21.0/${flow.flowId}/publish`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to publish flow');
  }

  flow.status = 'PUBLISHED';
  await flow.save();

  console.log(`[Flows] Flow ${flow.flowId} published successfully`);
  return flow;
}

export async function deprecateFlowInMeta(userId: string, id: string): Promise<IWhatsAppFlow> {
  const flow = await WhatsAppFlow.findOne({ _id: id, userId });
  if (!flow) {
    throw new Error('Flow not found');
  }

  let accessToken: string | undefined;

  const integrationCreds = await integrationService.getDecryptedCredentials(userId, 'whatsapp');
  if (integrationCreds?.accessToken) {
    accessToken = integrationCreds.accessToken;
  } else {
    const storedCreds = await credentialsService.getDecryptedCredentials(userId);
    if (storedCreds?.whatsappToken) {
      accessToken = storedCreds.whatsappToken;
    }
  }

  if (!accessToken) {
    accessToken = process.env.WHATSAPP_TOKEN_NEW || process.env.WHATSAPP_TOKEN;
  }

  if (!accessToken) {
    throw new Error('WhatsApp access token not found');
  }

  const response = await fetch(`https://graph.facebook.com/v21.0/${flow.flowId}/deprecate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to deprecate flow');
  }

  flow.status = 'DEPRECATED';
  await flow.save();

  console.log(`[Flows] Flow ${flow.flowId} deprecated successfully`);
  return flow;
}

export async function deleteFlowInMeta(userId: string, id: string): Promise<boolean> {
  const flow = await WhatsAppFlow.findOne({ _id: id, userId });
  if (!flow) {
    throw new Error('Flow not found');
  }

  if (flow.status !== 'DRAFT') {
    throw new Error('Only draft flows can be deleted from Meta');
  }

  let accessToken: string | undefined;

  const integrationCreds = await integrationService.getDecryptedCredentials(userId, 'whatsapp');
  if (integrationCreds?.accessToken) {
    accessToken = integrationCreds.accessToken;
  } else {
    const storedCreds = await credentialsService.getDecryptedCredentials(userId);
    if (storedCreds?.whatsappToken) {
      accessToken = storedCreds.whatsappToken;
    }
  }

  if (!accessToken) {
    accessToken = process.env.WHATSAPP_TOKEN_NEW || process.env.WHATSAPP_TOKEN;
  }

  if (!accessToken) {
    throw new Error('WhatsApp access token not found');
  }

  const response = await fetch(`https://graph.facebook.com/v21.0/${flow.flowId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to delete flow from Meta');
  }

  await WhatsAppFlow.deleteOne({ _id: id });
  console.log(`[Flows] Flow ${flow.flowId} deleted from Meta`);
  return true;
}
