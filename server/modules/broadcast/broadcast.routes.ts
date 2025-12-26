import { Router, Request, Response } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import * as broadcastService from './broadcast.service';
import * as campaignController from './campaign.controller';
import { requireAuth } from '../auth/auth.routes';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/lists', async (req: Request, res: Response) => {
  try {
    const lists = await broadcastService.getBroadcastLists();
    res.json(lists);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get broadcast lists' });
  }
});

router.get('/lists/:id', async (req: Request, res: Response) => {
  try {
    const list = await broadcastService.getBroadcastListById(req.params.id);
    if (!list) {
      return res.status(404).json({ error: 'List not found' });
    }
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get broadcast list' });
  }
});

router.post('/lists', async (req: Request, res: Response) => {
  try {
    const { name, contacts } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'List name is required' });
    }
    const list = await broadcastService.createBroadcastList(name, contacts || []);
    res.status(201).json(list);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create broadcast list' });
  }
});

router.put('/lists/:id', async (req: Request, res: Response) => {
  try {
    const { name, contacts } = req.body;
    const list = await broadcastService.updateBroadcastList(req.params.id, name, contacts);
    if (!list) {
      return res.status(404).json({ error: 'List not found' });
    }
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update broadcast list' });
  }
});

router.delete('/lists/:id', async (req: Request, res: Response) => {
  try {
    const success = await broadcastService.deleteBroadcastList(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'List not found' });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete broadcast list' });
  }
});

router.post('/import-excel', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log(`[ImportExcel] Processing file: ${req.file.originalname}, size: ${req.file.size} bytes`);
    
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    console.log(`[ImportExcel] Raw rows from Excel: ${data.length}`);
    
    const result = broadcastService.parseExcelContacts(data);
    
    if (result.validContacts === 0 && data.length > 0) {
      const columnNames = data[0] ? Object.keys(data[0] as object).join(', ') : 'none found';
      return res.status(400).json({ 
        error: `No valid contacts found. Detected columns: ${columnNames}. Make sure your file has 'Name' and 'Mobile' (or 'Phone') columns.`,
        errors: result.errors,
        totalRows: result.totalRows,
      });
    }
    
    const saveResult = await broadcastService.saveImportedContacts(result.contacts, 'excel');
    
    res.json({
      success: true,
      contacts: result.contacts,
      totalRows: result.totalRows,
      validContacts: result.validContacts,
      savedContacts: saveResult.saved,
      duplicates: saveResult.duplicates,
      errors: result.errors,
    });
  } catch (error) {
    console.error('Excel import error:', error);
    res.status(500).json({ error: 'Failed to parse Excel file. Make sure it is a valid .xlsx, .xls, or .csv file.' });
  }
});

router.post('/import-csv', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log(`[ImportCSV] Processing file: ${req.file.originalname}, size: ${req.file.size} bytes`);
    
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    console.log(`[ImportCSV] Raw rows from CSV: ${data.length}`);
    
    const result = broadcastService.parseExcelContacts(data);
    
    if (result.validContacts === 0 && data.length > 0) {
      const columnNames = data[0] ? Object.keys(data[0] as object).join(', ') : 'none found';
      return res.status(400).json({ 
        error: `No valid contacts found. Detected columns: ${columnNames}. Make sure your file has 'Name' and 'Mobile' (or 'Phone') columns.`,
        errors: result.errors,
        totalRows: result.totalRows,
      });
    }
    
    const saveResult = await broadcastService.saveImportedContacts(result.contacts, 'csv');
    
    res.json({
      success: true,
      contacts: result.contacts,
      totalRows: result.totalRows,
      validContacts: result.validContacts,
      savedContacts: saveResult.saved,
      duplicates: saveResult.duplicates,
      errors: result.errors,
    });
  } catch (error) {
    console.error('CSV import error:', error);
    res.status(500).json({ error: 'Failed to parse CSV file. Make sure it is a valid .csv file.' });
  }
});

router.get('/export-contacts', async (req: Request, res: Response) => {
  try {
    const { listId } = req.query;
    let contacts: broadcastService.BroadcastContact[] = [];

    if (listId && typeof listId === 'string') {
      const list = await broadcastService.getBroadcastListById(listId);
      if (list) {
        contacts = list.contacts;
      }
    } else {
      const lists = await broadcastService.getBroadcastLists();
      contacts = lists.flatMap(l => l.contacts);
    }

    const exportData = broadcastService.exportContactsToJSON(contacts);
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Contacts');
    
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=contacts.xlsx');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: 'Failed to export contacts' });
  }
});

router.get('/schedules', async (req: Request, res: Response) => {
  try {
    const schedules = await broadcastService.getScheduledMessages();
    res.json(schedules);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get scheduled messages' });
  }
});

router.post('/schedules', async (req: Request, res: Response) => {
  try {
    const { name, messageType, templateName, customMessage, agentId, contactIds, listId, scheduledAt, recipientCount } = req.body;
    
    if (!name || !messageType || !scheduledAt) {
      return res.status(400).json({ error: 'Name, message type, and scheduled time are required' });
    }

    const schedule = await broadcastService.createScheduledMessage({
      name,
      messageType,
      templateName,
      customMessage,
      agentId,
      contactIds,
      listId,
      scheduledAt,
      status: 'scheduled',
      recipientCount: recipientCount || 0,
    });
    
    res.status(201).json(schedule);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create scheduled message' });
  }
});

router.put('/schedules/:id', async (req: Request, res: Response) => {
  try {
    const schedule = await broadcastService.updateScheduledMessage(req.params.id, req.body);
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    res.json(schedule);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update schedule' });
  }
});

router.delete('/schedules/:id', async (req: Request, res: Response) => {
  try {
    const success = await broadcastService.deleteScheduledMessage(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete schedule' });
  }
});

router.post('/send', async (req: Request, res: Response) => {
  try {
    const {
      contacts,
      messageType,
      templateName,
      customMessage,
      agentId,
      campaignName,
      isScheduled = false,
      scheduledTime
    } = req.body;

    console.log('[Broadcast API] Received request:', { 
      contacts: contacts?.length, 
      messageType, 
      templateName, 
      campaignName,
      isScheduled,
      scheduledTime
    });

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({ error: 'Contacts are required' });
    }

    if (!messageType) {
      return res.status(400).json({ error: 'Message type is required' });
    }

    // Validate scheduling
    if (isScheduled) {
      if (!scheduledTime) {
        return res.status(400).json({ error: 'scheduledTime is required when scheduling' });
      }
      const scheduledDate = new Date(scheduledTime);
      if (isNaN(scheduledDate.getTime())) {
        return res.status(400).json({ error: 'Invalid scheduledTime format' });
      }
      if (scheduledDate <= new Date()) {
        return res.status(400).json({ error: 'Scheduled time must be in the future' });
      }
    }

    const result = await broadcastService.sendBroadcast(contacts, messageType, {
      templateName,
      customMessage,
      agentId,
      campaignName,
      isScheduled,
      scheduledTime,
    });

    console.log('[Broadcast API] Result:', result);

    if (result.credentialError) {
      return res.status(400).json({ 
        error: result.credentialError,
        ...result,
      });
    }

    res.json(result);
  } catch (error) {
    console.error('Broadcast send error:', error);
    res.status(500).json({ error: 'Failed to send broadcast' });
  }
});

router.post('/send-single', async (req: Request, res: Response) => {
  try {
    const { phone, name, messageType, templateName, customMessage, agentId } = req.body;
    
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }
    
    if (!messageType) {
      return res.status(400).json({ error: 'Message type is required' });
    }

    const result = await broadcastService.sendSingleMessage(phone, name || '', messageType, {
      templateName,
      customMessage,
      agentId,
    });
    
    res.json(result);
  } catch (error) {
    console.error('Single message send error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

router.post('/send-to-list/:listId', async (req: Request, res: Response) => {
  try {
    const { messageType, templateName, customMessage, agentId, campaignName } = req.body;
    const list = await broadcastService.getBroadcastListById(req.params.listId);
    
    if (!list) {
      return res.status(404).json({ error: 'List not found' });
    }
    
    if (!messageType) {
      return res.status(400).json({ error: 'Message type is required' });
    }

    const result = await broadcastService.sendBroadcast(list.contacts, messageType, {
      templateName,
      customMessage,
      agentId,
      campaignName,
    });
    
    res.json(result);
  } catch (error) {
    console.error('List broadcast send error:', error);
    res.status(500).json({ error: 'Failed to send broadcast to list' });
  }
});

router.get('/scheduled-broadcasts', async (req: Request, res: Response) => {
  try {
    const broadcasts = await broadcastService.getScheduledBroadcasts();
    console.log(`[ScheduledBroadcasts API] Fetched ${broadcasts.length} scheduled broadcasts`);
    res.json(broadcasts);
  } catch (error) {
    console.error('[ScheduledBroadcasts API] Error:', error);
    res.status(500).json({ error: 'Failed to get scheduled broadcasts' });
  }
});

router.post('/scheduled-broadcasts/:id/cancel', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const success = await broadcastService.cancelScheduledBroadcast(id);
    if (success) {
      res.json({ message: 'Broadcast cancelled successfully' });
    } else {
      res.status(400).json({ error: 'Failed to cancel broadcast' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to cancel broadcast' });
  }
});

router.delete('/scheduled-broadcasts/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const success = await broadcastService.deleteScheduledBroadcast(id);
    if (success) {
      res.json({ message: 'Broadcast deleted successfully' });
    } else {
      res.status(404).json({ error: 'Broadcast not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete broadcast' });
  }
});

router.get('/logs', async (req: Request, res: Response) => {
  try {
    const { campaignName, status, phone, limit, offset } = req.query;
    const logs = await broadcastService.getBroadcastLogs({
      campaignName: campaignName as string | undefined,
      status: status as string | undefined,
      phone: phone as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : 100,
      offset: offset ? parseInt(offset as string, 10) : 0,
    });
    res.json(logs);
  } catch (error) {
    console.error('Failed to get broadcast logs:', error);
    res.status(500).json({ error: 'Failed to get broadcast logs' });
  }
});

router.get('/imported-contacts', async (req: Request, res: Response) => {
  try {
    const contacts = await broadcastService.getImportedContacts();
    res.json(contacts);
  } catch (error) {
    console.error('Failed to get imported contacts:', error);
    res.status(500).json({ error: 'Failed to get imported contacts' });
  }
});

router.delete('/imported-contacts/:id', async (req: Request, res: Response) => {
  try {
    const success = await broadcastService.deleteImportedContact(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.status(204).send();
  } catch (error) {
    console.error('Failed to delete imported contact:', error);
    res.status(500).json({ error: 'Failed to delete imported contact' });
  }
});

router.get('/campaigns/contacts/all', requireAuth, campaignController.getAllContacts);
router.get('/campaigns/contacts/available', requireAuth, campaignController.getAvailableContacts);
router.get('/campaigns', requireAuth, campaignController.getCampaigns);
router.post('/campaigns', requireAuth, campaignController.createCampaign);
router.get('/campaigns/:id', requireAuth, campaignController.getCampaignById);
router.post('/campaigns/:id/execute', requireAuth, campaignController.executeCampaign);
router.get('/campaigns/:id/interested', requireAuth, campaignController.getInterestedContacts);
router.get('/campaigns/:id/not-interested', requireAuth, campaignController.getNotInterestedContacts);
router.post('/campaigns/:id/send-to-list', requireAuth, campaignController.sendToInterestList);
router.delete('/campaigns/:id', requireAuth, campaignController.deleteCampaign);

export default router;
