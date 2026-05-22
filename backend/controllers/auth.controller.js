// auth.controller.js

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const bcrypt = require('bcryptjs');


const User = require('../models/User.model');
const AuditLog = require('../models/AuditLog.model');
const {
  sendVerificationEmail,
  sendPasswordSetEmail,
  sendStatusChangeEmail,
  sendOtpEmail
} = require('../services/email.service');

/**
 * Generate JWT token for user
 */
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
      email: user.email,
      department: user.department
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

/**
 * Step 1 — Employee submits company email for verification
 * POST /api/auth/request-verification
 * Public
 */
const requestVerification = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const normalizedEmail = email.toLowerCase().trim();
    if (!normalizedEmail.endsWith('@vdartinc.com') && !normalizedEmail.endsWith('@ndartinc.com')) {
      return res.status(400).json({ success: false, message: 'Only @vdartinc.com or @ndartinc.com emails are accepted' });
    }

    let user = await User.findOne({ email: normalizedEmail }).select('+verificationToken +verificationTokenExpiry');

    if (user?.isVerified && user?.isActive) {
      return res.status(400).json({ success: false, message: 'This email is already registered. Please log in.' });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    if (user) {
      user.verificationToken = hashedToken;
      user.verificationTokenExpiry = expiry;
      await user.save({ validateBeforeSave: false });
    } else {
      user = await User.create({
        email: normalizedEmail,
        verificationToken: hashedToken,
        verificationTokenExpiry: expiry,
        isVerified: false,
        isActive: false,
        createdByAdmin: false,
        name: '',
        role: 'employee'
      });
    }

    const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${rawToken}&email=${normalizedEmail}`;
    try {
      await sendVerificationEmail({ to: normalizedEmail, verifyUrl });
    } catch (emailErr) {
      console.error('❌ sendVerificationEmail failed:', emailErr.message);
      return res.status(500).json({ success: false, message: 'Failed to send verification email. Please try again later.' });
    }

    res.json({ success: true, message: 'Verification link sent to your email. Please check your inbox.' });
  } catch (err) {
    next(err);
  }
};

/**
 * Step 2 — Employee clicks verification link
 * GET /api/auth/verify-email?token=xxx&email=xxx
 * Public
 */
const verifyEmail = async (req, res, next) => {
  try {
    const { token, email } = req.query;
    if (!token || !email) return res.status(400).json({ success: false, message: 'Invalid verification link' });

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({ email: email.toLowerCase() }).select('+verificationToken +verificationTokenExpiry');

    if (!user) return res.status(400).json({ success: false, message: 'User not found' });
    if (user.isVerified) return res.status(400).json({ success: false, message: 'Email already verified' });
    if (user.verificationToken !== hashedToken) return res.status(400).json({ success: false, message: 'Invalid or expired verification link' });
    if (user.verificationTokenExpiry < new Date()) return res.status(400).json({ success: false, message: 'Verification link has expired. Please request a new one.' });

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpiry = undefined;
    await user.save({ validateBeforeSave: false });

    res.json({ success: true, message: 'Email verified! An admin will activate your account and share your login details.' });
  } catch (err) {
    next(err);
  }
};

/**
 * Step 1 of login — send OTP only to active users
 * POST /api/auth/send-otp
 * Public
 */
const sendOtp = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const normalizedEmail = email.toLowerCase().trim();
    const isAllowedDomain = normalizedEmail.endsWith('@vdartinc.com') || normalizedEmail.endsWith('@ndartinc.com');

    if (!isAllowedDomain) {
      return res.status(400).json({ success: false, message: 'Only @vdartinc.com or @ndartinc.com emails are permitted.' });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user || !user.isActive) return res.status(404).json({ success: false, message: 'No active account found for this email. Please contact your Admin.' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

    user.otp = hashedOtp;
    user.otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 min
    user.otpAttempts = 0;
    user.otpLockedUntil = null;
    await user.save({ validateBeforeSave: false });

    try {
      await AuditLog.create({ event: 'OTP_SENT', email: normalizedEmail, ip: req.ip, userAgent: req.headers['user-agent'] });
    } catch (logErr) {
      console.error('❌ AuditLog write failed:', logErr.message);
    }

    // Send OTP via email
    try {
      await sendOtpEmail({ to: normalizedEmail, otp });
    } catch (emailErr) {
      console.error('❌ sendOtpEmail failed:', emailErr.message);
      return res.status(500).json({ success: false, message: 'Failed to send OTP. Please try again later.' });
    }

    res.json({ success: true, message: 'OTP code sent! Check your email inbox.' });
    console.log(`OTP for ${normalizedEmail}: ${otp} (for testing purposes)`); // Remove in production
  } catch (err) {
    next(err);
  }
};

/**
 * Step 2 of login — verify OTP and return token
 * POST /api/auth/verify-otp
 * Public
 */
const verifyOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ success: false, message: 'Email and code are required' });

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+otp +otpExpiry +otpAttempts +otpLockedUntil');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (user.otpLockedUntil && user.otpLockedUntil > new Date()) {
      const remainingMinutes = Math.ceil((user.otpLockedUntil - new Date()) / 60000);
      return res.status(403).json({ success: false, message: `Account temporarily locked due to too many failed attempts. Try again in ${remainingMinutes} minutes or resend code.` });
    }

    if (!user.otp) return res.status(400).json({ success: false, message: 'No code was requested. Please request a new one.' });
    if (user.otpExpiry < new Date()) return res.status(400).json({ success: false, message: 'Your code has expired. Please request a new one.' });

    const hashedOtp = crypto.createHash('sha256').update(otp.trim()).digest('hex');
    if (hashedOtp !== user.otp) {
      user.otpAttempts += 1;

      await AuditLog.create({ event: 'OTP_FAILED', email: user.email, ip: req.ip, meta: { attempts: user.otpAttempts } });

      if (user.otpAttempts >= 3) {
        user.otpLockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
        await user.save({ validateBeforeSave: false });
        await AuditLog.create({ event: 'OTP_LOCKED', email: user.email, ip: req.ip, meta: { lockedUntil: user.otpLockedUntil } });
        return res.status(403).json({ success: false, message: 'Too many incorrect attempts. Your account is locked for 15 minutes. Please resend the code to unlock.' });
      }

      await user.save({ validateBeforeSave: false });
      return res.status(400).json({ success: false, message: `Incorrect code. ${3 - user.otpAttempts} attempts remaining.` });
    }

    user.otp = undefined;
    user.otpExpiry = undefined;
    user.otpAttempts = 0;
    user.otpLockedUntil = null;
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    await AuditLog.create({ event: 'OTP_SUCCESS', email: user.email, ip: req.ip });

    const token = generateToken(user);

    res.json({
      success: true,
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        userType: user.userType,
        designation: user.designation,
        avatar: user.avatar,
        preferredContact: user.preferredContact,
        notificationPreferences: user.notificationPreferences,
        location: user.location
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Disabled password login
 * POST /api/auth/login
 * Public
 */
const login = async (req, res, next) => {
  try {
    res.status(403).json({ success: false, message: 'Password login is disabled. Please use OTP-only login.' });
  } catch (err) {
    next(err);
  }
};

/**
 * Get current authenticated user
 * GET /api/auth/me
 * Private
 */
const getMe = async (req, res) => {
  res.json({ success: true, user: req.user });
};

/**
 * Admin — create or activate user
 * POST /api/auth/admin/create-user
 * Private (admin)
 */
const adminCreateUser = async (req, res, next) => {
  try {
    const { email, name, role, department, designation, employeeId, password } = req.body;
    if (!email || !name) return res.status(400).json({ success: false, message: 'Email and name are required' });

    const normalizedEmail = email.toLowerCase().trim();
    let user = await User.findOne({ email: normalizedEmail });

    if (user) {
      user.name = name;
      user.role = role || 'employee';
      user.department = department || 'Other';
      user.designation = designation || '';
      user.employeeId = employeeId || user.employeeId;
      user.isActive = true;
      user.isVerified = true;
      user.createdByAdmin = true;
      if (password) user.password = password;
    } else {
      user = new User({
        email: normalizedEmail,
        name,
        role: role || 'employee',
        department: department || 'Other',
        designation: designation || '',
        employeeId,
        password: password || undefined,
        isVerified: true,
        isActive: true,
        createdByAdmin: true
      });
    }

    await user.save();

    res.status(201).json({
      success: true,
      message: 'User account created. Credentials stored securely — share manually if needed.',
      user: { _id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Admin — reset user's password
 * PUT /api/auth/admin/reset-password
 * Private (admin)
 */
const adminResetPassword = async (req, res, next) => {
  try {
    const { userId, newPassword } = req.body;
    if (!userId || !newPassword) return res.status(400).json({ success: false, message: 'User ID and new password are required' });
    if (newPassword.length < 8) return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: 'Password updated and stored securely. Share with the employee manually if needed.' });
  } catch (err) {
    next(err);
  }
};

const changePassword = async (req, res, next) => {
  try {

    const userId = req.user.id;

    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(userId)
      .select('+password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const isMatch = await bcrypt.compare(
      currentPassword,
      user.password
    );

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    next(error);
  }
};

module.exports = {
  requestVerification,
  verifyEmail,
  sendOtp,
  verifyOtp,
  login,
  getMe,
  adminCreateUser,
  adminResetPassword,
  changePassword
};
