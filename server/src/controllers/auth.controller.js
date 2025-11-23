import jwt from 'jsonwebtoken';
import { validationResult } from 'express-validator';
import User from '../models/User.js';
import config from '../config/index.js';

const generateToken = (id) => {
  return jwt.sign({ id }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
};

export const register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400);
      throw new Error(errors.array()[0].msg);
    }

    const { email, password, firstName, lastName, role, team, extension } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      res.status(400);
      throw new Error('User already exists');
    }

    const user = await User.create({
      email,
      password,
      firstName,
      lastName,
      role: role || 'agent',
      team,
      extension,
    });

    res.status(201).json({
      success: true,
      data: {
        _id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        token: generateToken(user._id),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400);
      throw new Error(errors.array()[0].msg);
    }

    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      res.status(401);
      throw new Error('Invalid credentials');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      res.status(401);
      throw new Error('Invalid credentials');
    }

    // Update last login and set status to available
    user.lastLogin = new Date();
    user.status = 'available';
    await user.save();

    res.json({
      success: true,
      data: {
        _id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
        token: generateToken(user._id),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

export const updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ['available', 'busy', 'break', 'offline'];

    if (!validStatuses.includes(status)) {
      res.status(400);
      throw new Error('Invalid status');
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { status },
      { new: true }
    );

    // Emit status change via socket
    const io = req.app.get('io');
    io.emit('agent:statusChanged', {
      agentId: user._id,
      status: user.status,
    });

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};
