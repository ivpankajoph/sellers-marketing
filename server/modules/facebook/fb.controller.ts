import { Request, Response } from 'express';
import * as fbService from './fb.service';

export async function syncForms(req: Request, res: Response) {
  try {
    const forms = await fbService.syncLeadForms();
    res.json({ success: true, forms, count: forms.length });
  } catch (error: any) {
    console.error('Error syncing forms:', error);
    res.status(500).json({ error: error.message || 'Failed to sync forms' });
  }
}

export async function listForms(req: Request, res: Response) {
  try {
    const forms = await fbService.getAllForms();
    res.json(forms);
  } catch (error) {
    console.error('Error listing forms:', error);
    res.status(500).json({ error: 'Failed to list forms' });
  }
}

export async function getForm(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const form = await fbService.getFormById(id);
    if (!form) {
      return res.status(404).json({ error: 'Form not found' });
    }
    res.json(form);
  } catch (error) {
    console.error('Error getting form:', error);
    res.status(500).json({ error: 'Failed to get form' });
  }
}

export async function syncLeads(req: Request, res: Response) {
  try {
    const { formId } = req.params;
    const leads = await fbService.syncLeadsForForm(formId);
    res.json({ success: true, leads, count: leads.length });
  } catch (error: any) {
    console.error('Error syncing leads:', error);
    res.status(500).json({ error: error.message || 'Failed to sync leads' });
  }
}

export async function listLeads(req: Request, res: Response) {
  try {
    const { formId } = req.query;
    const leads = formId 
      ? await fbService.getLeadsByFormId(formId as string)
      : await fbService.getAllLeads();
    res.json(leads);
  } catch (error) {
    console.error('Error listing leads:', error);
    res.status(500).json({ error: 'Failed to list leads' });
  }
}

export async function getLead(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const lead = await fbService.getLeadById(id);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    res.json(lead);
  } catch (error) {
    console.error('Error getting lead:', error);
    res.status(500).json({ error: 'Failed to get lead' });
  }
}
