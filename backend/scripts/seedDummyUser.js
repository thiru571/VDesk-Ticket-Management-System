const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('../models/User.model');
const Department = require('../models/Department.model');

const defaultPassword = 'Password123!';

const seedDummyUsers = async () => {
  if (process.env.NODE_ENV === 'production') {
    console.warn('⚠️  Seed aborted: NODE_ENV is "production".');
    return;
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connected');

    // Fetch department ObjectIds
    const itDept      = await Department.findOne({ name: 'IT Department' });
    const hrDept      = await Department.findOne({ name: 'HR Department' });
    const financeDept = await Department.findOne({ name: 'Finance Department' });
    const opsDept     = await Department.findOne({ name: 'Operations Department' });

    if (!itDept) {
      console.error('❌ IT Department not found. Run department seed first: node departments.js');
      process.exit(1);
    }

    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    const dummyUsers = [
      // ── SUPER ADMIN ──
      {
        name: 'Super Admin',
        email: 'superadmin@vdartinc.com',
        password: hashedPassword,
        userType: 'staff',
        role: 'super_admin',
        designation: 'Super Administrator',
        department: itDept._id,
        isApproved: true,
        isActive: true,
        liveStatus: 'available',
        orgLevel: 5,
        executiveStatus: true,
      },

      // ── DEPARTMENT ADMINS ──
      {
        name: 'Ananya Krishnan',
        email: 'ananya.k@vdartinc.com',
        password: hashedPassword,
        userType: 'staff',
        role: 'department_admin',
        designation: 'IT Department Admin',
        department: itDept._id,
        isApproved: true,
        isActive: true,
        liveStatus: 'available',
        orgLevel: 4,
      },
      {
        name: 'Rajesh Patel',
        email: 'rajesh.p@vdartinc.com',
        password: hashedPassword,
        userType: 'staff',
        role: 'department_admin',
        designation: 'HR Department Admin',
        department: hrDept?._id || itDept._id,
        isApproved: true,
        isActive: true,
        liveStatus: 'available',
        orgLevel: 4,
      },
      {
        name: 'Meena Subramaniam',
        email: 'meena.s@vdartinc.com',
        password: hashedPassword,
        userType: 'staff',
        role: 'department_admin',
        designation: 'Finance Department Admin',
        department: financeDept?._id || itDept._id,
        isApproved: true,
        isActive: true,
        liveStatus: 'available',
        orgLevel: 4,
      },

      // ── IT HELPDESK AGENTS ──
      {
        name: 'James Wilson',
        email: 'james.w@vdesk.com',
        password: hashedPassword,
        userType: 'staff',
        role: 'agent',
        agentRole: 'it_helpdesk',
        designation: 'L1 Helpdesk Engineer',
        department: itDept._id,
        expertise: ['network', 'vpn', 'windows'],
        shift: 'Morning',
        isApproved: true,
        isActive: true,
        liveStatus: 'available',
        orgLevel: 2,
      },
      {
        name: 'Priya Rajan',
        email: 'priya.r@vdesk.com',
        password: hashedPassword,
        userType: 'staff',
        role: 'agent',
        agentRole: 'it_helpdesk',
        designation: 'L1 Helpdesk Engineer',
        department: itDept._id,
        expertise: ['software', 'email', 'outlook'],
        shift: 'Mid',
        isApproved: true,
        isActive: true,
        liveStatus: 'available',
        orgLevel: 2,
      },
      {
        name: 'Sarah Thompson',
        email: 'sarah.t@vdesk.com',
        password: hashedPassword,
        userType: 'staff',
        role: 'agent',
        agentRole: 'it_helpdesk',
        designation: 'L1 Helpdesk Engineer',
        department: itDept._id,
        expertise: ['hardware', 'printer', 'accessories'],
        shift: 'Night',
        isApproved: true,
        isActive: true,
        liveStatus: 'offline',
        orgLevel: 2,
      },

      // ── IT SUPPORT AGENTS ──
      {
        name: 'Mohammed Farhan',
        email: 'farhan.m@vdesk.com',
        password: hashedPassword,
        userType: 'staff',
        role: 'agent',
        agentRole: 'it_support',
        designation: 'L2 IT Support Engineer',
        department: itDept._id,
        expertise: ['security', 'firewall', 'servers'],
        shift: 'Morning',
        isApproved: true,
        isActive: true,
        liveStatus: 'available',
        orgLevel: 3,
      },
      {
        name: 'Kevin Chen',
        email: 'kevin.c@vdesk.com',
        password: hashedPassword,
        userType: 'staff',
        role: 'agent',
        agentRole: 'it_support',
        designation: 'L2 IT Support Engineer',
        department: itDept._id,
        expertise: ['database', 'backup', 'linux'],
        shift: 'Mid',
        isApproved: true,
        isActive: true,
        liveStatus: 'available',
        orgLevel: 3,
      },
      {
        name: 'Arjun Mehta',
        email: 'arjun.m@vdesk.com',
        password: hashedPassword,
        userType: 'staff',
        role: 'agent',
        agentRole: 'it_support',
        designation: 'L3 Senior IT Engineer',
        department: itDept._id,
        expertise: ['infrastructure', 'cloud', 'devops'],
        shift: 'Morning',
        isApproved: true,
        isActive: true,
        liveStatus: 'remote',
        orgLevel: 3,
      },
      {
        name: 'Lakshmi Venkat',
        email: 'lakshmi.v@vdesk.com',
        password: hashedPassword,
        userType: 'staff',
        role: 'agent',
        agentRole: 'it_support',
        designation: 'IT Support Specialist',
        department: opsDept?._id || itDept._id,
        expertise: ['network', 'monitoring', 'escalation'],
        shift: 'Night',
        isApproved: true,
        isActive: true,
        liveStatus: 'offline',
        orgLevel: 2,
      },

      // ── EMPLOYEES ──
      {
        name: 'Karthik Sundaram',
        email: 'karthik.s@vdartinc.com',
        password: hashedPassword,
        userType: 'employee',
        designation: 'Software Developer',
        department: itDept._id,
        isApproved: true,
        isActive: true,
        liveStatus: 'available',
        orgLevel: 2,
      },
      {
        name: 'Nithya Balaji',
        email: 'nithya.b@vdartinc.com',
        password: hashedPassword,
        userType: 'employee',
        designation: 'Marketing Executive',
        department: opsDept?._id || itDept._id,
        isApproved: true,
        isActive: true,
        liveStatus: 'available',
        orgLevel: 2,
      },
      {
        name: 'Vikram Iyer',
        email: 'vikram.i@vdartinc.com',
        password: hashedPassword,
        userType: 'employee',
        designation: 'Sales Executive',
        department: financeDept?._id || itDept._id,
        isApproved: true,
        isActive: true,
        liveStatus: 'available',
        orgLevel: 2,
      },
      {
        name: 'Pooja Sharma',
        email: 'pooja.s@vdartinc.com',
        password: hashedPassword,
        userType: 'employee',
        designation: 'Finance Analyst',
        department: financeDept?._id || itDept._id,
        isApproved: true,
        isActive: true,
        liveStatus: 'available',
        orgLevel: 2,
      },
      {
        name: 'Divya Nair',
        email: 'divya.n@vdartinc.com',
        password: hashedPassword,
        userType: 'employee',
        designation: 'HR Executive',
        department: hrDept?._id || itDept._id,
        isApproved: true,
        isActive: true,
        liveStatus: 'available',
        orgLevel: 2,
      },
      {
        name: 'Arun Kumar',
        email: 'arun.k@vdartinc.com',
        password: hashedPassword,
        userType: 'employee',
        designation: 'Operations Analyst',
        department: opsDept?._id || itDept._id,
        isApproved: true,
        isActive: true,
        liveStatus: 'available',
        orgLevel: 2,
      },
      {
        name: 'Sneha Reddy',
        email: 'sneha.r@vdartinc.com',
        password: hashedPassword,
        userType: 'employee',
        designation: 'QA Engineer',
        department: itDept._id,
        isApproved: true,
        isActive: true,
        liveStatus: 'available',
        orgLevel: 2,
      },
      {
        name: 'David Fernandez',
        email: 'david.f@vdartinc.com',
        password: hashedPassword,
        userType: 'employee',
        designation: 'Business Analyst',
        department: opsDept?._id || itDept._id,
        isApproved: true,
        isActive: true,
        liveStatus: 'available',
        orgLevel: 3,
        executiveStatus: true,
      },
    ];

    // Delete only these seeded users, keep real accounts safe
    await User.deleteMany({ email: { $in: dummyUsers.map((u) => u.email) } });
    await User.insertMany(dummyUsers);

    console.log(`✅ Seeded ${dummyUsers.length} dummy users successfully.`);
    console.log(`🔑 All users password: ${defaultPassword}\n`);
    console.log('📋 Users seeded:');

    const staffUsers    = dummyUsers.filter((u) => u.userType === 'staff');
    const employeeUsers = dummyUsers.filter((u) => u.userType === 'employee');

    console.log('\n  [STAFF]');
    staffUsers.forEach((u) =>
      console.log(`   ${(u.role + (u.agentRole ? '/' + u.agentRole : '')).padEnd(25)} ${u.name.padEnd(22)} → ${u.email}`)
    );
    console.log('\n  [EMPLOYEES]');
    employeeUsers.forEach((u) =>
      console.log(`   ${'employee'.padEnd(25)} ${u.name.padEnd(22)} → ${u.email}`)
    );

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding users:', error.message);
    process.exit(1);
  }
};

seedDummyUsers();