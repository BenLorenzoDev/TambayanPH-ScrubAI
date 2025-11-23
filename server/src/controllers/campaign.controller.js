import { validationResult } from 'express-validator';
import { supabase } from '../config/supabase.js';

export const getCampaigns = async (req, res, next) => {
  try {
    const { status, type } = req.query;

    let query = supabase
      .from('campaigns')
      .select(`
        id, name, description, type, status, dial_mode, caller_id, script,
        dispositions, working_hours, max_attempts, retry_interval,
        stats, created_at, created_by,
        users!campaigns_created_by_fkey (first_name, last_name)
      `)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (type) query = query.eq('type', type);

    const { data: campaigns, error } = await query;

    if (error) throw error;

    const formattedCampaigns = campaigns.map(campaign => ({
      _id: campaign.id,
      name: campaign.name,
      description: campaign.description,
      type: campaign.type,
      status: campaign.status,
      dialMode: campaign.dial_mode,
      callerId: campaign.caller_id,
      script: campaign.script,
      dispositions: campaign.dispositions,
      workingHours: campaign.working_hours,
      maxAttempts: campaign.max_attempts,
      retryInterval: campaign.retry_interval,
      stats: campaign.stats,
      createdAt: campaign.created_at,
      createdBy: campaign.users ? {
        firstName: campaign.users.first_name,
        lastName: campaign.users.last_name,
      } : null,
    }));

    res.json({
      success: true,
      count: formattedCampaigns.length,
      data: formattedCampaigns,
    });
  } catch (error) {
    next(error);
  }
};

export const getCampaign = async (req, res, next) => {
  try {
    const { data: campaign, error } = await supabase
      .from('campaigns')
      .select(`
        *,
        users!campaigns_created_by_fkey (first_name, last_name)
      `)
      .eq('id', req.params.id)
      .single();

    if (error || !campaign) {
      res.status(404);
      throw new Error('Campaign not found');
    }

    res.json({
      success: true,
      data: {
        _id: campaign.id,
        name: campaign.name,
        description: campaign.description,
        type: campaign.type,
        status: campaign.status,
        dialMode: campaign.dial_mode,
        callerId: campaign.caller_id,
        script: campaign.script,
        dispositions: campaign.dispositions,
        workingHours: campaign.working_hours,
        maxAttempts: campaign.max_attempts,
        retryInterval: campaign.retry_interval,
        stats: campaign.stats,
        createdAt: campaign.created_at,
        createdBy: campaign.users ? {
          firstName: campaign.users.first_name,
          lastName: campaign.users.last_name,
        } : null,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const createCampaign = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400);
      throw new Error(errors.array()[0].msg);
    }

    const { name, description, type, dialMode, callerId, script, dispositions, workingHours, maxAttempts, retryInterval } = req.body;

    const { data: campaign, error } = await supabase
      .from('campaigns')
      .insert({
        name,
        description,
        type: type || 'outbound',
        dial_mode: dialMode || 'preview',
        caller_id: callerId,
        script,
        dispositions: dispositions || [],
        working_hours: workingHours,
        max_attempts: maxAttempts || 3,
        retry_interval: retryInterval || 60,
        created_by: req.user.id,
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data: {
        _id: campaign.id,
        name: campaign.name,
        description: campaign.description,
        type: campaign.type,
        status: campaign.status,
        dialMode: campaign.dial_mode,
        stats: campaign.stats,
        createdAt: campaign.created_at,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateCampaign = async (req, res, next) => {
  try {
    const updateData = {};
    const { name, description, type, status, dialMode, callerId, script, dispositions, workingHours, maxAttempts, retryInterval } = req.body;

    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (type) updateData.type = type;
    if (status) updateData.status = status;
    if (dialMode) updateData.dial_mode = dialMode;
    if (callerId !== undefined) updateData.caller_id = callerId;
    if (script !== undefined) updateData.script = script;
    if (dispositions) updateData.dispositions = dispositions;
    if (workingHours) updateData.working_hours = workingHours;
    if (maxAttempts) updateData.max_attempts = maxAttempts;
    if (retryInterval) updateData.retry_interval = retryInterval;

    const { data: campaign, error } = await supabase
      .from('campaigns')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data: {
        _id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        dialMode: campaign.dial_mode,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteCampaign = async (req, res, next) => {
  try {
    // Delete associated leads first
    await supabase
      .from('leads')
      .delete()
      .eq('campaign_id', req.params.id);

    const { error } = await supabase
      .from('campaigns')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Campaign deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const getCampaignStats = async (req, res, next) => {
  try {
    const campaignId = req.params.id;

    // Get lead stats
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('status')
      .eq('campaign_id', campaignId);

    if (leadsError) throw leadsError;

    // Get call stats
    const { data: calls, error: callsError } = await supabase
      .from('calls')
      .select('duration')
      .eq('campaign_id', campaignId);

    if (callsError) throw callsError;

    // Aggregate lead stats
    const leadStats = leads.reduce((acc, lead) => {
      acc[lead.status] = (acc[lead.status] || 0) + 1;
      return acc;
    }, {});

    // Calculate call stats
    const callStats = {
      totalCalls: calls.length,
      totalDuration: calls.reduce((sum, call) => sum + (call.duration || 0), 0),
      avgDuration: calls.length > 0
        ? calls.reduce((sum, call) => sum + (call.duration || 0), 0) / calls.length
        : 0,
    };

    res.json({
      success: true,
      data: {
        leads: Object.entries(leadStats).map(([status, count]) => ({ _id: status, count })),
        calls: callStats,
      },
    });
  } catch (error) {
    next(error);
  }
};
