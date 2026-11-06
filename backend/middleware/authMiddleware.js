import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * Protect routes by verifying JWT Bearer token in the Authorization header.
 * Attaches the authenticated user document (without password) to req.user.
 */
export const protect = async (req, res, next) => {
  let token;

  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized: No authentication token provided',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch user and exclude password
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized: User belonging to this token no longer exists',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error(`[Auth Middleware Error]: ${error.message}`);

    let message = 'Not authorized: Token verification failed';
    if (error.name === 'TokenExpiredError') {
      message = 'Not authorized: Token has expired';
    } else if (error.name === 'JsonWebTokenError') {
      message = 'Not authorized: Malformed or invalid token';
    }

    return res.status(401).json({
      success: false,
      message,
    });
  }
};
