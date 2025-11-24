import { smsService } from '../services/sms.service.js';
import { supabase } from '../config/supabase.js';
import logger from '../utils/logger.js';

// Send SMS
export const sendSMS = async (req, res, next) => {
  try {
    const { phoneNumber, message, leadId, campaignId } = req.body;
    const agentId = req.user.id;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required',
      });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message is required',
      });
    }

    // Check if SMS service is configured
    if (!smsService.isConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'SMS service is not configured',
      });
    }

    // Send SMS
    const result = await smsService.sendSMS(phoneNumber, message.trim());

    // Save to database
    const { data: smsRecord, error: dbError } = await supabase
      .from('sms_messages')
      .insert({
        lead_id: leadId || null,
        campaign_id: campaignId || null,
        agent_id: agentId,
        phone: phoneNumber,
        message: message.trim(),
        status: result.status || 'sent',
        provider: result.provider,
        provider_message_id: result.messageId,
      })
      .select()
      .single();

    if (dbError) {
      logger.error(`Failed to save SMS record: ${dbError.message}`);
      // Don't fail the request, SMS was sent successfully
    }

    res.status(200).json({
      success: true,
      message: 'SMS sent successfully',
      data: {
        id: smsRecord?.id,
        messageId: result.messageId,
        status: result.status,
        provider: result.provider,
      },
    });
  } catch (error) {
    logger.error(`SMS send error: ${error.message}`);

    // Save failed attempt to database
    try {
      await supabase.from('sms_messages').insert({
        lead_id: req.body.leadId || null,
        campaign_id: req.body.campaignId || null,
        agent_id: req.user.id,
        phone: req.body.phoneNumber,
        message: req.body.message?.trim() || '',
        status: 'failed',
        provider: smsService.getProvider(),
        error_message: error.message,
      });
    } catch (dbError) {
      logger.error(`Failed to save failed SMS record: ${dbError.message}`);
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to send SMS',
    });
  }
};

// Get SMS history for a lead
export const getSMSHistory = async (req, res, next) => {
  try {
    const { leadId } = req.params;

    const { data: messages, error } = await supabase
      .from('sms_messages')
      .select('*, agent:users!sms_messages_agent_id_fkey(first_name, last_name)')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: messages,
    });
  } catch (error) {
    next(error);
  }
};

// Get SMS status
export const getSMSStatus = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: {
        configured: smsService.isConfigured(),
        provider: smsService.getProvider(),
      },
    });
  } catch (error) {
    next(error);
  }
};
