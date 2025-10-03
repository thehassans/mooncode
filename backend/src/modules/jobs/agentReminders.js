import ChatMeta from '../models/ChatMeta.js';
import User from '../models/User.js';

/**
 * Background job to send reminder messages to agents who haven't replied
 * within 5 minutes of being assigned a chat
 */

let reminderInterval = null;

// Helper function to get country info from phone number
function getCountryFromPhone(phone) {
  const phoneDigits = phone.replace(/[^0-9]/g, '');
  
  // Common country codes and their info
  const countryMap = {
    '971': { name: 'United Arab Emirates', flag: '🇦🇪' },
    '966': { name: 'Saudi Arabia', flag: '🇸🇦' },
    '968': { name: 'Oman', flag: '🇴🇲' },
    '973': { name: 'Bahrain', flag: '🇧🇭' },
    '974': { name: 'Qatar', flag: '🇶🇦' },
    '965': { name: 'Kuwait', flag: '🇰🇼' },
    '962': { name: 'Jordan', flag: '🇯🇴' },
    '963': { name: 'Syria', flag: '🇸🇾' },
    '964': { name: 'Iraq', flag: '🇮🇶' },
    '961': { name: 'Lebanon', flag: '🇱🇧' },
    '967': { name: 'Yemen', flag: '🇾🇪' },
    '20': { name: 'Egypt', flag: '🇪🇬' },
    '212': { name: 'Morocco', flag: '🇲🇦' },
    '213': { name: 'Algeria', flag: '🇩🇿' },
    '216': { name: 'Tunisia', flag: '🇹🇳' },
    '218': { name: 'Libya', flag: '🇱🇾' },
    '249': { name: 'Sudan', flag: '🇸🇩' },
    '92': { name: 'Pakistan', flag: '🇵🇰' },
    '91': { name: 'India', flag: '🇮🇳' },
    '880': { name: 'Bangladesh', flag: '🇧🇩' },
    '1': { name: 'USA/Canada', flag: '🇺🇸' },
    '44': { name: 'United Kingdom', flag: '🇬🇧' },
  };
  
  // Try to match country codes (longest first for accuracy)
  const codes = Object.keys(countryMap).sort((a, b) => b.length - a.length);
  for (const code of codes) {
    if (phoneDigits.startsWith(code)) {
      return countryMap[code];
    }
  }
  
  return { name: 'Unknown Country', flag: '🌍' };
}

export function startAgentReminderJob(getWaService) {
  // Run every 30 seconds
  if (reminderInterval) return; // Already running
  
  console.log('[AgentReminders] Starting reminder job (checks every 30s)');
  
  reminderInterval = setInterval(async () => {
    try {
      await checkAndSendReminders(getWaService);
    } catch (err) {
      console.error('[AgentReminders] Error in reminder job:', err);
    }
  }, 30 * 1000); // 30 seconds
}

export function stopAgentReminderJob() {
  if (reminderInterval) {
    clearInterval(reminderInterval);
    reminderInterval = null;
    console.log('[AgentReminders] Stopped reminder job');
  }
}

async function checkAndSendReminders(getWaService) {
  const now = new Date();
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
  
  try {
    // Find chats where:
    // 1. Assigned to an agent (assignedTo exists)
    // 2. Assigned at least 5 minutes ago
    // 3. Agent has NOT replied yet (agentLastRepliedAt is null)
    // 4. Reminder not sent yet OR last reminder was more than 5 minutes ago
    const chatsNeedingReminder = await ChatMeta.find({
      assignedTo: { $ne: null },
      assignedAt: { $lt: fiveMinutesAgo },
      agentLastRepliedAt: null,
      $or: [
        { reminderSentAt: null },
        { reminderSentAt: { $lt: fiveMinutesAgo } }
      ]
    }).populate('assignedTo', 'phone firstName lastName');
    
    if (chatsNeedingReminder.length === 0) {
      return; // No reminders needed
    }
    
    console.log(`[AgentReminders] Found ${chatsNeedingReminder.length} chat(s) needing reminder`);
    
    const waService = await getWaService();
    
    for (const meta of chatsNeedingReminder) {
      try {
        const agent = meta.assignedTo;
        if (!agent || !agent.phone) {
          console.log(`[AgentReminders] Skipping chat ${meta.jid} - agent has no phone`);
          continue;
        }
        
        const customerJid = meta.jid;
        const customerPhone = customerJid.replace(/@.*/, '');
        const agentName = `${agent.firstName || ''} ${agent.lastName || ''}`.trim() || 'Agent';
        
        // Get country info instead of showing phone number
        const countryInfo = getCountryFromPhone(customerPhone);
        
        // Calculate time since assignment
        const minutesSinceAssignment = Math.floor((now - meta.assignedAt) / (1000 * 60));
        
        const reminderText = `⏰ *Reminder: Chat Assigned to You*\n\nHello ${agentName},\n\nYou were assigned a chat ${minutesSinceAssignment} minutes ago, but haven't replied yet.\n\n${countryInfo.flag} Customer from: ${countryInfo.name}\n\nPlease respond to the customer as soon as possible to avoid delays.\n\n_This is an automated reminder from BuySial Commerce._`;
        
        // Send WhatsApp reminder to agent
        const agentJid = agent.phone.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
        await waService.sendText(agentJid, reminderText);
        
        // Update reminder timestamp
        meta.reminderSentAt = now;
        await meta.save();
        
        console.log(`[AgentReminders] Reminder sent to ${agentName} (${agent.phone}) for chat ${customerJid}`);
      } catch (sendErr) {
        console.error(`[AgentReminders] Failed to send reminder for chat ${meta.jid}:`, sendErr);
        // Continue to next chat even if this one fails
      }
    }
  } catch (err) {
    console.error('[AgentReminders] Error checking reminders:', err);
  }
}

export default {
  startAgentReminderJob,
  stopAgentReminderJob
};
