import { supabase } from '../config/supabase.js';

export const getCalls = async (req, res, next) => {
  try {
    const { campaign, agent, status, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('calls')
      .select(`
        id, direction, phone, status, call_sid, start_time, answer_time,
        end_time, duration, talk_time, recording_url, disposition, notes,
        transferred_to, events, created_at,
        campaigns (name),
        users!calls_agent_id_fkey (first_name, last_name),
        leads (first_name, last_name, phone)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (campaign) query = query.eq('campaign_id', campaign);
    if (status) query = query.eq('status', status);

    // Agents can only see their own calls
    if (req.user.role === 'agent') {
      query = query.eq('agent_id', req.user.id);
    } else if (agent) {
      query = query.eq('agent_id', agent);
    }

    const { data: calls, error, count } = await query;

    if (error) throw error;

    const formattedCalls = calls.map(call => ({
      _id: call.id,
      direction: call.direction,
      phone: call.phone,
      status: call.status,
      callSid: call.call_sid,
      startTime: call.start_time,
      answerTime: call.answer_time,
      endTime: call.end_time,
      duration: call.duration,
      talkTime: call.talk_time,
      recordingUrl: call.recording_url,
      disposition: call.disposition,
      notes: call.notes,
      transferredTo: call.transferred_to,
      events: call.events,
      createdAt: call.created_at,
      campaign: call.campaigns ? { name: call.campaigns.name } : null,
      agent: call.users ? {
        firstName: call.users.first_name,
        lastName: call.users.last_name,
      } : null,
      lead: call.leads ? {
        firstName: call.leads.first_name,
        lastName: call.leads.last_name,
        phone: call.leads.phone,
      } : null,
    }));

    res.json({
      success: true,
      count: formattedCalls.length,
      total: count,
      pages: Math.ceil(count / limit),
      data: formattedCalls,
    });
  } catch (error) {
    next(error);
  }
};

export const getCall = async (req, res, next) => {
  try {
    const { data: call, error } = await supabase
      .from('calls')
      .select(`
        *,
        campaigns (name),
        users!calls_agent_id_fkey (first_name, last_name),
        leads (*)
      `)
      .eq('id', req.params.id)
      .single();

    if (error || !call) {
      res.status(404);
      throw new Error('Call not found');
    }

    res.json({
      success: true,
      data: {
        _id: call.id,
        direction: call.direction,
        phone: call.phone,
        status: call.status,
        duration: call.duration,
        talkTime: call.talk_time,
        disposition: call.disposition,
        notes: call.notes,
        events: call.events,
        createdAt: call.created_at,
        campaign: call.campaigns ? { name: call.campaigns.name } : null,
        agent: call.users ? {
          firstName: call.users.first_name,
          lastName: call.users.last_name,
        } : null,
        lead: call.leads,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const initiateCall = async (req, res, next) => {
  try {
    const { leadId, phone, campaignId } = req.body;
    const agentId = req.user.id;

    // Update agent status to busy
    await supabase
      .from('users')
      .update({ status: 'busy' })
      .eq('id', agentId);

    // Create call record
    const { data: call, error } = await supabase
      .from('calls')
      .insert({
        campaign_id: campaignId,
        lead_id: leadId,
        agent_id: agentId,
        direction: 'outbound',
        phone,
        status: 'ringing',
        start_time: new Date().toISOString(),
        events: [
          { event: 'initiated', timestamp: new Date().toISOString() },
          { event: 'ringing', timestamp: new Date().toISOString() },
        ],
      })
      .select()
      .single();

    if (error) throw error;

    // Update lead if exists
    if (leadId) {
      const { data: lead } = await supabase
        .from('leads')
        .select('attempts')
        .eq('id', leadId)
        .single();

      await supabase
        .from('leads')
        .update({
          attempts: (lead?.attempts || 0) + 1,
          last_attempt: new Date().toISOString(),
          status: 'contacted',
        })
        .eq('id', leadId);
    }

    // Emit socket event
    const io = req.app.get('io');
    io.emit('call:initiated', {
      callId: call.id,
      agentId,
      phone,
    });

    res.status(201).json({
      success: true,
      data: {
        _id: call.id,
        phone: call.phone,
        status: call.status,
        startTime: call.start_time,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const endCall = async (req, res, next) => {
  try {
    const { data: call, error: fetchError } = await supabase
      .from('calls')
      .select('agent_id, events, start_time, answer_time')
      .eq('id', req.params.id)
      .single();

    if (fetchError || !call) {
      res.status(404);
      throw new Error('Call not found');
    }

    const endTime = new Date().toISOString();
    const events = call.events || [];
    events.push({ event: 'hangup', timestamp: endTime });

    // Calculate durations
    const duration = call.start_time
      ? Math.floor((new Date(endTime) - new Date(call.start_time)) / 1000)
      : 0;
    const talkTime = call.answer_time
      ? Math.floor((new Date(endTime) - new Date(call.answer_time)) / 1000)
      : 0;

    const { data: updatedCall, error } = await supabase
      .from('calls')
      .update({
        status: 'completed',
        end_time: endTime,
        duration,
        talk_time: talkTime,
        events,
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    // Update agent status back to available
    await supabase
      .from('users')
      .update({ status: 'available' })
      .eq('id', call.agent_id);

    // Emit socket event
    const io = req.app.get('io');
    io.emit('call:ended', {
      callId: updatedCall.id,
      agentId: call.agent_id,
    });

    res.json({
      success: true,
      data: {
        _id: updatedCall.id,
        status: updatedCall.status,
        duration: updatedCall.duration,
        talkTime: updatedCall.talk_time,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const transferCall = async (req, res, next) => {
  try {
    const { targetNumber, targetAgentId } = req.body;

    const { data: call, error: fetchError } = await supabase
      .from('calls')
      .select('events')
      .eq('id', req.params.id)
      .single();

    if (fetchError || !call) {
      res.status(404);
      throw new Error('Call not found');
    }

    const events = call.events || [];
    events.push({
      event: 'transfer',
      timestamp: new Date().toISOString(),
      data: { to: targetNumber || targetAgentId },
    });

    const { data: updatedCall, error } = await supabase
      .from('calls')
      .update({
        transferred_to: targetNumber || targetAgentId,
        transferred_by: req.user.id,
        events,
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    const io = req.app.get('io');
    io.emit('call:transferred', {
      callId: updatedCall.id,
      from: req.user.id,
      to: targetNumber || targetAgentId,
    });

    res.json({
      success: true,
      data: {
        _id: updatedCall.id,
        transferredTo: updatedCall.transferred_to,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getActiveCalls = async (req, res, next) => {
  try {
    const { data: calls, error } = await supabase
      .from('calls')
      .select(`
        id, phone, status, start_time, created_at,
        campaigns (name),
        users!calls_agent_id_fkey (first_name, last_name),
        leads (first_name, last_name, phone)
      `)
      .in('status', ['queued', 'ringing', 'in-progress']);

    if (error) throw error;

    const formattedCalls = calls.map(call => ({
      _id: call.id,
      phone: call.phone,
      status: call.status,
      startTime: call.start_time,
      createdAt: call.created_at,
      campaign: call.campaigns ? { name: call.campaigns.name } : null,
      agent: call.users ? {
        firstName: call.users.first_name,
        lastName: call.users.last_name,
      } : null,
      lead: call.leads ? {
        firstName: call.leads.first_name,
        lastName: call.leads.last_name,
        phone: call.leads.phone,
      } : null,
    }));

    res.json({
      success: true,
      count: formattedCalls.length,
      data: formattedCalls,
    });
  } catch (error) {
    next(error);
  }
};

export const updateCallDisposition = async (req, res, next) => {
  try {
    const { disposition, notes, nextCallback } = req.body;

    const { data: call, error } = await supabase
      .from('calls')
      .update({ disposition, notes })
      .eq('id', req.params.id)
      .select('id, lead_id')
      .single();

    if (error) throw error;

    // Update lead with disposition
    if (call.lead_id) {
      const leadUpdate = {
        last_disposition: disposition,
      };

      if (nextCallback) {
        leadUpdate.status = 'callback';
        leadUpdate.next_callback = nextCallback;
      }

      await supabase
        .from('leads')
        .update(leadUpdate)
        .eq('id', call.lead_id);
    }

    res.json({
      success: true,
      data: {
        _id: call.id,
        disposition,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateCall = async (req, res, next) => {
  try {
    const { agent_id, status, notes } = req.body;

    const updateData = {};
    if (agent_id !== undefined) updateData.agent_id = agent_id;
    if (status !== undefined) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;

    const { data: call, error } = await supabase
      .from('calls')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data: {
        _id: call.id,
        agent_id: call.agent_id,
        status: call.status,
      },
    });
  } catch (error) {
    next(error);
  }
};
