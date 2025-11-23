import { validationResult } from 'express-validator';
import Campaign from '../models/Campaign.js';
import Lead from '../models/Lead.js';
import Call from '../models/Call.js';

export const getCampaigns = async (req, res, next) => {
  try {
    const { status, type } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (type) filter.type = type;

    // Agents only see campaigns they're assigned to
    if (req.user.role === 'agent') {
      filter.assignedAgents = req.user._id;
    }

    const campaigns = await Campaign.find(filter)
      .populate('createdBy', 'firstName lastName')
      .sort('-createdAt');

    res.json({
      success: true,
      count: campaigns.length,
      data: campaigns,
    });
  } catch (error) {
    next(error);
  }
};

export const getCampaign = async (req, res, next) => {
  try {
    const campaign = await Campaign.findById(req.params.id)
      .populate('createdBy', 'firstName lastName')
      .populate('assignedAgents', 'firstName lastName email status');

    if (!campaign) {
      res.status(404);
      throw new Error('Campaign not found');
    }

    res.json({
      success: true,
      data: campaign,
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

    const campaign = await Campaign.create({
      ...req.body,
      createdBy: req.user._id,
    });

    res.status(201).json({
      success: true,
      data: campaign,
    });
  } catch (error) {
    next(error);
  }
};

export const updateCampaign = async (req, res, next) => {
  try {
    const campaign = await Campaign.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!campaign) {
      res.status(404);
      throw new Error('Campaign not found');
    }

    res.json({
      success: true,
      data: campaign,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteCampaign = async (req, res, next) => {
  try {
    const campaign = await Campaign.findByIdAndDelete(req.params.id);

    if (!campaign) {
      res.status(404);
      throw new Error('Campaign not found');
    }

    // Also delete associated leads
    await Lead.deleteMany({ campaign: req.params.id });

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

    const [leadStats, callStats] = await Promise.all([
      Lead.aggregate([
        { $match: { campaign: campaignId } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]),
      Call.aggregate([
        { $match: { campaign: campaignId } },
        {
          $group: {
            _id: null,
            totalCalls: { $sum: 1 },
            totalDuration: { $sum: '$duration' },
            avgDuration: { $avg: '$duration' },
          },
        },
      ]),
    ]);

    res.json({
      success: true,
      data: {
        leads: leadStats,
        calls: callStats[0] || { totalCalls: 0, totalDuration: 0, avgDuration: 0 },
      },
    });
  } catch (error) {
    next(error);
  }
};
