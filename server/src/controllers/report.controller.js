import { supabase } from '../config/supabase.js';

export const getDashboardStats = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = endDate ? new Date(endDate) : new Date();

    // Get call stats
    const { data: calls, error: callsError } = await supabase
      .from('calls')
      .select('id, status, duration, talk_time, created_at, disposition')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());

    if (callsError) throw callsError;

    // Get lead stats
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, status, created_at')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());

    if (leadsError) throw leadsError;

    // Calculate summary stats
    const totalCalls = calls.length;
    const completedCalls = calls.filter(c => c.status === 'completed').length;
    const totalDuration = calls.reduce((sum, c) => sum + (c.duration || 0), 0);
    const totalTalkTime = calls.reduce((sum, c) => sum + (c.talk_time || 0), 0);
    const avgTalkTime = completedCalls > 0 ? Math.round(totalTalkTime / completedCalls) : 0;

    const totalLeads = leads.length;
    const convertedLeads = leads.filter(l => l.status === 'converted').length;
    const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;

    // Get calls by date for chart
    const callsByDate = {};
    calls.forEach(call => {
      const date = new Date(call.created_at).toISOString().split('T')[0];
      if (!callsByDate[date]) {
        callsByDate[date] = { date, calls: 0, completed: 0, duration: 0 };
      }
      callsByDate[date].calls++;
      if (call.status === 'completed') {
        callsByDate[date].completed++;
        callsByDate[date].duration += call.duration || 0;
      }
    });

    // Get disposition breakdown
    const dispositions = {};
    calls.forEach(call => {
      if (call.disposition) {
        dispositions[call.disposition] = (dispositions[call.disposition] || 0) + 1;
      }
    });

    // Get lead status breakdown
    const leadStatuses = {};
    leads.forEach(lead => {
      leadStatuses[lead.status] = (leadStatuses[lead.status] || 0) + 1;
    });

    res.json({
      success: true,
      data: {
        summary: {
          totalCalls,
          completedCalls,
          totalDuration,
          avgTalkTime,
          totalLeads,
          convertedLeads,
          conversionRate,
        },
        callsByDate: Object.values(callsByDate).sort((a, b) => a.date.localeCompare(b.date)),
        dispositions: Object.entries(dispositions).map(([name, value]) => ({ name, value })),
        leadStatuses: Object.entries(leadStatuses).map(([name, value]) => ({ name, value })),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getAgentPerformance = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = endDate ? new Date(endDate) : new Date();

    // Get all agents
    const { data: agents, error: agentsError } = await supabase
      .from('users')
      .select('id, first_name, last_name, email')
      .eq('role', 'agent')
      .eq('is_active', true);

    if (agentsError) throw agentsError;

    // Get calls for each agent
    const agentStats = await Promise.all(
      agents.map(async (agent) => {
        const { data: calls, error } = await supabase
          .from('calls')
          .select('id, status, duration, talk_time')
          .eq('agent_id', agent.id)
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString());

        if (error) throw error;

        const totalCalls = calls.length;
        const completedCalls = calls.filter(c => c.status === 'completed').length;
        const totalTalkTime = calls.reduce((sum, c) => sum + (c.talk_time || 0), 0);
        const avgTalkTime = completedCalls > 0 ? Math.round(totalTalkTime / completedCalls) : 0;

        return {
          id: agent.id,
          name: `${agent.first_name} ${agent.last_name}`,
          email: agent.email,
          totalCalls,
          completedCalls,
          totalTalkTime,
          avgTalkTime,
          answerRate: totalCalls > 0 ? Math.round((completedCalls / totalCalls) * 100) : 0,
        };
      })
    );

    res.json({
      success: true,
      data: agentStats.sort((a, b) => b.totalCalls - a.totalCalls),
    });
  } catch (error) {
    next(error);
  }
};

export const getCampaignPerformance = async (req, res, next) => {
  try {
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('id, name, status, stats')
      .order('created_at', { ascending: false });

    if (campaignsError) throw campaignsError;

    // Get call stats for each campaign
    const campaignStats = await Promise.all(
      campaigns.map(async (campaign) => {
        const { data: calls, error } = await supabase
          .from('calls')
          .select('id, status, duration')
          .eq('campaign_id', campaign.id);

        if (error) throw error;

        const { data: leads, error: leadsError } = await supabase
          .from('leads')
          .select('id, status')
          .eq('campaign_id', campaign.id);

        if (leadsError) throw leadsError;

        const totalCalls = calls.length;
        const completedCalls = calls.filter(c => c.status === 'completed').length;
        const totalLeads = leads.length;
        const convertedLeads = leads.filter(l => l.status === 'converted').length;

        return {
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
          totalLeads,
          totalCalls,
          completedCalls,
          convertedLeads,
          conversionRate: totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0,
        };
      })
    );

    res.json({
      success: true,
      data: campaignStats,
    });
  } catch (error) {
    next(error);
  }
};
