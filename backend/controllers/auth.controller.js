const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const User = require('../models/User.model');
const AuditLog = require('../models/AuditLog.model');
const {
  sendVerificationEmail,
  sendPasswordSetEmail,
  sendStatusChangeEmail,
  sendOtpEmail,
  sendPasswordResetEmail,  
} = require('../services/email.service');

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role, email: user.email, department: user.department },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

const requestVerification = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const normalizedEmail = email.toLowerCase().trim();

const allowedDomains = [
  '@vdartinc.com',
  '@ndartinc.com',
  '@gmail.com'
];

const isAllowed = allowedDomains.some(domain =>
  normalizedEmail.endsWith(domain)
);

if (!isAllowed) {
  return res.status(400).json({
    success: false,
    message: 'Only @vdartinc.com, @ndartinc.com or @gmail.com emails are accepted'
  });
}

    let user = await User.findOne({ email: normalizedEmail }).select('+verificationToken +verificationTokenExpiry');

    if (user?.isVerified && user?.isActive) {
      return res.status(400).json({ success: false, message: 'This email is already registered. Please log in.' });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

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

const sendOtp = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const allowedDomains = [
  '@vdartinc.com',
  '@ndartinc.com',
  '@gmail.com'
];

const isAllowedDomain = allowedDomains.some(domain =>
  normalizedEmail.endsWith(domain)
);

    if (!isAllowedDomain) {
      return res.status(400).json({
        success: false,
        message: 'Only @vdartinc.com or @ndartinc.com emails are permitted.'
      });
    }

    const user = await User.findOne({
      email: normalizedEmail
    }).select('+otp +otpExpiry +otpAttempts +otpLockedUntil');

    if (!user || !user.isActive) {
      return res.status(404).json({
        success: false,
        message: 'No active account found for this email.'
      });
    }

    // Generate OTP
    const otp = Math.floor(
      100000 + Math.random() * 900000
    ).toString();

    // Print OTP in console
    console.log('================================');
    console.log('EMAIL:', normalizedEmail);
    console.log('GENERATED OTP:', otp);
    console.log('================================');

    // Hash OTP
    const hashedOtp = crypto
      .createHash('sha256')
      .update(otp.trim())
      .digest('hex');

    // Save OTP details
    user.otp = hashedOtp;
    user.otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 mins
    user.otpAttempts = 0;
    user.otpLockedUntil = null;

    await user.save({
      validateBeforeSave: false
    });

    console.log('OTP SAVED SUCCESSFULLY');

    // Audit Log
    try {
      await AuditLog.create({
        event: 'OTP_SENT',
        email: normalizedEmail,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });
    } catch (logErr) {
      console.error('AuditLog Error:', logErr.message);
    }

    console.log('================================');
    console.log('DEV MODE OTP:', otp);
    console.log('================================');

    return res.status(200).json({
      success: true,
      message: 'OTP sent successfully. Check your email.',

      ...(process.env.NODE_ENV === 'development' && {
        devOtp: otp
      })
    });

  } catch (err) {
    console.error('SEND OTP ERROR:', err);
    next(err);
  }
};


const verifyOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ success: false, message: 'Email and OTP are required' });

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail }).select('+otp +otpExpiry +otpAttempts +otpLockedUntil');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (user.otpLockedUntil && user.otpLockedUntil > new Date()) {
      const remainingMinutes = Math.ceil((user.otpLockedUntil - new Date()) / 60000);
      return res.status(403).json({ success: false, message: `Account locked. Try again in ${remainingMinutes} minutes.` });
    }

    if (!user.otp) return res.status(400).json({ success: false, message: 'No OTP found. Please request a new OTP.' });
    if (!user.otpExpiry || user.otpExpiry < new Date()) return res.status(400).json({ success: false, message: 'OTP expired. Please request a new OTP.' });

    const hashedOtp = crypto.createHash('sha256').update(String(otp).trim()).digest('hex');

    if (hashedOtp !== user.otp) {
      user.otpAttempts += 1;
      await AuditLog.create({ event: 'OTP_FAILED', email: user.email, ip: req.ip, meta: { attempts: user.otpAttempts } });

      if (user.otpAttempts >= 3) {
        user.otpLockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        await user.save({ validateBeforeSave: false });
        await AuditLog.create({ event: 'OTP_LOCKED', email: user.email, ip: req.ip, meta: { lockedUntil: user.otpLockedUntil } });
        return res.status(403).json({ success: false, message: 'Too many incorrect attempts. Account locked for 15 minutes.' });
      }

      await user.save({ validateBeforeSave: false });
      return res.status(400).json({ success: false, message: `Incorrect OTP. ${3 - user.otpAttempts} attempts remaining.` });
    }

    user.otp = undefined;
    user.otpExpiry = undefined;
    user.otpAttempts = 0;
    user.otpLockedUntil = null;
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    await AuditLog.create({ event: 'OTP_SUCCESS', email: user.email, ip: req.ip });

    const token = generateToken(user);

    return res.json({
      success: true,
      message: 'OTP verified successfully',
      token,
      user: {
  _id: user._id,
  name: user.name,
  email: user.email,
  employeeId: user.employeeId,
  phone: user.phone,
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

const login = async (req, res, next) => {
  try {
    res.status(403).json({ success: false, message: 'Password login is disabled. Please use OTP-only login.' });
  } catch (err) {
    next(err);
  }
};

// ─── FIX: fetch full user from DB instead of returning req.user (JWT payload) ──
// req.user only contains: id, role, email, department — NO avatar, name, location etc.
// Without this fix, every page refresh strips the avatar and any profile fields
// not baked into the token.
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select(
  '_id name email employeeId phone role department userType designation avatar preferredContact notificationPreferences location stats'
);

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
};

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
        email: normalizedEmail, name, role: role || 'employee',
        department: department || 'Other', designation: designation || '',
        employeeId, password: password || undefined,
        isVerified: true, isActive: true, createdByAdmin: true
      });
    }

    await user.save();
    res.status(201).json({
      success: true,
      message: 'User account created.',
      user: { _id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    next(err);
  }
};

const adminResetPassword = async (req, res, next) => {
  try {
    const { userId, newPassword } = req.body;
    if (!userId || !newPassword) return res.status(400).json({ success: false, message: 'User ID and new password are required' });
    if (newPassword.length < 8) return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Password updated.' });
  } catch (err) {
    next(err);
  }
};


//-----------------Forget Password & Change Password-----------------

const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({
      email: email.toLowerCase().trim()
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Save hashed token
    user.resetPasswordToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    user.resetPasswordExpiry = Date.now() + 60 * 60 * 1000;

    await user.save({ validateBeforeSave: false });

    // Create reset URL
    const resetUrl =
      `${process.env.FRONTEND_URL || 'http://localhost:5174'}/reset-password/${resetToken}`;

    // 👇 PASTE HERE
    console.log('🔗 Password Reset URL:', resetUrl);

    // Send email
    await sendPasswordResetEmail({
      to: user.email,
      resetUrl
    });

    res.status(200).json({
      success: true,
      message: 'Password reset email sent successfully'
    });

  } catch (err) {
    next(err);
  }
};
//--------------Forget Password & Change Password-----------------

const resetPassword = async (req, res, next) => {
  try {
    const hashedToken = crypto
      .createHash('sha256')
      .update(req.params.token)
      .digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpiry: { $gt: Date.now() }
    }).select('+resetPasswordToken +resetPasswordExpiry');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    const { password } = req.body;

    if (!password || password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters'
      });
    }

    user.password = password;

    user.resetPasswordToken = undefined;
    user.resetPasswordExpiry = undefined;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password reset successful'
    });

  } catch (err) {
    next(err);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(userId).select('+password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ success: false, message: 'Current password is incorrect' });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.status(200).json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
};

// ─── FIX: added avatar and notificationPreferences to updateProfile ───────────
const UptadeProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const {
      name,
      email,
      employeeId,
      department,
      designation,
      preferredContact,
      location,
      avatar,
      notificationPreferences,
      phone,
    } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (name !== undefined)                user.name = name;
    if (department !== undefined)          user.department = department;
    if (designation !== undefined)         user.designation = designation;
    if (preferredContact !== undefined)    user.preferredContact = preferredContact;
    if (phone !== undefined)               user.phone = phone;
    if (location !== undefined)            user.location = { ...user.location, ...location };
    if (avatar !== undefined)              user.avatar = avatar;   // null clears it, string sets it
    if (notificationPreferences !== undefined) {
      user.notificationPreferences = { ...user.notificationPreferences, ...notificationPreferences };
    }
    if (email !== undefined) user.email = email;
if (employeeId !== undefined) user.employeeId = employeeId;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        designation: user.designation,
        preferredContact: user.preferredContact,
        phone: user.phone,
        location: user.location,
        avatar: user.avatar,                           // ← now returned
        notificationPreferences: user.notificationPreferences, // ← now returned
      }
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
  changePassword,
  UptadeProfile,
  forgotPassword,
  resetPassword
};