import { Router, Request, Response, NextFunction } from 'express';
import * as controller from './whatsapp.controller';
import * as flowsController from './flows.controller';
import { requireAuth } from '../auth/auth.routes';

const router = Router();

router.get('/', controller.verifyWebhook);
router.post('/', controller.handleWebhook);
router.get('/config', requireAuth, controller.getWebhookConfig);
router.get('/status-events', requireAuth, controller.getWebhookStatusEvents);
router.post('/send', controller.sendMessage);
router.post('/send-template', requireAuth, controller.sendTemplateMessageEndpoint);
router.get('/conversations', controller.getConversations);
router.get('/conversations/:phone', controller.getConversation);
router.get('/media/:mediaId', controller.getMediaUrl);

router.post('/flows/sync', requireAuth, flowsController.syncFlows);
router.post('/flows/create', requireAuth, flowsController.createFlow);
router.post('/flows/validate-json', requireAuth, flowsController.validateDraft);
router.get('/flows', requireAuth, flowsController.getFlows);
router.get('/flows/stats', requireAuth, flowsController.getFlowStats);
router.get('/flows/sync-status', requireAuth, flowsController.getSyncStatus);
router.get('/flows/encryption', requireAuth, flowsController.getEncryptionStatus);
router.post('/flows/encryption', requireAuth, flowsController.setEncryptionKey);
router.get('/flows/:id/meta', requireAuth, flowsController.getFlowMeta);
router.post('/flows/:id/meta', requireAuth, flowsController.updateFlowMeta);
router.post('/flows/:id/preview/refresh', requireAuth, flowsController.refreshFlowPreview);
router.post('/flows/:id/clone', requireAuth, flowsController.cloneMetaFlow);
router.get('/flows/:id/assets', requireAuth, flowsController.getFlowAssets);
router.get('/flows/:id/assets/:assetId/download', requireAuth, flowsController.downloadFlowAsset);
router.get('/flows/:id/metrics', requireAuth, flowsController.getFlowMetrics);
router.get('/flows/:id', requireAuth, flowsController.getFlowById);
router.put('/flows/:id/entry-points', requireAuth, flowsController.updateEntryPoints);
router.post('/flows/:id/attach-template', requireAuth, flowsController.attachToTemplate);
router.delete('/flows/:id/attach-template/:templateId', requireAuth, flowsController.detachFromTemplate);
router.post('/flows/:id/attach-agent', requireAuth, flowsController.attachToAgent);
router.delete('/flows/:id/attach-agent/:agentId', requireAuth, flowsController.detachFromAgent);
router.post('/flows/:id/send', requireAuth, flowsController.sendFlow);
router.post('/flows/:id/send-test', requireAuth, flowsController.sendFlowTest);
router.post('/flows/:id/publish', requireAuth, flowsController.publishFlow);
router.post('/flows/:id/publish-meta', requireAuth, flowsController.updateAndPublishFlow);
router.post('/flows/:id/draft', requireAuth, flowsController.saveFlowDraft);
router.post('/flows/:id/deprecate', requireAuth, flowsController.deprecateFlow);
router.delete('/flows/:id', requireAuth, flowsController.deleteFlow);
router.delete('/flows/:id/meta', requireAuth, flowsController.deleteFlowFromMeta);

export default router;
