import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import { supabase } from '../config/supabase.js';

export const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, config.jwt.secret);

      const { data: user, error } = await supabase
        .from('users')
        .select('id, email, first_name, last_name, role, status')
        .eq('id', decoded.id)
        .single();

      if (error || !user) {
        res.status(401);
        throw new Error('User not found');
      }

      req.user = {
        id: user.id,
        _id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        status: user.status,
      };

      next();
    } catch (error) {
      res.status(401);
      next(new Error('Not authorized, token failed'));
    }
  } else {
    res.status(401);
    next(new Error('Not authorized, no token'));
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      res.status(403);
      return next(new Error(`Role ${req.user.role} is not authorized to access this route`));
    }
    next();
  };
};
