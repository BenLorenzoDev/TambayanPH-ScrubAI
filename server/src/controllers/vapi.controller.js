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

    // Poll for listenUrl (call needs to be answered first)
    let listenUrl = null;
    let controlUrl = null;
    const maxRetries = 30;
    const pollInterval = 2000;

    for (let i = 0; i < maxRetries; i++) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      try {
        const callDetails = await vapiService.getCall(vapiCall.id);
        if (callDetails.monitor?.listenUrl) {
          listenUrl = callDetails.monitor.listenUrl;
          controlUrl = vapiService.getControlUrl(listenUrl);
          logger.info(`Got listenUrl for call ${vapiCall.id}: ${listenUrl}`);
          break;
        }
        // Check if call ended before being answered
        if (['ended', 'failed', 'busy', 'no-answer'].includes(callDetails.status)) {
          logger.info(`Call ${vapiCall.id} ended before being answered: ${callDetails.status}`);
          break;
        }
      } catch (err) {
        logger.warn(`Polling for listenUrl failed: ${err.message}`);
      }
    }

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
      listenUrl,
      controlUrl,
    });

    res.status(201).json({
      success: true,
      data: {
        call,
        vapiCall,
        listenUrl,
        controlUrl,
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
    const { message, controlUrl } = req.body;

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

    const result = await vapiService.whisper(call.vapi_call_id, message, controlUrl);

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
    const { message, controlUrl } = req.body;

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

    const result = await vapiService.barge(call.vapi_call_id, message, controlUrl);

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
    const { destination, controlUrl, transferMessage } = req.body;

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

    const result = await vapiService.transferCall(call.vapi_call_id, destination, controlUrl, transferMessage);

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

// Mute/Unmute assistant
export const controlAssistant = async (req, res, next) => {
  try {
    const { callId } = req.params;
    const { control, controlUrl } = req.body;

    if (!control) {
      return res.status(400).json({
        success: false,
        message: 'Control action is required (mute-assistant, unmute-assistant, say-first-message)',
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

    const result = await vapiService.controlAssistant(call.vapi_call_id, control, controlUrl);

    logger.info(`Control assistant ${callId} by user ${req.user.id}: ${control}`);

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
    logger.info(`VAPI Webhook: ${event.type}`, JSON.stringify(event, null, 2));

    const io = req.app.get('io');

    switch (event.type) {
      case 'call-started':
        if (event.call?.id) {
          // Check if this is an existing outbound call or a new inbound call
          const { data: existingCall } = await supabase
            .from('calls')
            .select('*')
            .eq('vapi_call_id', event.call.id)
            .single();

          if (existingCall) {
            // Outbound call - update status
            await supabase
              .from('calls')
              .update({ status: 'in-progress', started_at: new Date().toISOString() })
              .eq('vapi_call_id', event.call.id);

            io.emit('call:connected', { vapiCallId: event.call.id });
          } else {
            // Inbound call - create new record
            const customerPhone = event.call.customer?.number || event.call.phoneNumber?.number;
            const direction = event.call.type === 'inboundPhoneCall' ? 'inbound' : 'outbound';

            if (direction === 'inbound' && customerPhone) {
              logger.info(`Inbound call detected from ${customerPhone}`);

              // Try to match with existing lead
              const { data: matchedLead } = await supabase
                .from('leads')
                .select('*, campaign:campaigns(id, name)')
                .eq('phone', customerPhone)
                .order('last_called', { ascending: false })
                .limit(1)
                .single();

              // Create call record for inbound call
              const { data: newCall, error: callError } = await supabase
                .from('calls')
                .insert({
                  lead_id: matchedLead?.id || null,
                  campaign_id: matchedLead?.campaign_id || null,
                  agent_id: null, // Will be assigned when agent accepts
                  phone: customerPhone,
                  direction: 'inbound',
                  status: 'ringing',
                  vapi_call_id: event.call.id,
                  started_at: new Date().toISOString(),
                })
                .select()
                .single();

              if (callError) {
                logger.error(`Failed to create inbound call record: ${callError.message}`);
              } else {
                // Emit inbound call event to all connected agents
                io.emit('call:inbound', {
                  callId: newCall.id,
                  vapiCallId: event.call.id,
                  phone: customerPhone,
                  lead: matchedLead || null,
                  listenUrl: event.call.monitor?.listenUrl || null,
                });

                logger.info(`Inbound call record created: ${newCall.id}`);
              }
            }
          }
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
