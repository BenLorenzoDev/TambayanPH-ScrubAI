import { supabase } from '../config/supabase.js';

export const getUsers = async (req, res, next) => {
  try {
    const { role, status, team } = req.query;

    let query = supabase
      .from('users')
      .select('id, email, first_name, last_name, role, status, team, extension, skills, is_active, created_at');

    if (role) query = query.eq('role', role);
    if (status) query = query.eq('status', status);
    if (team) query = query.eq('team', team);

    const { data: users, error } = await query;

    if (error) throw error;

    const formattedUsers = users.map(user => ({
      _id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      status: user.status,
      team: user.team,
      extension: user.extension,
      skills: user.skills,
      isActive: user.is_active,
      createdAt: user.created_at,
    }));

    res.json({
      success: true,
      count: formattedUsers.length,
      data: formattedUsers,
    });
  } catch (error) {
    next(error);
  }
};

export const getUser = async (req, res, next) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, role, status, team, extension, skills')
      .eq('id', req.params.id)
      .single();

    if (error || !user) {
      res.status(404);
      throw new Error('User not found');
    }

    res.json({
      success: true,
      data: {
        _id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        status: user.status,
        team: user.team,
        extension: user.extension,
        skills: user.skills,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (req, res, next) => {
  try {
    const { firstName, lastName, role, team, extension, skills, isActive } = req.body;

    const updateData = {};
    if (firstName) updateData.first_name = firstName;
    if (lastName) updateData.last_name = lastName;
    if (role) updateData.role = role;
    if (team !== undefined) updateData.team = team;
    if (extension !== undefined) updateData.extension = extension;
    if (skills) updateData.skills = skills;
    if (isActive !== undefined) updateData.is_active = isActive;

    const { data: user, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', req.params.id)
      .select('id, email, first_name, last_name, role, status, team, extension, skills')
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data: {
        _id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        status: user.status,
        team: user.team,
        extension: user.extension,
        skills: user.skills,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('users')
      .update({ is_active: false })
      .eq('id', req.params.id);

    if (error) throw error;

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

    // Get today's calls
    const { data: todayCalls, error: todayError } = await supabase
      .from('calls')
      .select('duration, talk_time, status')
      .eq('agent_id', agentId)
      .gte('created_at', today.toISOString());

    if (todayError) throw todayError;

    // Get all-time calls
    const { data: allCalls, error: allError } = await supabase
      .from('calls')
      .select('duration, talk_time')
      .eq('agent_id', agentId);

    if (allError) throw allError;

    // Calculate stats
    const todayStats = {
      totalCalls: todayCalls.length,
      totalDuration: todayCalls.reduce((sum, call) => sum + (call.duration || 0), 0),
      totalTalkTime: todayCalls.reduce((sum, call) => sum + (call.talk_time || 0), 0),
      answered: todayCalls.filter(call => call.status === 'completed').length,
    };

    const totalStats = {
      totalCalls: allCalls.length,
      totalDuration: allCalls.reduce((sum, call) => sum + (call.duration || 0), 0),
      totalTalkTime: allCalls.reduce((sum, call) => sum + (call.talk_time || 0), 0),
    };

    res.json({
      success: true,
      data: {
        today: todayStats,
        total: totalStats,
      },
    });
  } catch (error) {
    next(error);
  }
};
