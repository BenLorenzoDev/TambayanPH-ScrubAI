import User from '../models/User.js';
import Call from '../models/Call.js';

export const getUsers = async (req, res, next) => {
  try {
    const { role, status, team } = req.query;
    const filter = {};

    if (role) filter.role = role;
    if (status) filter.status = status;
    if (team) filter.team = team;

    const users = await User.find(filter).select('-password');

    res.json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    next(error);
  }
};

export const getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (req, res, next) => {
  try {
    const { password, ...updateData } = req.body;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }

    res.json({
      success: true,
      message: 'User deactivated successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const getAgentStats = async (req, res, next) => {
  try {
    const agentId = req.params.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [todayStats, totalStats] = await Promise.all([
      // Today's stats
      Call.aggregate([
        {
          $match: {
            agent: agentId,
            createdAt: { $gte: today },
          },
        },
        {
          $group: {
            _id: null,
            totalCalls: { $sum: 1 },
            totalDuration: { $sum: '$duration' },
            totalTalkTime: { $sum: '$talkTime' },
            answered: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
            },
          },
        },
      ]),
      // All time stats
      Call.aggregate([
        {
          $match: { agent: agentId },
        },
        {
          $group: {
            _id: null,
            totalCalls: { $sum: 1 },
            totalDuration: { $sum: '$duration' },
            totalTalkTime: { $sum: '$talkTime' },
          },
        },
      ]),
    ]);

    res.json({
      success: true,
      data: {
        today: todayStats[0] || { totalCalls: 0, totalDuration: 0, totalTalkTime: 0, answered: 0 },
        total: totalStats[0] || { totalCalls: 0, totalDuration: 0, totalTalkTime: 0 },
      },
    });
  } catch (error) {
    next(error);
  }
};
