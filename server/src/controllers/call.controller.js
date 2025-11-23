import Call from '../models/Call.js';
import Lead from '../models/Lead.js';
import User from '../models/User.js';

export const getCalls = async (req, res, next) => {
  try {
    const { campaign, agent, status, page = 1, limit = 50 } = req.query;
    const filter = {};

    if (campaign) filter.campaign = campaign;
    if (agent) filter.agent = agent;
    if (status) filter.status = status;

    // Agents can only see their own calls
    if (req.user.role === 'agent') {
      filter.agent = req.user._id;
    }

    const calls = await Call.find(filter)
      .populate('campaign', 'name')
      .populate('agent', 'firstName lastName')
      .populate('lead', 'firstName lastName phone')
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Call.countDocuments(filter);

    res.json({
      success: true,
      count: calls.length,
      total,
      pages: Math.ceil(total / limit),
      data: calls,
    });
  } catch (error) {
    next(error);
  }
};

export const getCall = async (req, res, next) => {
  try {
    const call = await Call.findById(req.params.id)
      .populate('campaign', 'name')
      .populate('agent', 'firstName lastName')
      .populate('lead');

    if (!call) {
      res.status(404);
      throw new Error('Call not found');
    }

    res.json({
      success: true,
      data: call,
    });
  } catch (error) {
    next(error);
  }
};

export const initiateCall = async (req, res, next) => {
  try {
    const { leadId, phone, campaignId } = req.body;
    const agentId = req.user._id;

    // Update agent status to busy
    await User.findByIdAndUpdate(agentId, { status: 'busy' });

    // Create call record
    const call = await Call.create({
      campaign: campaignId,
      lead: leadId,
      agent: agentId,
      direction: 'outbound',
      phone,
      status: 'queued',
      startTime: new Date(),
      events: [{ event: 'initiated', timestamp: new Date() }],
    });

    // Update lead
    if (leadId) {
      await Lead.findByIdAndUpdate(leadId, {
        $inc: { attempts: 1 },
        lastAttempt: new Date(),
        status: 'contacted',
      });
    }

    // Emit socket event
    const io = req.app.get('io');
    io.emit('call:initiated', {
      callId: call._id,
      agentId,
      phone,
    });

    // TODO: Integrate with Twilio/VAPI to make actual call
    // For now, simulate call connection
    call.status = 'ringing';
    call.events.push({ event: 'ringing', timestamp: new Date() });
    await call.save();

    res.status(201).json({
      success: true,
      data: call,
    });
  } catch (error) {
    next(error);
  }
};

export const endCall = async (req, res, next) => {
  try {
    const call = await Call.findById(req.params.id);

    if (!call) {
      res.status(404);
      throw new Error('Call not found');
    }

    call.status = 'completed';
    call.endTime = new Date();
    call.events.push({ event: 'hangup', timestamp: new Date() });
    await call.save();

    // Update agent status back to available
    await User.findByIdAndUpdate(call.agent, { status: 'available' });

    // Emit socket event
    const io = req.app.get('io');
    io.emit('call:ended', {
      callId: call._id,
      agentId: call.agent,
    });

    res.json({
      success: true,
      data: call,
    });
  } catch (error) {
    next(error);
  }
};

export const transferCall = async (req, res, next) => {
  try {
    const { targetNumber, targetAgentId } = req.body;
    const call = await Call.findById(req.params.id);

    if (!call) {
      res.status(404);
      throw new Error('Call not found');
    }

    call.transferredTo = targetNumber || targetAgentId;
    call.transferredBy = req.user._id;
    call.events.push({
      event: 'transfer',
      timestamp: new Date(),
      data: { to: targetNumber || targetAgentId },
    });
    await call.save();

    // TODO: Integrate with Twilio/VAPI for actual transfer

    const io = req.app.get('io');
    io.emit('call:transferred', {
      callId: call._id,
      from: req.user._id,
      to: targetNumber || targetAgentId,
    });

    res.json({
      success: true,
      data: call,
    });
  } catch (error) {
    next(error);
  }
};

export const getActiveCalls = async (req, res, next) => {
  try {
    const calls = await Call.find({
      status: { $in: ['queued', 'ringing', 'in-progress'] },
    })
      .populate('agent', 'firstName lastName')
      .populate('lead', 'firstName lastName phone')
      .populate('campaign', 'name');

    res.json({
      success: true,
      count: calls.length,
      data: calls,
    });
  } catch (error) {
    next(error);
  }
};

export const updateCallDisposition = async (req, res, next) => {
  try {
    const { disposition, notes, nextCallback } = req.body;

    const call = await Call.findByIdAndUpdate(
      req.params.id,
      { disposition, notes },
      { new: true }
    );

    if (!call) {
      res.status(404);
      throw new Error('Call not found');
    }

    // Update lead with disposition and callback if needed
    if (call.lead) {
      const leadUpdate = {
        lastDisposition: disposition,
      };

      if (nextCallback) {
        leadUpdate.status = 'callback';
        leadUpdate.nextCallback = new Date(nextCallback);
      }

      await Lead.findByIdAndUpdate(call.lead, leadUpdate);
    }

    res.json({
      success: true,
      data: call,
    });
  } catch (error) {
    next(error);
  }
};
