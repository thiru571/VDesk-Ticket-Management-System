const mongoose = require('mongoose');
const Department = require('./models/Department');

const seedDepartments = async () => {
  try {
    const departments = [
      { name: 'IT Department', isActive: true, description: 'Handles all IT-related issues and infrastructure.' },
      { name: 'HR Department', isActive: false, description: 'Manages human resources, payroll, and employee relations.' },
      { name: 'Finance Department', isActive: false, description: 'Oversees financial operations, budgeting, and accounting.' },
      { name: 'Operations Department', isActive: false, description: 'Manages daily operations and logistics.' },
    ];

    for (const deptData of departments) {
      await Department.findOneAndUpdate(
        { name: deptData.name },
        { $set: deptData },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
    console.log('✅ Departments seeded successfully.');
  } catch (error) {
    console.error('❌ Error seeding departments:', error);
  }
};

module.exports = seedDepartments;