import fs from 'fs';
import path from 'path';
import * as mongodb from '../modules/storage/mongodb.adapter';

const DATA_FILE = path.join(process.cwd(), 'data', 'storage.json');

interface StorageData {
  users: any[];
  contacts: any[];
  messages: any[];
  campaigns: any[];
  templates: any[];
  automations: any[];
  teamMembers: any[];
  whatsappSettings: any | null;
  billing: any;
  chats: any[];
}

async function migrate() {
  console.log('[Migration] Starting migration from storage.json to MongoDB...');
  
  if (!fs.existsSync(DATA_FILE)) {
    console.log('[Migration] No storage.json file found. Nothing to migrate.');
    return;
  }

  try {
    const rawData = fs.readFileSync(DATA_FILE, 'utf-8');
    const data: StorageData = JSON.parse(rawData);
    
    console.log('[Migration] Found data to migrate:');
    console.log(`  - Users: ${data.users?.length || 0}`);
    console.log(`  - Contacts: ${data.contacts?.length || 0}`);
    console.log(`  - Messages: ${data.messages?.length || 0}`);
    console.log(`  - Campaigns: ${data.campaigns?.length || 0}`);
    console.log(`  - Templates: ${data.templates?.length || 0}`);
    console.log(`  - Automations: ${data.automations?.length || 0}`);
    console.log(`  - Team Members: ${data.teamMembers?.length || 0}`);
    console.log(`  - Chats: ${data.chats?.length || 0}`);
    
    await mongodb.connectToMongoDB();
    
    if (data.users?.length > 0) {
      console.log('[Migration] Migrating users...');
      const existingUsers = await mongodb.findMany<any>('users', {});
      const existingIds = new Set(existingUsers.map((u: any) => u.id));
      const newUsers = data.users.filter(u => !existingIds.has(u.id));
      if (newUsers.length > 0) {
        await mongodb.insertMany('users', newUsers);
      }
      console.log(`[Migration] Users migrated: ${newUsers.length} new, ${data.users.length - newUsers.length} existing`);
    }

    if (data.contacts?.length > 0) {
      console.log('[Migration] Migrating contacts...');
      const existingContacts = await mongodb.findMany<any>('contacts', {});
      const existingIds = new Set(existingContacts.map((c: any) => c.id));
      const newContacts = data.contacts.filter(c => !existingIds.has(c.id));
      if (newContacts.length > 0) {
        await mongodb.insertMany('contacts', newContacts);
      }
      console.log(`[Migration] Contacts migrated: ${newContacts.length} new, ${data.contacts.length - newContacts.length} existing`);
    }

    if (data.messages?.length > 0) {
      console.log('[Migration] Migrating messages...');
      const existingMessages = await mongodb.findMany<any>('messages', {});
      const existingIds = new Set(existingMessages.map((m: any) => m.id));
      const newMessages = data.messages.filter(m => !existingIds.has(m.id));
      if (newMessages.length > 0) {
        const batchSize = 100;
        for (let i = 0; i < newMessages.length; i += batchSize) {
          const batch = newMessages.slice(i, i + batchSize);
          await mongodb.insertMany('messages', batch);
          console.log(`[Migration] Messages batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(newMessages.length/batchSize)} migrated`);
        }
      }
      console.log(`[Migration] Messages migrated: ${newMessages.length} new, ${data.messages.length - newMessages.length} existing`);
    }

    if (data.campaigns?.length > 0) {
      console.log('[Migration] Migrating campaigns...');
      const existingCampaigns = await mongodb.findMany<any>('campaigns', {});
      const existingIds = new Set(existingCampaigns.map((c: any) => c.id));
      const newCampaigns = data.campaigns.filter(c => !existingIds.has(c.id));
      if (newCampaigns.length > 0) {
        await mongodb.insertMany('campaigns', newCampaigns);
      }
      console.log(`[Migration] Campaigns migrated: ${newCampaigns.length} new`);
    }

    if (data.templates?.length > 0) {
      console.log('[Migration] Migrating templates...');
      const existingTemplates = await mongodb.findMany<any>('templates', {});
      const existingIds = new Set(existingTemplates.map((t: any) => t.id));
      const newTemplates = data.templates.filter(t => !existingIds.has(t.id));
      if (newTemplates.length > 0) {
        await mongodb.insertMany('templates', newTemplates);
      }
      console.log(`[Migration] Templates migrated: ${newTemplates.length} new`);
    }

    if (data.automations?.length > 0) {
      console.log('[Migration] Migrating automations...');
      const existingAutomations = await mongodb.findMany<any>('automations', {});
      const existingIds = new Set(existingAutomations.map((a: any) => a.id));
      const newAutomations = data.automations.filter(a => !existingIds.has(a.id));
      if (newAutomations.length > 0) {
        await mongodb.insertMany('automations', newAutomations);
      }
      console.log(`[Migration] Automations migrated: ${newAutomations.length} new`);
    }

    if (data.teamMembers?.length > 0) {
      console.log('[Migration] Migrating team members...');
      const existingMembers = await mongodb.findMany<any>('team_members', {});
      const existingIds = new Set(existingMembers.map((m: any) => m.id));
      const newMembers = data.teamMembers.filter(m => !existingIds.has(m.id));
      if (newMembers.length > 0) {
        await mongodb.insertMany('team_members', newMembers);
      }
      console.log(`[Migration] Team members migrated: ${newMembers.length} new`);
    }

    if (data.whatsappSettings) {
      console.log('[Migration] Migrating WhatsApp settings...');
      const existing = await mongodb.findOne('whatsapp_settings', { id: data.whatsappSettings.id });
      if (!existing) {
        await mongodb.insertOne('whatsapp_settings', data.whatsappSettings);
        console.log('[Migration] WhatsApp settings migrated');
      } else {
        console.log('[Migration] WhatsApp settings already exist');
      }
    }

    if (data.billing) {
      console.log('[Migration] Migrating billing...');
      const existing = await mongodb.findOne('billing', { id: data.billing.id });
      if (!existing) {
        await mongodb.insertOne('billing', data.billing);
        console.log('[Migration] Billing migrated');
      } else {
        console.log('[Migration] Billing already exists');
      }
    }

    console.log('[Migration] Creating chats from contacts and messages...');
    const contacts = await mongodb.findMany<any>('contacts', {});
    const messages = await mongodb.findMany<any>('messages', {});
    const existingChats = await mongodb.findMany<any>('chats', {});
    const existingChatContactIds = new Set(existingChats.map((c: any) => c.contactId));
    
    const newChats: any[] = [];
    for (const contact of contacts) {
      if (!existingChatContactIds.has(contact.id)) {
        const contactMessages = messages.filter((m: any) => m.contactId === contact.id);
        const lastMessage = contactMessages[contactMessages.length - 1];
        const inboundMessages = contactMessages.filter((m: any) => m.direction === "inbound");
        const lastInboundMessage = inboundMessages[inboundMessages.length - 1];
        
        newChats.push({
          id: `chat-${contact.id}`,
          contactId: contact.id,
          lastMessage: lastMessage?.content,
          lastMessageTime: lastMessage?.timestamp,
          lastInboundMessageTime: lastInboundMessage?.timestamp,
          lastInboundMessage: lastInboundMessage?.content,
          unreadCount: contactMessages.filter((m: any) => m.direction === "inbound" && m.status !== "read").length,
          status: "open",
          notes: [],
        });
      }
    }
    
    if (newChats.length > 0) {
      await mongodb.insertMany('chats', newChats);
    }
    console.log(`[Migration] Chats created: ${newChats.length} new, ${existingChats.length} existing`);

    console.log('[Migration] Migration completed successfully!');
    console.log('[Migration] You can now safely delete storage.json if everything works correctly.');
    
    process.exit(0);
  } catch (error) {
    console.error('[Migration] Error during migration:', error);
    process.exit(1);
  }
}

migrate();
