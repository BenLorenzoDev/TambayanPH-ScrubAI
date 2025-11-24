import { validationResult } from 'express-validator';
import path from 'path';
import { supabase } from '../config/supabase.js';
import { parseCSV, parseExcel, importLeads } from '../services/import.service.js';

export const getLeads = async (req, res, next) => {
  try {
    const { campaign, status, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('leads')
      .select(`
        id, phone, alt_phone, first_name, last_name, email, address,
        custom_fields, status, priority, attempts, last_attempt,
        next_callback, last_disposition, notes, created_at,
        campaign_id, assigned_agent,
        campaigns (name),
        users!leads_assigned_agent_fkey (first_name, last_name)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (campaign) query = query.eq('campaign_id', campaign);
    if (status) query = query.eq('status', status);

    const { data: leads, error, count } = await query;

    if (error) throw error;

    const formattedLeads = leads.map(lead => ({
      _id: lead.id,
      phone: lead.phone,
      altPhone: lead.alt_phone,
      firstName: lead.first_name,
      lastName: lead.last_name,
      email: lead.email,
      address: lead.address,
      customFields: lead.custom_fields,
      status: lead.status,
      priority: lead.priority,
      attempts: lead.attempts,
      lastAttempt: lead.last_attempt,
      nextCallback: lead.next_callback,
      lastDisposition: lead.last_disposition,
      notes: lead.notes,
      createdAt: lead.created_at,
      campaignId: lead.campaign_id,
      campaign: lead.campaigns ? { name: lead.campaigns.name } : null,
      assignedAgent: lead.users ? {
        firstName: lead.users.first_name,
        lastName: lead.users.last_name,
      } : null,
    }));

    res.json({
      success: true,
      count: formattedLeads.length,
      total: count,
      pages: Math.ceil(count / limit),
      data: formattedLeads,
    });
  } catch (error) {
    next(error);
  }
};

export const getLead = async (req, res, next) => {
  try {
    const { data: lead, error } = await supabase
      .from('leads')
      .select(`
        *,
        campaigns (name, script, dispositions),
        users!leads_assigned_agent_fkey (first_name, last_name)
      `)
      .eq('id', req.params.id)
      .single();

    if (error || !lead) {
      res.status(404);
      throw new Error('Lead not found');
    }

    res.json({
      success: true,
      data: {
        _id: lead.id,
        phone: lead.phone,
        altPhone: lead.alt_phone,
        firstName: lead.first_name,
        lastName: lead.last_name,
        email: lead.email,
        address: lead.address,
        customFields: lead.custom_fields,
        status: lead.status,
        priority: lead.priority,
        attempts: lead.attempts,
        lastAttempt: lead.last_attempt,
        nextCallback: lead.next_callback,
        lastDisposition: lead.last_disposition,
        notes: lead.notes,
        createdAt: lead.created_at,
        campaign: lead.campaigns ? {
          name: lead.campaigns.name,
          script: lead.campaigns.script,
          dispositions: lead.campaigns.dispositions,
        } : null,
        assignedAgent: lead.users ? {
          firstName: lead.users.first_name,
          lastName: lead.users.last_name,
        } : null,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const createLead = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400);
      throw new Error(errors.array()[0].msg);
    }

    const { phone, altPhone, firstName, lastName, email, address, customFields, campaign, priority } = req.body;

    const { data: lead, error } = await supabase
      .from('leads')
      .insert({
        phone,
        alt_phone: altPhone,
        first_name: firstName,
        last_name: lastName,
        email,
        address,
        custom_fields: customFields,
        campaign_id: campaign,
        priority: priority || 0,
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data: {
        _id: lead.id,
        phone: lead.phone,
        firstName: lead.first_name,
        lastName: lead.last_name,
        status: lead.status,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateLead = async (req, res, next) => {
  try {
    const updateData = {};
    const { phone, altPhone, firstName, lastName, email, address, customFields, status, priority, nextCallback, lastDisposition } = req.body;

    if (phone) updateData.phone = phone;
    if (altPhone !== undefined) updateData.alt_phone = altPhone;
    if (firstName) updateData.first_name = firstName;
    if (lastName) updateData.last_name = lastName;
    if (email !== undefined) updateData.email = email;
    if (address) updateData.address = address;
    if (customFields) updateData.custom_fields = customFields;
    if (status) updateData.status = status;
    if (priority !== undefined) updateData.priority = priority;
    if (nextCallback) updateData.next_callback = nextCallback;
    if (lastDisposition) updateData.last_disposition = lastDisposition;

    const { data: lead, error } = await supabase
      .from('leads')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data: {
        _id: lead.id,
        phone: lead.phone,
        status: lead.status,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteLead = async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Lead deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const getNextLead = async (req, res, next) => {
  try {
    const { campaignId } = req.params;
    const agentId = req.user.id;

    // Find next available lead
    const { data: lead, error } = await supabase
      .from('leads')
      .select(`
        *,
        campaigns (name, script, dispositions)
      `)
      .eq('campaign_id', campaignId)
      .in('status', ['new', 'callback'])
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (error || !lead) {
      // Get count to provide better error message
      const { count } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaignId);

      const { count: newCount } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaignId)
        .in('status', ['new', 'callback']);

      res.status(404);
      throw new Error(`No leads available (total: ${count || 0}, new/callback: ${newCount || 0})`);
    }

    // Update lead
    await supabase
      .from('leads')
      .update({
        assigned_agent: agentId,
        status: 'contacted',
      })
      .eq('id', lead.id);

    res.json({
      success: true,
      data: {
        _id: lead.id,
        phone: lead.phone,
        altPhone: lead.alt_phone,
        firstName: lead.first_name,
        lastName: lead.last_name,
        email: lead.email,
        status: 'contacted',
        attempts: lead.attempts,
        campaign: lead.campaigns ? {
          name: lead.campaigns.name,
          script: lead.campaigns.script,
          dispositions: lead.campaigns.dispositions,
        } : null,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const addNote = async (req, res, next) => {
  try {
    const { text } = req.body;

    // Get current notes
    const { data: lead, error: fetchError } = await supabase
      .from('leads')
      .select('notes')
      .eq('id', req.params.id)
      .single();

    if (fetchError) throw fetchError;

    const notes = lead.notes || [];
    notes.push({
      text,
      createdBy: req.user.id,
      createdAt: new Date().toISOString(),
    });

    const { data: updatedLead, error } = await supabase
      .from('leads')
      .update({ notes })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data: {
        _id: updatedLead.id,
        notes: updatedLead.notes,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const importLeadsFromFile = async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400);
      throw new Error('No file uploaded');
    }

    const { campaignId, fieldMapping } = req.body;

    if (!campaignId) {
      res.status(400);
      throw new Error('Campaign ID is required');
    }

    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();

    let data;
    if (ext === '.csv') {
      data = await parseCSV(filePath);
    } else {
      data = parseExcel(filePath);
    }

    if (data.length === 0) {
      res.status(400);
      throw new Error('File is empty');
    }

    // Parse field mapping if provided as string
    const mapping = fieldMapping ? JSON.parse(fieldMapping) : {};

    const result = await importLeads(campaignId, data, mapping);

    res.json({
      success: true,
      data: {
        imported: result.imported,
        errors: result.errors,
        total: result.total,
      },
      message: `Successfully imported ${result.imported} of ${result.total} leads`,
    });
  } catch (error) {
    next(error);
  }
};
