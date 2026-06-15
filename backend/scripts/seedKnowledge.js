const mongoose = require('mongoose');
const KnowledgeBase = require('../models/KnowledgeBase.model');
const User = require('../models/User.model');

const categories = ['IT', 'HR', 'Finance', 'Admin', 'Operations', 'Marketing', 'Sales', 'Legal', 'Other'];

const categoryTagMap = {
  IT:         ['network', 'software', 'hardware', 'security', 'vpn', 'troubleshooting'],
  HR:         ['benefits', 'leave', 'onboarding', 'policy', 'payroll', 'offboarding'],
  Finance:    ['expense', 'reimbursement', 'budget', 'invoice', 'audit', 'procurement'],
  Admin:      ['office', 'badge', 'meeting', 'calendar', 'facilities', 'compliance'],
  Operations: ['workflow', 'sla', 'process', 'incident', 'monitoring', 'escalation'],
  Marketing:  ['brand', 'design', 'campaign', 'content', 'analytics', 'social'],
  Sales:      ['crm', 'commission', 'target', 'pipeline', 'proposal', 'contract'],
  Legal:      ['nda', 'contract', 'compliance', 'gdpr', 'ip', 'dispute'],
  Other:      ['general', 'miscellaneous', 'policy', 'procedure', 'guide', 'reference'],
};

const difficultyLevels = ['beginner', 'intermediate', 'advanced'];

const estimateReadTime = (steps) => Math.max(1, Math.ceil(steps.length * 0.5));

const dummyArticles = [
  {
    title: 'How to reset your Windows password',
    category: 'IT',
    content: 'Follow these steps to securely reset your corporate Windows password.',
    tags: ['password', 'windows', 'security'],
    keywords: ['password reset', 'windows login', 'corporate credentials', 'self-service'],
    difficulty: 'beginner',
    steps: [
      { stepNumber: 1, instruction: 'Press Ctrl + Alt + Delete on your login screen.' },
      { stepNumber: 2, instruction: 'Select "Change a password" from the menu options.' },
      { stepNumber: 3, instruction: 'Enter your old password, then your new password twice (must be 12+ characters).' },
      { stepNumber: 4, instruction: 'If you forgot your password, use the "Self-Service Reset" link on the portal.' },
      { stepNumber: 5, instruction: 'Sync your new password with Outlook and Teams on your mobile device.' },
    ],
  },
  {
    title: 'Connecting to the corporate VPN',
    category: 'IT',
    content: 'Access internal resources securely while working remotely.',
    tags: ['vpn', 'remote', 'network'],
    keywords: ['vpn setup', 'remote access', 'cisco anyconnect', 'duo mfa'],
    difficulty: 'beginner',
    steps: [
      { stepNumber: 1, instruction: 'Launch the Cisco AnyConnect Secure Mobility Client.' },
      { stepNumber: 2, instruction: 'Select the "Global-Remote" gateway address.' },
      { stepNumber: 3, instruction: 'Click "Connect" and enter your domain username and password.' },
      { stepNumber: 4, instruction: 'Approve the Duo push notification sent to your registered phone.' },
      { stepNumber: 5, instruction: 'Verify the connection by accessing the internal Intranet page.' },
    ],
  },
  {
    title: 'HR benefits overview 2024',
    category: 'HR',
    content: 'Review the latest health and dental benefits available to all full-time employees.',
    tags: ['benefits', 'insurance', 'hr'],
    keywords: ['health insurance', 'dental plan', 'benefits enrollment', 'open enrollment'],
    difficulty: 'beginner',
    steps: [
      { stepNumber: 1, instruction: 'Log in to the Darwin HR Portal using your employee ID.' },
      { stepNumber: 2, instruction: 'Navigate to the "My Benefits" tab in the dashboard.' },
      { stepNumber: 3, instruction: 'Download the 2024 Benefits Summary PDF for plan comparisons.' },
      { stepNumber: 4, instruction: 'Select your preferred health and dental plans during open enrollment.' },
      { stepNumber: 5, instruction: 'Confirm your beneficiaries and submit the electronic signature.' },
    ],
  },
  {
    title: 'Requesting time off via the portal',
    category: 'HR',
    content: 'How to submit vacation, sick leave, or personal time off requests.',
    tags: ['leave', 'holiday', 'portal'],
    keywords: ['time off request', 'leave balance', 'manager approval', 'pto'],
    difficulty: 'beginner',
    steps: [
      { stepNumber: 1, instruction: 'Access the Time & Attendance module in the HR portal.' },
      { stepNumber: 2, instruction: 'Check your current leave balance to ensure sufficient credits.' },
      { stepNumber: 3, instruction: 'Select "New Request" and choose the leave type and date range.' },
      { stepNumber: 4, instruction: 'Add a comment if necessary and click "Submit for Approval".' },
      { stepNumber: 5, instruction: 'Wait for the automated email notification confirming manager approval.' },
    ],
  },
  {
    title: 'Expense reimbursement policy',
    category: 'Finance',
    content: 'Guidelines for submitting travel and business expense claims.',
    tags: ['expense', 'reimbursement', 'policy'],
    keywords: ['expense claim', 'travel reimbursement', 'receipts', 'accounts payable'],
    difficulty: 'intermediate',
    steps: [
      { stepNumber: 1, instruction: 'Download the latest Expense Reimbursement Form from the Finance shared drive.' },
      { stepNumber: 2, instruction: 'Attach original digital receipts for all items over $25.00.' },
      { stepNumber: 3, instruction: 'Categorize expenses (Travel, Meals, Supplies) as per the policy manual.' },
      { stepNumber: 4, instruction: 'Obtain digital approval signature from your direct supervisor.' },
      { stepNumber: 5, instruction: 'Email the completed form and receipts to accounts-payable@vdartinc.com.' },
    ],
  },
  {
    title: 'Office security protocol',
    category: 'Admin',
    content: 'Mandatory security practices for all on-site employees.',
    tags: ['security', 'badge', 'office'],
    keywords: ['badge access', 'tailgating', 'workstation lock', 'fire exit', 'visitor policy'],
    difficulty: 'beginner',
    steps: [
      { stepNumber: 1, instruction: 'Always wear your company ID badge visibly while in the building.' },
      { stepNumber: 2, instruction: 'Do not allow tailgating — ensure every person swipes their own badge.' },
      { stepNumber: 3, instruction: 'Report any unauthorized visitors to the front desk immediately.' },
      { stepNumber: 4, instruction: 'Lock your computer workstation whenever you step away (Win + L).' },
      { stepNumber: 5, instruction: 'Follow the designated fire exit routes during emergency drills.' },
    ],
  },
  {
    title: 'Booking a conference room',
    category: 'Admin',
    content: 'How to reserve meeting spaces for teams and client presentations.',
    tags: ['meeting', 'calendar', 'room'],
    keywords: ['room booking', 'outlook calendar', 'meeting invite', 'conference room'],
    difficulty: 'beginner',
    steps: [
      { stepNumber: 1, instruction: 'Open your Outlook Calendar and select "New Meeting".' },
      { stepNumber: 2, instruction: 'Click on the "Room Finder" tool on the right-hand side.' },
      { stepNumber: 3, instruction: 'Select a room based on capacity and available equipment (TV, Phone).' },
      { stepNumber: 4, instruction: 'Send the meeting invite to all participants to lock the room.' },
      { stepNumber: 5, instruction: 'Check the tablet outside the room to confirm your booking is active.' },
    ],
  },
  {
    title: 'Marketing brand guidelines',
    category: 'Marketing',
    content: 'Ensuring consistency across all company communications and presentations.',
    tags: ['brand', 'design', 'marketing'],
    keywords: ['brand kit', 'hex colors', 'typography', 'logo usage', 'brand review'],
    difficulty: 'intermediate',
    steps: [
      { stepNumber: 1, instruction: 'Download the Brand Toolkit from the Marketing portal.' },
      { stepNumber: 2, instruction: 'Apply the official hex colors: #0047AB (Blue) and #F2A900 (Gold).' },
      { stepNumber: 3, instruction: 'Use only the "Montserrat" and "Open Sans" font families.' },
      { stepNumber: 4, instruction: 'Ensure the company logo has a minimum clear space of 20 pixels.' },
      { stepNumber: 5, instruction: 'Submit final external designs to brand-review@vdartinc.com for approval.' },
    ],
  },
  {
    title: 'Sales commission structure',
    category: 'Sales',
    content: 'Understanding how your quarterly performance translates to earnings.',
    tags: ['sales', 'commission', 'target'],
    keywords: ['commission tier', 'quota letter', 'crm closed won', 'accelerator', 'dispute form'],
    difficulty: 'intermediate',
    steps: [
      { stepNumber: 1, instruction: 'Review your personalized quota letter for the current fiscal year.' },
      { stepNumber: 2, instruction: 'Track all closed-won deals in the CRM with accurate contract values.' },
      { stepNumber: 3, instruction: 'Achieve at least 80% of your target to trigger the accelerator tier.' },
      { stepNumber: 4, instruction: 'Verify the monthly commission statement sent by the Sales Ops team.' },
      { stepNumber: 5, instruction: 'Submit any discrepancies via the Commission Dispute Form by the 5th.' },
    ],
  },
  {
    title: 'Legal NDAs and contracts',
    category: 'Legal',
    content: 'Procedures for handling non-disclosure agreements and vendor contracts.',
    tags: ['legal', 'contract', 'nda'],
    keywords: ['nda template', 'docusign', 'contract database', 'legal review', 'counterparty'],
    difficulty: 'advanced',
    steps: [
      { stepNumber: 1, instruction: 'Request the standard NDA template from the Legal repository.' },
      { stepNumber: 2, instruction: 'Fill in the counterparty details and the purpose of disclosure.' },
      { stepNumber: 3, instruction: 'Forward the draft to legal-review@vdartinc.com for a 24-hour check.' },
      { stepNumber: 4, instruction: 'Send the approved document for e-signature via DocuSign.' },
      { stepNumber: 5, instruction: 'Store the fully executed copy in the Central Contract Database.' },
    ],
  },
];

const generateSteps = (category, index) => [
  { stepNumber: 1, instruction: `Analyze the ${category} request and clarify the expected outcome with the requester.` },
  { stepNumber: 2, instruction: `Gather all documentation and access credentials required for this ${category} procedure.` },
  { stepNumber: 3, instruction: `Execute the ${category} workflow step-by-step per the established SLA guidelines (Ref: Guide #${index}).` },
  { stepNumber: 4, instruction: `Log every action taken in the central tracking system for audit and compliance purposes.` },
  { stepNumber: 5, instruction: `Follow up with the requester within 24 hours to confirm the ${category} issue is fully resolved.` },
];

const pickRandom = (arr, count) => {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

const randomInRange = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const seedKnowledgeBase = async () => {
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    console.warn('⚠️  Seed aborted: NODE_ENV is "production". Set NODE_ENV=development to run seeds.');
    return;
  }

  try {
    const user = (await User.findOne({ role: 'admin' })) || (await User.findOne());

    if (!user) {
      console.warn('⚠️  No user found in the database. Articles will be seeded without a createdBy reference.');
    }

    const createdBy = user?._id ?? null;

    const articlesWithUser = dummyArticles.map((article) => ({
      ...article,
      createdBy,
      isPublished: true,
      estimatedReadTime: estimateReadTime(article.steps),
      viewCount: randomInRange(10, 200),
      helpfulCount: randomInRange(5, 100),
    }));

    for (let i = 11; i <= 30; i++) {
      const category = categories[Math.floor(Math.random() * categories.length)];
      const availableTags = categoryTagMap[category] ?? categoryTagMap['Other'];
      const steps = generateSteps(category, i);

      articlesWithUser.push({
        title: `Advanced ${category} troubleshooting guide #${i}`,
        category,
        content: `Comprehensive guide for advanced troubleshooting and process optimization within the ${category} department.`,
        tags: pickRandom(availableTags, 3),
        keywords: [category.toLowerCase(), 'troubleshooting', 'advanced', `guide-${i}`],
        difficulty: difficultyLevels[Math.floor(Math.random() * difficultyLevels.length)],
        steps,
        createdBy,
        isPublished: true,
        estimatedReadTime: estimateReadTime(steps),
        viewCount: randomInRange(10, 200),
        helpfulCount: randomInRange(5, 100),
      });
    }

    await KnowledgeBase.deleteMany({});
    await KnowledgeBase.insertMany(articlesWithUser);

    console.log(`✅ Seeded ${articlesWithUser.length} knowledge base articles successfully.`);
  } catch (error) {
    console.error('❌ Error seeding knowledge base:', error);
    throw error;
  }
};

module.exports = seedKnowledgeBase;