import { Contact, InterestClassificationLog } from '../../storage/mongodb.adapter';
import { DripCampaign, DripRun, AutoTriggerSource } from '../drips/drip.model';
import { autoEnrollContact } from '../drips/drip.service';
import { GoogleGenAI } from '@google/genai';

const INTERESTED_KEYWORDS = [
  'interested', 'yes', 'sure', 'okay', 'ok', 'great', 'perfect', 'sounds good',
  'tell me more', 'more info', 'details', 'how much', 'price', 'cost', 'register',
  'sign up', 'join', 'apply', 'want to', 'would like', 'count me in', 'im in',
  'i am in', 'definitely', 'absolutely', 'please', 'send', 'share', 'benefits'
];

const NOT_INTERESTED_KEYWORDS = [
  'not interested', 'no thanks', 'no thank you', 'stop', 'unsubscribe', 
  'remove', 'dont contact', 'not now', 'maybe later', 'busy', 'no',
  'not for me', 'pass', 'decline', 'reject', 'spam', 'block', 'leave me alone'
];

interface ClassificationResult {
  status: 'interested' | 'not_interested' | 'neutral' | 'pending';
  confidence: number;
  method: 'ai' | 'keyword' | 'manual';
  keywords: string[];
  aiResponse?: string;
}

export class InterestClassificationService {
  private genAI: GoogleGenAI | null = null;

  constructor() {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenAI({ apiKey });
    }
  }

  async classifyMessage(
    messageContent: string,
    contactPhone: string,
    userId: string,
    useAI: boolean = true
  ): Promise<ClassificationResult> {
    const lowerMessage = messageContent.toLowerCase().trim();
    
    const foundInterestedKeywords = INTERESTED_KEYWORDS.filter(kw => 
      lowerMessage.includes(kw.toLowerCase())
    );
    const foundNotInterestedKeywords = NOT_INTERESTED_KEYWORDS.filter(kw => 
      lowerMessage.includes(kw.toLowerCase())
    );

    if (foundNotInterestedKeywords.length > 0 && foundInterestedKeywords.length === 0) {
      return {
        status: 'not_interested',
        confidence: 0.85,
        method: 'keyword',
        keywords: foundNotInterestedKeywords
      };
    }

    if (foundInterestedKeywords.length > 0 && foundNotInterestedKeywords.length === 0) {
      return {
        status: 'interested',
        confidence: 0.85,
        method: 'keyword',
        keywords: foundInterestedKeywords
      };
    }

    if (useAI && this.genAI) {
      try {
        return await this.classifyWithAI(messageContent);
      } catch (error) {
        console.error('[InterestClassification] AI classification failed:', error);
      }
    }

    return {
      status: 'neutral',
      confidence: 0.5,
      method: 'keyword',
      keywords: [...foundInterestedKeywords, ...foundNotInterestedKeywords]
    };
  }

  private async classifyWithAI(messageContent: string): Promise<ClassificationResult> {
    if (!this.genAI) {
      throw new Error('Gemini AI not initialized');
    }

    const prompt = `Analyze the following WhatsApp message and classify the sender's interest level.

Message: "${messageContent}"

Classify as one of:
- "interested": The person shows clear interest, asks for more info, wants to proceed, or gives positive responses
- "not_interested": The person clearly declines, refuses, asks to stop, or shows negative sentiment
- "neutral": The message is unclear, just asking a question, or doesn't indicate clear interest either way

Respond ONLY with a JSON object in this exact format (no markdown, no code blocks):
{"status": "interested|not_interested|neutral", "confidence": 0.0-1.0, "reason": "brief explanation"}`;

    const response = await this.genAI.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });

    const text = response.text?.trim() || '';
    
    try {
      const cleanedText = text.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(cleanedText);
      
      const validStatuses = ['interested', 'not_interested', 'neutral'];
      const status = validStatuses.includes(parsed.status) ? parsed.status : 'neutral';
      
      return {
        status: status as 'interested' | 'not_interested' | 'neutral',
        confidence: Math.min(1, Math.max(0, parsed.confidence || 0.7)),
        method: 'ai',
        keywords: [],
        aiResponse: parsed.reason || text
      };
    } catch (parseError) {
      console.error('[InterestClassification] Failed to parse AI response:', text);
      return {
        status: 'neutral',
        confidence: 0.5,
        method: 'ai',
        keywords: [],
        aiResponse: text
      };
    }
  }

  async classifyAndUpdateContact(
    messageContent: string,
    contactId: string,
    contactPhone: string,
    userId: string
  ): Promise<{ classification: ClassificationResult; triggeredCampaigns: string[] }> {
    const contact = await Contact.findOne({ id: contactId });
    if (!contact) {
      throw new Error(`Contact not found: ${contactId}`);
    }

    const previousStatus = contact.interestStatus || 'pending';
    const classification = await this.classifyMessage(messageContent, contactPhone, userId);
    
    await Contact.updateOne(
      { id: contactId },
      {
        $set: {
          interestStatus: classification.status,
          interestConfidence: classification.confidence,
          lastInterestUpdate: new Date(),
          lastInboundAt: new Date(),
          updatedAt: new Date().toISOString()
        }
      }
    );

    const triggeredCampaigns: string[] = [];
    
    if (classification.status !== 'pending') {
      const eligibleCampaigns = await this.findEligibleCampaigns(userId, classification.status);
      
      for (const campaign of eligibleCampaigns) {
        const enrolled = await this.enrollContactInCampaign(contact, campaign);
        if (enrolled) {
          triggeredCampaigns.push(campaign._id.toString());
        }
      }

      const triggerSource = `interest_${classification.status}` as AutoTriggerSource;
      try {
        const autoTriggerResult = await autoEnrollContact(
          userId,
          contactId,
          contactPhone,
          triggerSource,
          {
            contactName: contact.name,
            interestStatus: classification.status,
            confidence: classification.confidence
          }
        );
        
        if (autoTriggerResult.enrolled.length > 0) {
          console.log(`[InterestClassification] Auto-triggered campaigns: ${autoTriggerResult.enrolled.join(', ')}`);
        }
      } catch (autoTriggerError) {
        console.error('[InterestClassification] Auto-trigger enrollment failed:', autoTriggerError);
      }
    }

    await InterestClassificationLog.create({
      contactId,
      contactPhone,
      userId,
      messageContent,
      previousStatus,
      newStatus: classification.status,
      confidence: classification.confidence,
      classificationMethod: classification.method,
      aiResponse: classification.aiResponse,
      keywords: classification.keywords,
      triggeredCampaigns,
      createdAt: new Date()
    });

    return { classification, triggeredCampaigns };
  }

  private async findEligibleCampaigns(userId: string, interestStatus: string): Promise<any[]> {
    return await DripCampaign.find({
      userId,
      status: 'active',
      targetType: 'interest',
      'interestTargeting.autoEnroll': true,
      'interestTargeting.enrollOnClassification': true,
      'interestTargeting.targetInterestLevels': interestStatus
    });
  }

  private async enrollContactInCampaign(contact: any, campaign: any): Promise<boolean> {
    const existingRun = await DripRun.findOne({
      campaignId: campaign._id,
      contactId: contact.id
    });

    if (existingRun && !campaign.settings.allowReEntry) {
      return false;
    }

    const firstStep = campaign.steps[0];
    const scheduledTime = this.calculateNextStepTime(campaign, firstStep);

    await DripRun.create({
      campaignId: campaign._id,
      userId: campaign.userId,
      contactId: contact.id,
      contactPhone: contact.phone,
      status: 'active',
      currentStepIndex: 0,
      enrolledAt: new Date(),
      nextStepScheduledAt: scheduledTime,
      stepHistory: [],
      variables: {
        contactName: contact.name,
        interestStatus: contact.interestStatus
      }
    });

    await DripCampaign.updateOne(
      { _id: campaign._id },
      { $inc: { 'metrics.totalEnrolled': 1, 'metrics.activeContacts': 1 } }
    );

    await Contact.updateOne(
      { id: contact.id },
      { $addToSet: { assignedDripCampaignIds: campaign._id.toString() } }
    );

    console.log(`[InterestClassification] Enrolled contact ${contact.phone} in campaign ${campaign.name}`);
    return true;
  }

  private calculateNextStepTime(campaign: any, step: any): Date {
    const now = new Date();
    const dayOffset = step.dayOffset || 0;
    const timeOfDay = step.timeOfDay || campaign.schedule.startTime || '09:00';
    
    const [hours, minutes] = timeOfDay.split(':').map(Number);
    const scheduledDate = new Date(now);
    scheduledDate.setDate(scheduledDate.getDate() + dayOffset);
    scheduledDate.setHours(hours, minutes, 0, 0);
    
    return scheduledDate;
  }

  async getInterestLists(userId: string): Promise<{
    interested: any[];
    notInterested: any[];
    neutral: any[];
    pending: any[];
    stats: {
      total: number;
      interested: number;
      notInterested: number;
      neutral: number;
      pending: number;
    };
  }> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const contacts = await Contact.find({
      lastInboundAt: { $gte: twentyFourHoursAgo }
    }).lean();

    const interested = contacts.filter(c => c.interestStatus === 'interested');
    const notInterested = contacts.filter(c => c.interestStatus === 'not_interested');
    const neutral = contacts.filter(c => c.interestStatus === 'neutral');
    const pending = contacts.filter(c => c.interestStatus === 'pending' || !c.interestStatus);

    return {
      interested,
      notInterested,
      neutral,
      pending,
      stats: {
        total: contacts.length,
        interested: interested.length,
        notInterested: notInterested.length,
        neutral: neutral.length,
        pending: pending.length
      }
    };
  }

  async getClassificationLogs(userId: string, options: {
    contactId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ logs: any[]; total: number }> {
    const query: any = { userId };
    
    if (options.contactId) {
      query.contactId = options.contactId;
    }
    if (options.status) {
      query.newStatus = options.status;
    }

    const total = await InterestClassificationLog.countDocuments(query);
    const logs = await InterestClassificationLog.find(query)
      .sort({ createdAt: -1 })
      .skip(options.offset || 0)
      .limit(options.limit || 50)
      .lean();

    return { logs, total };
  }

  async manuallyClassifyContact(
    contactId: string,
    userId: string,
    newStatus: 'interested' | 'not_interested' | 'neutral'
  ): Promise<void> {
    const contact = await Contact.findOne({ id: contactId });
    if (!contact) {
      throw new Error(`Contact not found: ${contactId}`);
    }

    const previousStatus = contact.interestStatus;

    await Contact.updateOne(
      { id: contactId },
      {
        $set: {
          interestStatus: newStatus,
          interestConfidence: 1.0,
          lastInterestUpdate: new Date(),
          updatedAt: new Date().toISOString()
        }
      }
    );

    await InterestClassificationLog.create({
      contactId,
      contactPhone: contact.phone,
      userId,
      messageContent: 'Manual classification',
      previousStatus,
      newStatus,
      confidence: 1.0,
      classificationMethod: 'manual',
      createdAt: new Date()
    });
  }

  async getInterestReport(userId: string, days: number = 7): Promise<{
    distribution: { status: string; count: number; percentage: number }[];
    timeline: { date: string; interested: number; notInterested: number; neutral: number }[];
    conversionRate: number;
    topKeywords: { keyword: string; count: number }[];
    campaignPerformance: { campaignId: string; name: string; enrolled: number; converted: number }[];
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const contacts = await Contact.find({
      lastInterestUpdate: { $gte: startDate }
    }).lean();

    const total = contacts.length || 1;
    const interested = contacts.filter(c => c.interestStatus === 'interested').length;
    const notInterested = contacts.filter(c => c.interestStatus === 'not_interested').length;
    const neutral = contacts.filter(c => c.interestStatus === 'neutral').length;
    const pending = contacts.filter(c => c.interestStatus === 'pending' || !c.interestStatus).length;

    const distribution = [
      { status: 'interested', count: interested, percentage: Math.round((interested / total) * 100) },
      { status: 'not_interested', count: notInterested, percentage: Math.round((notInterested / total) * 100) },
      { status: 'neutral', count: neutral, percentage: Math.round((neutral / total) * 100) },
      { status: 'pending', count: pending, percentage: Math.round((pending / total) * 100) }
    ];

    const logs = await InterestClassificationLog.find({
      userId,
      createdAt: { $gte: startDate }
    }).lean();

    const timelineMap: Record<string, { interested: number; notInterested: number; neutral: number }> = {};
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      timelineMap[dateKey] = { interested: 0, notInterested: 0, neutral: 0 };
    }

    for (const log of logs) {
      const dateKey = new Date(log.createdAt).toISOString().split('T')[0];
      if (timelineMap[dateKey]) {
        if (log.newStatus === 'interested') timelineMap[dateKey].interested++;
        else if (log.newStatus === 'not_interested') timelineMap[dateKey].notInterested++;
        else if (log.newStatus === 'neutral') timelineMap[dateKey].neutral++;
      }
    }

    const timeline = Object.entries(timelineMap)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const conversions = logs.filter(l => 
      l.previousStatus === 'not_interested' && l.newStatus === 'interested'
    ).length;
    const eligibleForConversion = logs.filter(l => l.previousStatus === 'not_interested').length;
    const conversionRate = eligibleForConversion > 0 
      ? Math.round((conversions / eligibleForConversion) * 100) 
      : 0;

    const keywordCounts: Record<string, number> = {};
    for (const log of logs) {
      for (const keyword of log.keywords || []) {
        keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1;
      }
    }
    const topKeywords = Object.entries(keywordCounts)
      .map(([keyword, count]) => ({ keyword, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const campaigns = await DripCampaign.find({
      userId,
      targetType: 'interest'
    }).lean();

    const campaignPerformance = [];
    for (const campaign of campaigns) {
      const runs = await DripRun.find({ campaignId: campaign._id }).lean();
      const converted = runs.filter(r => r.exitReason === 'converted').length;
      campaignPerformance.push({
        campaignId: campaign._id.toString(),
        name: campaign.name,
        enrolled: runs.length,
        converted
      });
    }

    return {
      distribution,
      timeline,
      conversionRate,
      topKeywords,
      campaignPerformance
    };
  }
}

export const interestClassificationService = new InterestClassificationService();
