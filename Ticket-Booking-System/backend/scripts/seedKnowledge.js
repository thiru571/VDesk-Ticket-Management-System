const mongoose = require('mongoose');
const KnowledgeBase = require('../models/KnowledgeBase.model');
const User = require('../models/User.model');

const categories = ['IT', 'HR', 'Finance', 'Admin', 'Operations', 'Marketing', 'Sales', 'Legal', 'Other'];

const dummyArticles = [
  { 
    title: 'How to Reset Your Windows Password', 
    category: 'IT', 
    content: 'Follow these steps to securely reset your corporate Windows password.', 
    tags: ['password', 'windows', 'security'],
    steps: [
      { stepNumber: 1, instruction: 'Press Ctrl + Alt + Delete on your login screen.' },
      { stepNumber: 2, instruction: 'Select "Change a password" from the menu options.' },
      { stepNumber: 3, instruction: 'Enter your old password, then your new password twice (must be 12+ chars).' },
      { stepNumber: 4, instruction: 'If you forgot your password, use the "Self-Service Reset" link on the portal.' },
      { stepNumber: 5, instruction: 'Sync your new password with Outlook and Teams on your mobile device.' }
    ]
  },
  { 
    title: 'Connecting to the Corporate VPN', 
    category: 'IT', 
    content: 'Access internal resources securely while working remotely.', 
    tags: ['vpn', 'remote', 'network'],
    steps: [
      { stepNumber: 1, instruction: 'Launch the Cisco AnyConnect Secure Mobility Client.' },
      { stepNumber: 2, instruction: 'Select the "Global-Remote" gateway address.' },
      { stepNumber: 3, instruction: 'Click "Connect" and enter your domain username and password.' },
      { stepNumber: 4, instruction: 'Approve the Duo push notification sent to your registered phone.' },
      { stepNumber: 5, instruction: 'Verify the connection by accessing the internal Intranet page.' }
    ]
  },
  { 
    title: 'HR Benefits Overview 2024', 
    category: 'HR', 
    content: 'Review the latest health and dental benefits available to all full-time employees.', 
    tags: ['benefits', 'insurance', 'hr'],
    steps: [
      { stepNumber: 1, instruction: 'Log in to the Darwin HR Portal using your employee ID.' },
      { stepNumber: 2, instruction: 'Navigate to the "My Benefits" tab in the dashboard.' },
      { stepNumber: 3, instruction: 'Download the 2024 Benefits Summary PDF for plan comparisons.' },
      { stepNumber: 4, instruction: 'Select your preferred health and dental plans during open enrollment.' },
      { stepNumber: 5, instruction: 'Confirm your beneficiaries and submit the electronic signature.' }
    ]
  },
  { 
    title: 'Requesting Time Off via Portal', 
    category: 'HR', 
    content: 'How to submit vacation, sick leave, or personal time off requests.', 
    tags: ['leave', 'holiday', 'portal'],
    steps: [
      { stepNumber: 1, instruction: 'Access the Time & Attendance module in the HR portal.' },
      { stepNumber: 2, instruction: 'Check your current leave balance to ensure sufficient credits.' },
      { stepNumber: 3, instruction: 'Select "New Request" and choose the leave type and date range.' },
      { stepNumber: 4, instruction: 'Add a comment if necessary and click "Submit for Approval".' },
      { stepNumber: 5, instruction: 'Wait for the automated email notification confirming manager approval.' }
    ]
  },
  { 
    title: 'Expense Reimbursement Policy', 
    category: 'Finance', 
    content: 'Guidelines for submitting travel and business expense claims.', 
    tags: ['expense', 'money', 'policy'],
    steps: [
      { stepNumber: 1, instruction: 'Download the latest Expense Reimbursement Form from the Finance shared drive.' },
      { stepNumber: 2, instruction: 'Attach original digital receipts for all items over $25.00.' },
      { stepNumber: 3, instruction: 'Categorize expenses (Travel, Meals, Supplies) as per the policy manual.' },
      { stepNumber: 4, instruction: 'Obtain digital approval signature from your direct supervisor.' },
      { stepNumber: 5, instruction: 'Email the completed form and receipts to accounts-payable@vdartinc.com.' }
    ]
  },
  { 
    title: 'Office Security Protocol', 
    category: 'Admin', 
    content: 'Mandatory security practices for all on-site employees.', 
    tags: ['security', 'badge', 'office'],
    steps: [
      { stepNumber: 1, instruction: 'Always wear your company ID badge visibly while in the building.' },
      { stepNumber: 2, instruction: 'Do not allow tailgating - ensure every person swipes their own badge.' },
      { stepNumber: 3, instruction: 'Report any unauthorized visitors to the front desk immediately.' },
      { stepNumber: 4, instruction: 'Lock your computer workstation whenever you step away (Win + L).' },
      { stepNumber: 5, instruction: 'Follow the designated fire exit routes during emergency drills.' }
    ]
  },
  { 
    title: 'Booking a Conference Room', 
    category: 'Admin', 
    content: 'How to reserve meeting spaces for teams and client presentations.', 
    tags: ['meeting', 'calendar', 'room'],
    steps: [
      { stepNumber: 1, instruction: 'Open your Outlook Calendar and select "New Meeting".' },
      { stepNumber: 2, instruction: 'Click on the "Room Finder" tool on the right-hand side.' },
      { stepNumber: 3, instruction: 'Select a room based on capacity and available equipment (TV, Phone).' },
      { stepNumber: 4, instruction: 'Send the meeting invite to all participants to lock the room.' },
      { stepNumber: 5, instruction: 'Check the tablet outside the room to confirm your booking is active.' }
    ]
  },
  { 
    title: 'Marketing Brand Guidelines', 
    category: 'Marketing', 
    content: 'Ensuring consistency across all company communications and presentations.', 
    tags: ['brand', 'design', 'marketing'],
    steps: [
      { stepNumber: 1, instruction: 'Download the Brand Toolkit from the Marketing portal.' },
      { stepNumber: 2, instruction: 'Apply the official hex colors: #0047AB (Blue) and #F2A900 (Gold).' },
      { stepNumber: 3, instruction: 'Use only the "Montserrat" and "Open Sans" font families.' },
      { stepNumber: 4, instruction: 'Ensure the company logo has a minimum clear space of 20 pixels.' },
      { stepNumber: 5, instruction: 'Submit final external designs to brand-review@vdartinc.com for approval.' }
    ]
  },
  { 
    title: 'Sales Commission Structure', 
    category: 'Sales', 
    content: 'Understanding how your quarterly performance translates to earnings.', 
    tags: ['sales', 'commission', 'target'],
    steps: [
      { stepNumber: 1, instruction: 'Review your personalized quota letter for the current fiscal year.' },
      { stepNumber: 2, instruction: 'Track all closed-won deals in the CRM with accurate contract values.' },
      { stepNumber: 3, instruction: 'Achieve at least 80% of your target to trigger the accelerator tier.' },
      { stepNumber: 4, instruction: 'Verify the monthly commission statement sent by the Sales Ops team.' },
      { stepNumber: 5, instruction: 'Submit any discrepancies via the Commission Dispute Form by the 5th.' }
    ]
  },
  { 
    title: 'Legal NDAs and Contracts', 
    category: 'Legal', 
    content: 'Procedures for handling non-disclosure agreements and vendor contracts.', 
    tags: ['legal', 'contract', 'nda'],
    steps: [
      { stepNumber: 1, instruction: 'Request the standard NDA template from the Legal repository.' },
      { stepNumber: 2, instruction: 'Fill in the counterparty details and the purpose of disclosure.' },
      { stepNumber: 3, instruction: 'Forward the draft to legal-review@vdartinc.com for a 24-hour check.' },
      { stepNumber: 4, instruction: 'Send the approved document for e-signature via DocuSign.' },
      { stepNumber: 5, instruction: 'Store the fully executed copy in the Central Contract Database.' }
    ]
  }
];

const seedKnowledgeBase = async () => {
  try {
    const user = await User.findOne({ role: 'admin' }) || await User.findOne();
    const createdBy = user ? user._id : null;

    const generateSteps = (category, i) => [
      { stepNumber: 1, instruction: `Analyze the ${category} request to determine the required outcome.` },
      { stepNumber: 2, instruction: `Gather all necessary documentation related to the ${category} procedure.` },
      { stepNumber: 3, instruction: `Execute the ${category} workflow according to established SLA guidelines.` },
      { stepNumber: 4, instruction: `Log the action taken in the central tracking system for audit purposes.` },
      { stepNumber: 5, instruction: `Follow up with the requester to ensure the ${category} issue is resolved.` }
    ];

    const articlesWithUser = dummyArticles.map((article, idx) => ({
      ...article,
      createdBy,
      isPublished: true,
      viewCount: Math.floor(Math.random() * 100),
      helpfulCount: Math.floor(Math.random() * 50)
    }));

    // Update generate loop to include categories and realistic dummy steps
    for (let i = 11; i <= 30; i++) {
      const category = categories[Math.floor(Math.random() * categories.length)];
      articlesWithUser.push({
        title: `Advanced ${category} Troubleshooting Guide #${i}`,
        category: category,
        content: `Comprehensive guide for advanced troubleshooting and process optimization within the ${category} department.`,
        tags: [category.toLowerCase(), 'expert', 'procedure'],
        keywords: [category.toLowerCase(), 'troubleshooting', 'advanced'],
        createdBy,
        isPublished: true,
        viewCount: Math.floor(Math.random() * 100),
        helpfulCount: Math.floor(Math.random() * 50),
        steps: generateSteps(category, i)
      });
    }

    // Clear existing and re-seed to ensure "perfect" guides are applied
    await KnowledgeBase.deleteMany({}); 
    await KnowledgeBase.insertMany(articlesWithUser);
    console.log(`✅ Seeded ${articlesWithUser.length} knowledge base articles with perfect guides.`);
    
  } catch (error) {
    console.error('❌ Error seeding knowledge base:', error);
  }
};

module.exports = seedKnowledgeBase;
