import { validationResult } from 'express-validator';
import Lead from '../models/Lead.js';
import Campaign from '../models/Campaign.js';

export const getLeads = async (req, res, next) => {
  try {
    const { campaign, status, page = 1, limit = 50 } = req.query;
    const filter = {};

    if (campaign) filter.campaign = campaign;
    if (status) filter.status = status;

    const leads = await Lead.find(filter)
      .populate('campaign', 'name')
      .populate('assignedAgent', 'firstName lastName')
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Lead.countDocuments(filter);

    res.json({
      success: true,
      count: leads.length,
      total,
      pages: Math.ceil(total / limit),
      data: leads,
    });
  } catch (error) {
    next(error);
  }
};

export const getLead = async (req, res, next) => {
  try {
    const lead = await Lead.findById(req.params.id)
      .populate('campaign', 'name script dispositions')
      .populate('assignedAgent', 'firstName lastName')
      .populate('notes.createdBy', 'firstName lastName');

    if (!lead) {
      res.status(404);
      throw new Error('Lead not found');
    }

    res.json({
      success: true,
      data: lead,
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

    const lead = await Lead.create(req.body);

    // Update campaign stats
    await Campaign.findByIdAndUpdate(req.body.campaign, {
      $inc: { 'stats.totalLeads': 1, 'stats.pending': 1 },
    });

    res.status(201).json({
      success: true,
      data: lead,
    });
  } catch (error) {
    next(error);
  }
};

export const updateLead = async (req, res, next) => {
  try {
    const lead = await Lead.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!lead) {
      res.status(404);
      throw new Error('Lead not found');
    }

    res.json({
      success: true,
      data: lead,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteLead = async (req, res, next) => {
  try {
    const lead = await Lead.findByIdAndDelete(req.params.id);

    if (!lead) {
      res.status(404);
      throw new Error('Lead not found');
    }

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
    const agentId = req.user._id;

    // Find next available lead for the agent
    // Priority: callbacks due > high priority > oldest
    const lead = await Lead.findOneAndUpdate(
      {
        campaign: campaignId,
        status: { $in: ['new', 'callback'] },
        $or: [
          { assignedAgent: agentId },
          { assignedAgent: null },
        ],
        $or: [
          { nextCallback: { $lte: new Date() } },
          { nextCallback: null },
        ],
      },
      {
        assignedAgent: agentId,
        status: 'contacted',
      },
      {
        new: true,
        sort: { nextCallback: 1, priority: -1, createdAt: 1 },
      }
    ).populate('campaign', 'name script dispositions');

    if (!lead) {
      res.status(404);
      throw new Error('No leads available');
    }

    res.json({
      success: true,
      data: lead,
    });
  } catch (error) {
    next(error);
  }
};

export const addNote = async (req, res, next) => {
  try {
    const { text } = req.body;

    const lead = await Lead.findByIdAndUpdate(
      req.params.id,
      {
        $push: {
          notes: {
            text,
            createdBy: req.user._id,
          },
        },
      },
      { new: true }
    ).populate('notes.createdBy', 'firstName lastName');

    if (!lead) {
      res.status(404);
      throw new Error('Lead not found');
    }

    res.json({
      success: true,
      data: lead,
    });
  } catch (error) {
    next(error);
  }
};
