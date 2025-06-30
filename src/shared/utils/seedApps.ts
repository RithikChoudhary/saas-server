import { App } from '../../database/models';
import { AppCategory } from '../types';

const essentialPlatforms = [
  // Core Productivity
  { name: 'Office 365', category: AppCategory.PRODUCTIVITY, description: 'Microsoft productivity suite with Word, Excel, PowerPoint, Teams, and cloud services.' },
  { name: 'Google Workspace', category: AppCategory.PRODUCTIVITY, description: 'Complete productivity suite with Gmail, Drive, Docs, Sheets, and Meet.' },
  { name: 'Slack', category: AppCategory.COMMUNICATION, description: 'Team communication platform with channels, direct messaging, and app integrations.' },
  
  // Development Essentials
  { name: 'GitHub', category: AppCategory.DEVELOPMENT, description: 'Git repository hosting with collaboration features, CI/CD, and project management.' },
  { name: 'AWS', category: AppCategory.DEVELOPMENT, description: 'Comprehensive cloud computing platform with computing power, database storage, and content delivery.' },
  { name: 'Jira', category: AppCategory.DEVELOPMENT, description: 'Issue tracking and project management for agile software development teams.' },
  
  // Design & Creative
  { name: 'Figma', category: AppCategory.DESIGN, description: 'Collaborative design tool for UI/UX design, prototyping, and design systems.' },
  { name: 'Adobe Creative Suite', category: AppCategory.DESIGN, description: 'Complete creative suite with Photoshop, Illustrator, InDesign, and more.' },
  
  // Business & Analytics
  { name: 'Salesforce', category: AppCategory.BUSINESS, description: 'Customer relationship management platform with sales, service, and marketing tools.' },
  { name: 'HubSpot', category: AppCategory.MARKETING, description: 'Inbound marketing, sales, and customer service platform.' },
  { name: 'Zoom', category: AppCategory.COMMUNICATION, description: 'Video conferencing and communication platform for remote collaboration.' },
  { name: 'Notion', category: AppCategory.PRODUCTIVITY, description: 'All-in-one workspace for notes, docs, wikis, and project management.' }
];

let isSeeded = false;

export const seedApps = async (): Promise<void> => {
  try {
    // Prevent multiple seeding attempts in the same process
    if (isSeeded) {
      console.log('📱 Apps already seeded in this session');
      return;
    }

    console.log('🌱 Checking apps in database...');
    
    // Check if apps already exist with a more efficient query
    const existingAppsCount = await App.countDocuments().limit(1);
    if (existingAppsCount > 0) {
      console.log(`📱 ${existingAppsCount} apps already exist in database`);
      isSeeded = true;
      return;
    }

    console.log('🌱 Seeding essential apps...');

    // Convert platforms to app format with memory-efficient approach
    const apps = essentialPlatforms.map(platform => ({
      name: platform.name,
      category: platform.category,
      description: platform.description,
      logo: `https://via.placeholder.com/64x64/3B82F6/FFFFFF?text=${platform.name.charAt(0)}`,
      website: `https://${platform.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
      features: ['User Management', 'API Access', 'Integration Support', 'Team Collaboration'],
      integrations: ['API', 'SSO', 'Webhook'],
      pricing: {
        model: 'per_user_monthly',
        tiers: [
          { name: 'Basic', price: 10, features: ['Basic features', 'Email support'] },
          { name: 'Pro', price: 25, features: ['Advanced features', 'Priority support'] },
          { name: 'Enterprise', price: 50, features: ['Enterprise features', 'Dedicated support'] }
        ]
      },
      isActive: true
    }));

    // Insert apps with ordered: false for better performance
    const createdApps = await App.insertMany(apps, { ordered: false });
    console.log(`✅ Successfully seeded ${createdApps.length} essential platforms`);
    isSeeded = true;
    
  } catch (error) {
    console.error('❌ Error seeding apps:', error);
    // Don't throw error to prevent app crash during startup
    console.error('Continuing without seeding...');
  }
};

export default seedApps;
