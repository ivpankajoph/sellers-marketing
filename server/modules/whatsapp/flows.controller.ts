import { Request, Response } from 'express';
import * as flowsService from './flows.service';
import * as whatsappService from './whatsapp.service';

function getUserId(req: Request): string | null {
  const headerUserId = req.headers['x-user-id'];
  if (typeof headerUserId === 'string' && headerUserId.trim()) {
    return headerUserId;
  }
  if (Array.isArray(headerUserId) && headerUserId[0]) {
    return headerUserId[0];
  }

  return (req as any).userId || (req as any).user?.id || null;
}

function sendError(res: Response, error: unknown, fallbackMessage: string) {
  const err = error as any;
  const status = Number(err?.status) || 500;
  const code = Number(err?.code) || undefined;
  const details = err?.details;
  const message = err?.message || fallbackMessage;

  const permissionHint =
    code === 200 &&
    /permission|access this field/i.test(`${message} ${details || ''}`)
      ? 'Token lacks one or more advanced Flow fields permissions. Reconnect WhatsApp integration with full scopes (business_management, whatsapp_business_management, whatsapp_business_messaging), then re-sync.'
      : undefined;

  res.status(status).json({
    error: message,
    code: err?.code,
    subcode: err?.subcode,
    details,
    hint: permissionHint,
    fbtraceId: err?.fbtraceId,
    meta: err?.meta,
  });
}

export async function syncFlows(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const result = await flowsService.syncFlowsFromMeta(userId);
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[Flows] Sync error:', error);
    sendError(res, error, 'Failed to sync flows');
  }
}

export async function getFlows(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { status, search, page, limit } = req.query;
    const result = await flowsService.getFlows(userId, {
      status: status as string,
      search: search as string,
      page: page ? parseInt(page as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });

    res.json(result);
  } catch (error) {
    console.error('[Flows] Get flows error:', error);
    sendError(res, error, 'Failed to get flows');
  }
}

export async function getFlowById(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const flow = await flowsService.getFlowById(userId, req.params.id);
    if (!flow) return res.status(404).json({ error: 'Flow not found' });

    res.json(flow);
  } catch (error) {
    console.error('[Flows] Get flow error:', error);
    sendError(res, error, 'Failed to get flow');
  }
}

export async function getFlowMeta(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const result = await flowsService.getFlowDetailsFromMeta(userId, req.params.id);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[Flows] Get flow meta error:', error);
    sendError(res, error, 'Failed to get flow meta details');
  }
}

export async function refreshFlowPreview(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const result = await flowsService.getFlowDetailsFromMeta(userId, req.params.id, {
      invalidatePreview: true,
    });

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[Flows] Refresh preview error:', error);
    sendError(res, error, 'Failed to refresh flow preview');
  }
}

export async function getFlowStats(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const stats = await flowsService.getFlowStats(userId);
    res.json(stats);
  } catch (error) {
    console.error('[Flows] Get stats error:', error);
    sendError(res, error, 'Failed to get flow stats');
  }
}

export async function getSyncStatus(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const status = await flowsService.getSyncStatus(userId);
    res.json(status);
  } catch (error) {
    console.error('[Flows] Get sync status error:', error);
    sendError(res, error, 'Failed to get sync status');
  }
}

export async function updateEntryPoints(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { entryPoints } = req.body;
    const flow = await flowsService.updateFlowEntryPoints(userId, req.params.id, entryPoints);
    if (!flow) return res.status(404).json({ error: 'Flow not found' });

    res.json(flow);
  } catch (error) {
    console.error('[Flows] Update entry points error:', error);
    sendError(res, error, 'Failed to update entry points');
  }
}

export async function updateFlowMeta(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { name, categories, endpointUri } = req.body;
    const result = await flowsService.updateFlowMetadataInMeta(userId, req.params.id, {
      name,
      categories,
      endpointUri,
    });

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[Flows] Update meta error:', error);
    sendError(res, error, 'Failed to update flow metadata');
  }
}

export async function cloneFlow(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { name, categories, endpointUri } = req.body;
    const result = await flowsService.cloneFlowInMeta(userId, req.params.id, {
      name,
      categories,
      endpointUri,
    });

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[Flows] Clone flow error:', error);
    sendError(res, error, 'Failed to clone flow');
  }
}

export async function getFlowAssets(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const assets = await flowsService.getFlowAssetsFromMeta(userId, req.params.id);
    res.json({ success: true, ...assets });
  } catch (error) {
    console.error('[Flows] Get flow assets error:', error);
    sendError(res, error, 'Failed to fetch flow assets');
  }
}

export async function downloadFlowAsset(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const payload = await flowsService.getFlowAssetContentFromMeta(userId, req.params.id, req.params.assetId);
    res.json({ success: true, ...payload });
  } catch (error) {
    console.error('[Flows] Download flow asset error:', error);
    sendError(res, error, 'Failed to download flow asset');
  }
}

export async function getFlowMetrics(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const metricNames =
      typeof req.query.metricNames === 'string'
        ? req.query.metricNames
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
        : undefined;

    const metrics = await flowsService.getFlowMetricsFromMeta(userId, req.params.id, {
      start: req.query.start as string,
      end: req.query.end as string,
      granularity: (req.query.granularity as 'DAY' | 'HOUR') || 'DAY',
      metricNames,
    });

    res.json({ success: true, ...metrics });
  } catch (error) {
    console.error('[Flows] Get flow metrics error:', error);
    sendError(res, error, 'Failed to fetch flow metrics');
  }
}

export async function attachToTemplate(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { templateId } = req.body;
    const flow = await flowsService.attachFlowToTemplate(userId, req.params.id, templateId);
    if (!flow) return res.status(404).json({ error: 'Flow not found' });

    res.json(flow);
  } catch (error) {
    console.error('[Flows] Attach to template error:', error);
    sendError(res, error, 'Failed to attach flow to template');
  }
}

export async function detachFromTemplate(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const flow = await flowsService.detachFlowFromTemplate(userId, req.params.id, req.params.templateId);
    if (!flow) return res.status(404).json({ error: 'Flow not found' });

    res.json(flow);
  } catch (error) {
    console.error('[Flows] Detach from template error:', error);
    sendError(res, error, 'Failed to detach flow from template');
  }
}

export async function attachToAgent(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { agentId } = req.body;
    const flow = await flowsService.attachFlowToAgent(userId, req.params.id, agentId);
    if (!flow) return res.status(404).json({ error: 'Flow not found' });

    res.json(flow);
  } catch (error) {
    console.error('[Flows] Attach to agent error:', error);
    sendError(res, error, 'Failed to attach flow to agent');
  }
}

export async function detachFromAgent(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const flow = await flowsService.detachFlowFromAgent(userId, req.params.id, req.params.agentId);
    if (!flow) return res.status(404).json({ error: 'Flow not found' });

    res.json(flow);
  } catch (error) {
    console.error('[Flows] Detach from agent error:', error);
    sendError(res, error, 'Failed to detach flow from agent');
  }
}

export async function sendFlow(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { phoneNumber, entryPointId, headerText, bodyText, footerText, ctaText } = req.body;

    const flow = await flowsService.getFlowById(userId, req.params.id);
    if (!flow) return res.status(404).json({ error: 'Flow not found' });

    if (flow.status !== 'PUBLISHED') {
      return res.status(400).json({ error: 'Only published flows can be sent' });
    }

    const result = await whatsappService.sendFlowMessage(userId, {
      to: phoneNumber,
      flowId: flow.flowId,
      flowName: flow.name,
      entryPointId: entryPointId || 'default',
      headerText: headerText || 'Interactive Flow',
      bodyText: bodyText || 'Please complete the following flow',
      footerText,
      ctaText: ctaText || 'Start',
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error || 'Failed to send flow message' });
    }

    res.json({
      success: true,
      messageId: result.messageId,
      flow: flow.name,
    });
  } catch (error) {
    console.error('[Flows] Send flow error:', error);
    sendError(res, error, 'Failed to send flow');
  }
}

export async function sendFlowTest(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const result = await flowsService.sendFlowTestMessage(userId, req.params.id, {
      phoneNumber: req.body.phoneNumber,
      mode: req.body.mode,
      ctaText: req.body.ctaText,
      headerText: req.body.headerText,
      bodyText: req.body.bodyText,
      footerText: req.body.footerText,
      flowToken: req.body.flowToken,
      flowAction: req.body.flowAction,
      screen: req.body.screen,
      data: req.body.data,
    });

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[Flows] Send flow test error:', error);
    sendError(res, error, 'Failed to send flow test message');
  }
}

export async function deleteFlow(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const deleted = await flowsService.deleteFlow(userId, req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Flow not found' });

    res.json({ success: true });
  } catch (error) {
    console.error('[Flows] Delete flow error:', error);
    sendError(res, error, 'Failed to delete flow');
  }
}

export async function createFlow(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { name, categories, endpointUri, cloneFlowId } = req.body;

    if (!name || !categories || !Array.isArray(categories) || categories.length === 0) {
      return res.status(400).json({ error: 'Name and at least one category are required' });
    }

    const result = await flowsService.createFlowInMeta(userId, {
      name,
      categories,
      endpointUri,
      cloneFlowId,
    });

    res.json({
      success: true,
      flowId: result.flowId,
      flow: result.flow,
      meta: result.meta,
    });
  } catch (error) {
    console.error('[Flows] Create flow error:', error);
    sendError(res, error, 'Failed to create flow');
  }
}

export async function cloneMetaFlow(req: Request, res: Response) {
  return cloneFlow(req, res);
}

export async function publishFlow(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const flow = await flowsService.publishFlowInMeta(userId, req.params.id);
    res.json({ success: true, flow });
  } catch (error) {
    console.error('[Flows] Publish flow error:', error);
    sendError(res, error, 'Failed to publish flow');
  }
}

export async function saveFlowDraft(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { flowData, flowJson } = req.body;
    const flow = await flowsService.saveFlowDraft(userId, req.params.id, flowData, flowJson);

    res.json({ success: true, flow, draftValidationErrors: flow.draftValidationErrors || [] });
  } catch (error) {
    console.error('[Flows] Save flow draft error:', error);
    sendError(res, error, 'Failed to save flow draft');
  }
}

export async function validateDraft(req: Request, res: Response) {
  try {
    const validation = flowsService.validateFlowJson(req.body?.flowJson);
    res.json({ success: true, ...validation });
  } catch (error) {
    console.error('[Flows] Validate draft error:', error);
    sendError(res, error, 'Failed to validate flow draft');
  }
}

export async function updateAndPublishFlow(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const flow = await flowsService.updateAndPublishFlow(userId, req.params.id);
    res.json({ success: true, flow });
  } catch (error) {
    console.error('[Flows] Update and publish flow error:', error);
    sendError(res, error, 'Failed to update and publish flow');
  }
}

export async function deprecateFlow(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const flow = await flowsService.deprecateFlowInMeta(userId, req.params.id);
    res.json({ success: true, flow });
  } catch (error) {
    console.error('[Flows] Deprecate flow error:', error);
    sendError(res, error, 'Failed to deprecate flow');
  }
}

export async function deleteFlowFromMeta(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    await flowsService.deleteFlowInMeta(userId, req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('[Flows] Delete from Meta error:', error);
    sendError(res, error, 'Failed to delete flow from Meta');
  }
}

export async function getEncryptionStatus(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const status = await flowsService.getPhoneNumberEncryptionStatus(
      userId,
      req.query.phoneNumberId as string
    );

    res.json({ success: true, ...status });
  } catch (error) {
    console.error('[Flows] Get encryption status error:', error);
    sendError(res, error, 'Failed to get endpoint encryption status');
  }
}

export async function setEncryptionKey(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const payload = await flowsService.setPhoneNumberEncryptionPublicKey(userId, {
      businessPhoneNumberId: req.body.phoneNumberId,
      businessPublicKey: req.body.businessPublicKey,
    });

    res.json({ success: true, ...payload });
  } catch (error) {
    console.error('[Flows] Set encryption key error:', error);
    sendError(res, error, 'Failed to set endpoint encryption key');
  }
}
