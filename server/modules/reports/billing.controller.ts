import { Request, Response } from 'express';
import { billingService, BillingFilter } from './billing.service';
import { getUserId } from '../auth/auth.routes';

function parseBillingFilter(req: Request): BillingFilter {
  const period = (req.query.period as string) || 'month';
  const startDate = req.query.startDate as string;
  const endDate = req.query.endDate as string;

  return {
    period: period as BillingFilter['period'],
    startDate,
    endDate
  };
}

export async function getBillingSummary(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const filter = parseBillingFilter(req);
    const summary = await billingService.getBillingSummary(userId, filter);

    res.json(summary);
  } catch (error: any) {
    console.error('[Billing] Error getting billing summary:', error);
    res.status(500).json({ error: 'Failed to get billing summary' });
  }
}

export async function getConversationsBilling(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const filter = parseBillingFilter(req);
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await billingService.getConversationsBilling(userId, filter, { limit, offset });

    res.json(result);
  } catch (error: any) {
    console.error('[Billing] Error getting conversations billing:', error);
    res.status(500).json({ error: 'Failed to get conversations billing' });
  }
}

export async function getAllUsersBilling(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const filter = parseBillingFilter(req);
    const result = await billingService.getAllUsersBillingSummary(filter);

    res.json(result);
  } catch (error: any) {
    console.error('[Billing] Error getting all users billing:', error);
    res.status(500).json({ error: 'Failed to get all users billing' });
  }
}
