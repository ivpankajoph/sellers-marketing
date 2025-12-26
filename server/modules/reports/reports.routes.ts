import { Router, Request, Response } from 'express';
import { reportsService, TimeFilter } from './reports.service';
import { getUserId } from '../auth/auth.routes';
import { requireAuth } from '../auth/auth.routes';
import * as billingController from './billing.controller';

const router = Router();

function parseTimeFilter(req: Request): TimeFilter {
  const period = (req.query.period as string) || 'week';
  const startDate = req.query.startDate as string;
  const endDate = req.query.endDate as string;
  
  return {
    period: period as TimeFilter['period'],
    startDate,
    endDate,
  };
}

router.get('/ai-agents', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req) || undefined;
    const filter = parseTimeFilter(req);
    const data = await reportsService.getAIAgentPerformance(filter, userId);
    res.json(data);
  } catch (error) {
    console.error('[Reports] Error fetching AI agent performance:', error);
    res.status(500).json({ error: 'Failed to fetch AI agent performance data' });
  }
});

router.get('/customer-replies', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req) || undefined;
    const filter = parseTimeFilter(req);
    const data = await reportsService.getCustomerReplies(filter, userId);
    res.json(data);
  } catch (error) {
    console.error('[Reports] Error fetching customer replies:', error);
    res.status(500).json({ error: 'Failed to fetch customer replies data' });
  }
});

router.get('/user-engagement', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req) || undefined;
    const filter = parseTimeFilter(req);
    const data = await reportsService.getUserEngagement(filter, userId);
    res.json(data);
  } catch (error) {
    console.error('[Reports] Error fetching user engagement:', error);
    res.status(500).json({ error: 'Failed to fetch user engagement data' });
  }
});

router.get('/spending', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req) || undefined;
    const filter = parseTimeFilter(req);
    const data = await reportsService.getSpendingReport(filter, userId);
    res.json(data);
  } catch (error) {
    console.error('[Reports] Error fetching spending report:', error);
    res.status(500).json({ error: 'Failed to fetch spending data' });
  }
});

router.get('/overview', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req) || undefined;
    const filter = parseTimeFilter(req);
    const data = await reportsService.getDashboardOverview(filter, userId);
    res.json(data);
  } catch (error) {
    console.error('[Reports] Error fetching overview:', error);
    res.status(500).json({ error: 'Failed to fetch overview data' });
  }
});

router.get('/campaign-performance', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req) || undefined;
    const filter = parseTimeFilter(req);
    const data = await reportsService.getCampaignPerformance(filter, userId);
    res.json(data);
  } catch (error) {
    console.error('[Reports] Error fetching campaign performance:', error);
    res.status(500).json({ error: 'Failed to fetch campaign performance data' });
  }
});

router.get('/blocked-contacts', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const data = await reportsService.getBlockedContactsReport(userId);
    res.json(data);
  } catch (error) {
    console.error('[Reports] Error fetching blocked contacts report:', error);
    res.status(500).json({ error: 'Failed to fetch blocked contacts report' });
  }
});

router.get('/24hour-window', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req) || undefined;
    const filter = parseTimeFilter(req);
    const data = await reportsService.get24HourWindowStats(filter, userId);
    res.json(data);
  } catch (error) {
    console.error('[Reports] Error fetching 24-hour window stats:', error);
    res.status(500).json({ error: 'Failed to fetch 24-hour window stats' });
  }
});

router.get('/enhanced-dashboard', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req) || undefined;
    const filter = parseTimeFilter(req);
    const data = await reportsService.getEnhancedDashboardStats(filter, userId);
    res.json(data);
  } catch (error) {
    console.error('[Reports] Error fetching enhanced dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch enhanced dashboard stats' });
  }
});

router.get('/billing/summary', requireAuth, billingController.getBillingSummary);
router.get('/billing/conversations', requireAuth, billingController.getConversationsBilling);
router.get('/billing/all-users', requireAuth, billingController.getAllUsersBilling);

export default router;
