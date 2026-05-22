const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '../.env' });
const User = require('../models/User.model');

async function seedAdmin() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB Connected');

    const existingAdmin = await User.findOne({ email: 'admin@vdartinc.com' });
    if (existingAdmin) {
      console.log('⚠️ Admin already exists, skipping...');
      process.exit();
    }

    const admin = new User({
      name: 'System Admin',
      email: 'admin@vdartinc.com',
      password: 'Admin@123',
      role: 'admin',
      department: 'IT',
      designation: 'System Administrator',
      employeeId: 'ADMIN-001',
      isVerified: true,
      isActive: true,
      createdByAdmin: true,
      phone: '9999999999'
    });

    await admin.save();
    console.log('✅ Admin created successfully');
    console.log('📧 Email   : admin@vdartinc.com');
    console.log('🔑 Password: Admin@123');
    process.exit();

  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
}

seedAdmin();