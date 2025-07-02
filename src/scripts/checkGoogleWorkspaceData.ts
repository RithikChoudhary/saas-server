import mongoose from 'mongoose';
import { GoogleWorkspaceUser } from '../database/models/GoogleWorkspaceUser';
import { GoogleWorkspaceGroup } from '../database/models/GoogleWorkspaceGroup';
import { GoogleWorkspaceConnection } from '../database/models/GoogleWorkspaceConnection';
import Company from '../database/models/Company';
import connectDB from '../shared/database';

async function checkGoogleWorkspaceData() {
  try {
    console.log('🔍 Connecting to database...');
    await connectDB();
    
    console.log('📊 Checking Google Workspace data...\n');
    
    // Check companies
    const companies = await Company.find({}).lean();
    console.log('🏢 Companies found:', companies.length);
    companies.forEach((company, index) => {
      console.log(`  ${index + 1}. ${company.name} (ID: ${company._id})`);
    });
    
    // Check connections
    const connections = await GoogleWorkspaceConnection.find({}).lean();
    console.log('\n🔗 Google Workspace Connections found:', connections.length);
    connections.forEach((conn, index) => {
      console.log(`  ${index + 1}. ${conn.organizationName} (${conn.domain})`);
      console.log(`     Company ID: ${conn.companyId}`);
      console.log(`     Connection ID: ${conn._id}`);
      console.log(`     Active: ${conn.isActive}`);
      console.log(`     Type: ${conn.connectionType}`);
    });
    
    // Check users
    const users = await GoogleWorkspaceUser.find({}).lean();
    console.log('\n👥 Google Workspace Users found:', users.length);
    
    if (users.length > 0) {
      console.log('Sample users:');
      users.slice(0, 5).forEach((user, index) => {
        console.log(`  ${index + 1}. ${user.fullName} (${user.primaryEmail})`);
        console.log(`     Company ID: ${user.companyId}`);
        console.log(`     Connection ID: ${user.connectionId}`);
        console.log(`     Active: ${user.isActive}`);
      });
      
      // Group by company
      const usersByCompany = users.reduce((acc: any, user) => {
        const companyId = user.companyId.toString();
        acc[companyId] = (acc[companyId] || 0) + 1;
        return acc;
      }, {});
      
      console.log('\nUsers by Company:');
      Object.entries(usersByCompany).forEach(([companyId, count]) => {
        console.log(`  Company ${companyId}: ${count} users`);
      });
    }
    
    // Check groups
    const groups = await GoogleWorkspaceGroup.find({}).lean();
    console.log('\n👥 Google Workspace Groups found:', groups.length);
    
    if (groups.length > 0) {
      console.log('Sample groups:');
      groups.slice(0, 5).forEach((group, index) => {
        console.log(`  ${index + 1}. ${group.name} (${group.email})`);
        console.log(`     Company ID: ${group.companyId}`);
        console.log(`     Connection ID: ${group.connectionId}`);
        console.log(`     Members: ${group.directMembersCount}`);
      });
      
      // Group by company
      const groupsByCompany = groups.reduce((acc: any, group) => {
        const companyId = group.companyId.toString();
        acc[companyId] = (acc[companyId] || 0) + 1;
        return acc;
      }, {});
      
      console.log('\nGroups by Company:');
      Object.entries(groupsByCompany).forEach(([companyId, count]) => {
        console.log(`  Company ${companyId}: ${count} groups`);
      });
    }
    
    console.log('\n✅ Database check completed');
    
  } catch (error) {
    console.error('❌ Error checking database:', error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

checkGoogleWorkspaceData();
