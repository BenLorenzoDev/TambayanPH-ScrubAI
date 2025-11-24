import { vapiService } from '../services/vapi.service.js';
import { supabase } from '../config/supabase.js';
import logger from '../utils/logger.js';

// Create outbound call using VAPI
export const createVapiCall = async (req, res, next) => {
  try {
    const { leadId, campaignId, phoneNumber } = req.body;
    const agentId = req.user.id;

    // Validate campaign
    if (!campaignId) {
      return res.status(400).json({
        success: false,
        message: 'Campaign ID is required',
      });
    }

    let lead = null;
    let phoneToCall = phoneNumber;

    // Get lead details if leadId provided
    if (leadId) {
      const { data: leadData, error: leadError } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .single();

      if (leadError || !leadData) {
        return res.status(404).json({
          success: false,
          message: 'Lead not found',
        });
      }

      lead = leadData;
      // Use phone from request or fall back to lead's phone
      phoneToCall = phoneNumber || lead.phone;
    }

    if (!phoneToCall) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required',
      });
    }

    // Create call with VAPI
    const vapiCall = await vapiService.createCall(phoneToCall, leadId || 'manual', {
      leadId: leadId || null,
      campaignId,
      agentId,
      firstName: lead?.first_name || 'Customer',
      lastName: lead?.last_name || '',
    });

    // Create call record in database
    const { data: call, error: callError } = await supabase
      .from('calls')
      .insert({
        lead_id: leadId || null,
        campaign_id: campaignId,
        agent_id: agentId,
        phone: phoneToCall,
        direction: 'outbound',
        status: 'initiated',
        vapi_call_id: vapiCall.id,
      })
      .select()
      .single();

    if (callError) throw callError;

    // Update lead status if we have a lead
    if (lead) {
      await supabase
        .from('leads')
        .update({
          status: 'calling',
          last_called: new Date().toISOString(),
          attempts: (lead.attempts || 0) + 1,
        })
        .eq('id', leadId);
    }

    // Emit socket event for real-time updates
    const io = req.app.get('io');
    io.emit('call:started', {
      callId: call.id,
      vapiCallId: vapiCall.id,
      leadId: leadId || null,
      agentId,
      phone: phoneToCall,
    });

    res.status(201).json({
      success: true,
      data: {
        call,
        vapiCall,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get call status
export const getCallStatus = async (req, res, next) => {
  try {
    const { callId } = req.params;

    // Get call from database
    const { data: call, error } = await supabase
      .from('calls')
      .select('*, lead:leads(*)')
      .eq('id', callId)
      .single();

    if (error || !call) {
      return res.status(404).json({
        success: false,
        message: 'Call not found',
      });
    }

    // Get VAPI call details if available
    let vapiDetails = null;
    if (call.vapi_call_id) {
      try {
        vapiDetails = await vapiService.getCall(call.vapi_call_id);
      } catch (err) {
        logger.warn(`Could not fetch VAPI call details: ${err.message}`);
      }
    }

    res.json({
      success: true,
      data: {
        ...call,
        vapiDetails,
      },
    });
  } catch (error) {
    next(error);
  }
};

// End a call
export const endCall = async (req, res, next) => {
  try {
    const { callId } = req.params;

    // Get call from database
    const { data: call, error } = await supabase
      .from('calls')
      .select('*')
      .eq('id', callId)
      .single();

    if (error || !call) {
      return res.status(404).json({
        success: false,
        message: 'Call not found',
      });
    }

    // End VAPI call
    if (call.vapi_call_id) {
      await vapiService.endCall(call.vapi_call_id);
    }

    // Update call status in database
    const { data: updatedCall, error: updateError } = await supabase
      .from('calls')
      .update({
        status: 'completed',
        ended_at: new Date().toISOString(),
      })
      .eq('id', callId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Emit socket event
    const io = req.app.get('io');
    io.emit('call:ended', {
      callId,
      vapiCallId: call.vapi_call_id,
    });

    res.json({
      success: true,
      data: updatedCall,
    });
  } catch (error) {
    next(error);
  }
};

// Listen to a call (for supervisors)
export const listenToCall = async (req, res, next) => {
  try {
    const { callId } = req.params;

    // Get call from database
    const { data: call, error } = await supabase
      .from('calls')
      .select('*')
      .eq('id', callId)
      .single();

    if (error || !call) {
      return res.status(404).json({
        success: false,
        message: 'Call not found',
      });
    }

    if (!call.vapi_call_id) {
      return res.status(400).json({
        success: false,
        message: 'No VAPI call associated with this call',
      });
    }

    const listenData = await vapiService.listenToCall(call.vapi_call_id);

    res.json({
      success: true,
      data: listenData,
    });
  } catch (error) {
    next(error);
  }
};

// Whisper to AI assistant (only assistant hears)
export const whisperToCall = async (req, res, next) => {
  try {
    const { callId } = req.params;
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Message is required',
      });
    }

    // Get call from database
    const { data: call, error } = await supabase
      .from('calls')
      .select('*')
      .eq('id', callId)
      .single();

    if (error || !call) {
      return res.status(404).json({
        success: false,
        message: 'Call not found',
      });
    }

    if (!call.vapi_call_id) {
      return res.status(400).json({
        success: false,
        message: 'No VAPI call associated with this call',
      });
    }

    const result = await vapiService.whisper(call.vapi_call_id, message);

    // Log whisper action
    logger.info(`Whisper to call ${callId} by user ${req.user.id}: ${message}`);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// Barge into call (customer and assistant hear)
export const bargeIntoCall = async (req, res, next) => {
  try {
    const { callId } = req.params;
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Message is required',
      });
    }

    // Get call from database
    const { data: call, error } = await supabase
      .from('calls')
      .select('*')
      .eq('id', callId)
      .single();

    if (error || !call) {
      return res.status(404).json({
        success: false,
        message: 'Call not found',
      });
    }

    if (!call.vapi_call_id) {
      return res.status(400).json({
        success: false,
        message: 'No VAPI call associated with this call',
      });
    }

    const result = await vapiService.barge(call.vapi_call_id, message);

    // Log barge action
    logger.info(`Barge into call ${callId} by user ${req.user.id}: ${message}`);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// Transfer call to human agent
export const transferCall = async (req, res, next) => {
  try {
    const { callId } = req.params;
    const { destination } = req.body;

    if (!destination) {
      return res.status(400).json({
        success: false,
        message: 'Destination phone number is required',
      });
    }

    // Get call from database
    const { data: call, error } = await supabase
      .from('calls')
      .select('*')
      .eq('id', callId)
      .single();

    if (error || !call) {
      return res.status(404).json({
        success: false,
        message: 'Call not found',
      });
    }

    if (!call.vapi_call_id) {
      return res.status(400).json({
        success: false,
        message: 'No VAPI call associated with this call',
      });
    }

    const result = await vapiService.transferCall(call.vapi_call_id, destination);

    // Update call status
    await supabase
      .from('calls')
      .update({ status: 'transferred' })
      .eq('id', callId);

    // Emit socket event
    const io = req.app.get('io');
    io.emit('call:transferred', {
      callId,
      destination,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// Get call transcript
export const getCallTranscript = async (req, res, next) => {
  try {
    const { callId } = req.params;

    // Get call from database
    const { data: call, error } = await supabase
      .from('calls')
      .select('*')
      .eq('id', callId)
      .single();

    if (error || !call) {
      return res.status(404).json({
        success: false,
        message: 'Call not found',
      });
    }

    if (!call.vapi_call_id) {
      return res.status(400).json({
        success: false,
        message: 'No VAPI call associated with this call',
      });
    }

    const transcript = await vapiService.getTranscript(call.vapi_call_id);

    res.json({
      success: true,
      data: transcript,
    });
  } catch (error) {
    next(error);
  }
};

// Get active calls (for monitoring)
export const getActiveCalls = async (req, res, next) => {
  try {
    const { data: calls, error } = await supabase
      .from('calls')
      .select(`
        *,
        lead:leads(first_name, last_name, phone),
        agent:users!calls_agent_id_fkey(first_name, last_name),
        campaign:campaigns(name)
      `)
      .in('status', ['initiated', 'ringing', 'in-progress'])
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: calls,
    });
  } catch (error) {
    next(error);
  }
};

// VAPI webhook handler for call events
export const handleVapiWebhook = async (req, res, next) => {
  try {
    const event = req.body;
    logger.info(`VAPI Webhook: ${event.type}`);

    const io = req.app.get('io');

    switch (event.type) {
      case 'call-started':
        // Update call status
        if (event.call?.id) {
          await supabase
            .from('calls')
            .update({ status: 'in-progress', started_at: new Date().toISOString() })
            .eq('vapi_call_id', event.call.id);

          io.emit('call:connected', { vapiCallId: event.call.id });
        }
        break;

      case 'call-ended':
        if (event.call?.id) {
          const duration = event.call.endedAt && event.call.startedAt
            ? Math.round((new Date(event.call.endedAt) - new Date(event.call.startedAt)) / 1000)
            : 0;

          await supabase
            .from('calls')
            .update({
              status: 'completed',
              ended_at: new Date().toISOString(),
              duration,
              talk_time: duration,
              notes: event.call.endedReason,
            })
            .eq('vapi_call_id', event.call.id);

          io.emit('call:ended', {
            vapiCallId: event.call.id,
            duration,
            reason: event.call.endedReason,
          });
        }
        break;

      case 'transcript':
        // Handle real-time transcript updates
        if (event.call?.id && event.transcript) {
          io.emit('call:transcript', {
            vapiCallId: event.call.id,
            transcript: event.transcript,
          });
        }
        break;

      case 'speech-update':
        // Handle speech updates (user/assistant speaking)
        if (event.call?.id) {
          io.emit('call:speech', {
            vapiCallId: event.call.id,
            role: event.role,
            status: event.status,
          });
        }
        break;

      default:
        logger.info(`Unhandled VAPI webhook event: ${event.type}`);
    }

    res.json({ success: true });
  } catch (error) {
    logger.error(`VAPI Webhook Error: ${error.message}`);
    next(error);
  }
};
