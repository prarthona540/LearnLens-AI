import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * Generate a signed JWT token valid for 1 day
 * @param {string} id - User ObjectId
 * @returns {string} Signed JWT
 */
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '1d',
  });
};

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
export const registerUser = async (req, res) => {
  try {
    const { name, email, password, role, preferredLanguage } = req.body;

    // Strict input validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: name, email, and password',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long',
      });
    }

    // Check if user already exists
    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email address already exists',
      });
    }

    // Create user (password is automatically hashed via pre-save hook in User model)
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      role: role || 'student',
      preferredLanguage: preferredLanguage || 'en',
    });

    const token = generateToken(user._id);

    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        preferredLanguage: user.preferredLanguage,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error(`[Register Error]: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while registering user',
    });
  }
};

/**
 * @desc    Authenticate user & get token
 * @route   POST /api/auth/login
 * @access  Public
 */
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate credentials presence
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Find user and explicitly include password field for comparison
    const user = await User.findOne({ email: normalizedEmail }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials: User not found',
      });
    }

    // Validate password
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials: Password does not match',
      });
    }

    const token = generateToken(user._id);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        preferredLanguage: user.preferredLanguage,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error(`[Login Error]: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while logging in',
    });
  }
};

/**
 * @desc    Get current user profile
 * @route   GET /api/auth/profile
 * @access  Private (JWT protected)
 */
export const getUserProfile = async (req, res) => {
  try {
    // req.user is set by protect middleware (excludes password)
    return res.status(200).json({
      success: true,
      user: req.user,
    });
  } catch (error) {
    console.error(`[Profile Error]: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while fetching profile',
    });
  }
};
