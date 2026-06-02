const mongoose = require('mongoose');
const User = require('../models/User.model');
const Department = require('./models/Department');

const seedTestUsers = async () => {
  try {
    // Fetch departments to link users
    const itDepartment = await Department.findOne({ name: 'IT Department' });
    const hrDepartment = await Department.findOne({ name: 'HR Department' });

    if (!itDepartment || !hrDepartment) {
      console.error('❌ Required departments not found. Please ensure departments are seeded first.');
      return;
    }

    const users = [
      // SUPER ADMIN
      {
        name: 'Super Admin',
        email: 'superadmin@vdartinc.com',
        password: 'SuperAdmin@123',
        userType: 'staff',
        role: 'super_admin',
        isApproved: true,
        isActive: true,
        orgLevel: 5,
        executiveStatus: true
      },
      // IT DEPARTMENT
      {
        name: 'IT Admin',
        email: 'itadmin@vdartinc.com',
        password: 'ITAdmin@123',
        userType: 'staff',
        role: 'department_admin',
        department: itDepartment._id,
        isApproved: true,
        isActive: true,
        orgLevel: 4
      },
      {
        name: 'IT Agent One',
        email: 'itagent1@vdartinc.com',
        password: 'ITAgent1@123',
        userType: 'staff',
        role: 'agent',
        department: itDepartment._id,
        shift: 'Morning',
        isApproved: true,
        isActive: true,
        orgLevel: 2
      },
      {
        name: 'IT Agent Two',
        email: 'itagent2@vdartinc.com',
        password: 'ITAgent2@123',
        userType: 'staff',
        role: 'agent',
        department: itDepartment._id,
        shift: 'Mid',
        isApproved: true,
        isActive: true,
        orgLevel: 2
      },
      // HR DEPARTMENT (isActive: false — admin/agents seeded but dept inactive)
      {
        name: 'HR Admin',
        email: 'hradmin@vdartinc.com',
        password: 'HRAdmin@123',
        userType: 'staff',
        role: 'department_admin',
        department: hrDepartment._id,
        isApproved: true,
        isActive: true,
        orgLevel: 4
      },
      {
        name: 'HR Agent One',
        email: 'hragent1@vdartinc.com',
        password: 'HRagent1@123',
        userType: 'staff',
        role: 'agent',
        department: hrDepartment._id,
        shift: 'Morning',
        isApproved: true,
        isActive: true,
        orgLevel: 2
      },
      {
        name: 'HR Agent Two',
        email: 'hragent2@vdartinc.com',
        password: 'HRagent2@123',
        userType: 'staff',
        role: 'agent',
        department: hrDepartment._id,
        shift: 'Night',
        isApproved: true,
        isActive: true,
        orgLevel: 2
      },
      // EMPLOYEES
      {
        name: 'Test Employee One',
        email: 'employee1@vdartinc.com',
        userType: 'employee',
        isApproved: true,
        isActive: true,
        orgLevel: 1
      },
      {
        name: 'Test Employee Two',
        email: 'employee2@vdartinc.com',
        userType: 'employee',
        isApproved: true,
        isActive: true,
        orgLevel: 1
      }
    ];

    for (const userData of users) {
      await User.findOneAndUpdate(
        { email: userData.email },
        { $set: userData },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
    console.log('✅ Test users seeded successfully.');
  } catch (error) {
    console.error('❌ Error seeding test users:', error);
  }
};

module.exports = seedTestUsers;