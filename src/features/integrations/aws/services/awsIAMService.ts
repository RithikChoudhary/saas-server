import { 
  IAMClient, 
  ListUsersCommand, 
  ListGroupsCommand, 
  CreateUserCommand, 
  DeleteUserCommand, 
  GetUserCommand, 
  ListGroupsForUserCommand, 
  ListAttachedUserPoliciesCommand, 
  ListAttachedGroupPoliciesCommand,
  ListAccessKeysCommand, 
  ListMFADevicesCommand,
  GetGroupCommand,
  AddUserToGroupCommand,
  RemoveUserFromGroupCommand,
  UpdateUserCommand
} from '@aws-sdk/client-iam';
import { AWSAccount, AWSUser, AWSGroup } from '../../../../database/models';
import mongoose from 'mongoose';
import { decrypt } from '../../../../utils/encryption';

export class AWSIAMService {
  private async getIAMClient(accountId: string, companyId: string): Promise<IAMClient> {
    const account = await AWSAccount.findOne({
      accountId,
      companyId: new mongoose.Types.ObjectId(companyId),
      status: 'connected',
      isActive: true
    });

    if (!account) {
      throw new Error(`AWS account ${accountId} not found or not connected`);
    }

    // Decrypt credentials if they are encrypted
    let secretAccessKey = account.credentials.secretAccessKey;
    let sessionToken = account.credentials.sessionToken;
    
    // Check if secretAccessKey is encrypted (object with encrypted, iv, authTag)
    if (typeof secretAccessKey === 'object' && secretAccessKey !== null && 'encrypted' in secretAccessKey) {
      secretAccessKey = decrypt(secretAccessKey as any);
    }
    
    // Check if sessionToken is encrypted
    if (typeof sessionToken === 'object' && sessionToken !== null && 'encrypted' in sessionToken) {
      sessionToken = decrypt(sessionToken as any);
    }

    return new IAMClient({
      region: account.region,
      credentials: {
        accessKeyId: account.credentials.accessKeyId!,
        secretAccessKey: secretAccessKey as string,
        ...(sessionToken && { sessionToken: sessionToken as string })
      }
    });
  }

  async syncUsersFromAWS(companyId: string): Promise<{ syncedUsers: number; syncedGroups: number }> {
    console.log('🔄 Starting AWS IAM sync for company:', companyId);
    
    // Get all connected AWS accounts for this company
    const awsAccounts = await AWSAccount.find({
      companyId: new mongoose.Types.ObjectId(companyId),
      status: 'connected',
      isActive: true
    });

    console.log(`📊 Found ${awsAccounts.length} connected AWS accounts`);

    if (awsAccounts.length === 0) {
      console.log('❌ No connected AWS accounts found');
      throw new Error('No connected AWS accounts found');
    }

    let totalSyncedUsers = 0;
    let totalSyncedGroups = 0;

    for (const account of awsAccounts) {
      try {
        console.log(`🔄 Syncing account: ${account.accountName} (${account.accountId})`);
        console.log(`🔑 Using credentials: AccessKeyId=${account.credentials.accessKeyId?.substring(0, 8)}..., Region=${account.region}`);
        
        // Decrypt credentials if they are encrypted
        let secretAccessKey = account.credentials.secretAccessKey;
        let sessionToken = account.credentials.sessionToken;
        
        // Check if secretAccessKey is encrypted (object with encrypted, iv, authTag)
        if (typeof secretAccessKey === 'object' && secretAccessKey !== null && 'encrypted' in secretAccessKey) {
          secretAccessKey = decrypt(secretAccessKey as any);
        }
        
        // Check if sessionToken is encrypted
        if (typeof sessionToken === 'object' && sessionToken !== null && 'encrypted' in sessionToken) {
          sessionToken = decrypt(sessionToken as any);
        }

        const iamClient = new IAMClient({
          region: account.region,
          credentials: {
            accessKeyId: account.credentials.accessKeyId!,
            secretAccessKey: secretAccessKey as string,
            ...(sessionToken && { sessionToken: sessionToken as string })
          }
        });

        // Test AWS connection first
        console.log('🧪 Testing AWS IAM connection...');
        
        // Sync Users
        const usersResult = await this.syncUsersForAccount(iamClient, account, companyId);
        totalSyncedUsers += usersResult;

        // Sync Groups
        const groupsResult = await this.syncGroupsForAccount(iamClient, account, companyId);
        totalSyncedGroups += groupsResult;

        console.log(`✅ Account ${account.accountName}: ${usersResult} users, ${groupsResult} groups synced`);
      } catch (error) {
        console.error(`❌ Error syncing account ${account.accountName}:`, error);
        console.error('❌ Full error details:', JSON.stringify(error, null, 2));
        // Continue with other accounts even if one fails
      }
    }

    console.log(`✅ Total sync completed: ${totalSyncedUsers} users, ${totalSyncedGroups} groups`);
    return { syncedUsers: totalSyncedUsers, syncedGroups: totalSyncedGroups };
  }

  private async syncUsersForAccount(iamClient: IAMClient, account: any, companyId: string): Promise<number> {
    console.log('👥 Fetching users from AWS IAM...');
    
    const listUsersCommand = new ListUsersCommand({});
    const usersResponse = await iamClient.send(listUsersCommand);
    
    console.log(`📊 AWS IAM returned ${usersResponse.Users?.length || 0} users`);
    
    if (!usersResponse.Users || usersResponse.Users.length === 0) {
      console.log('ℹ️ No users found in AWS IAM for this account');
      return 0;
    }

    let syncedCount = 0;

    for (const awsUser of usersResponse.Users) {
      try {
        // Get additional user details
        const [groupsResponse, policiesResponse, accessKeysResponse, mfaResponse] = await Promise.all([
          iamClient.send(new ListGroupsForUserCommand({ UserName: awsUser.UserName })),
          iamClient.send(new ListAttachedUserPoliciesCommand({ UserName: awsUser.UserName })),
          iamClient.send(new ListAccessKeysCommand({ UserName: awsUser.UserName })),
          iamClient.send(new ListMFADevicesCommand({ UserName: awsUser.UserName }))
        ]);

        const groups = groupsResponse.Groups?.map(g => g.GroupName || '') || [];
        const policies = policiesResponse.AttachedPolicies?.map(p => p.PolicyName || '') || [];
        const accessKeyCount = accessKeysResponse.AccessKeyMetadata?.length || 0;
        const mfaEnabled = (mfaResponse.MFADevices?.length || 0) > 0;

        // Extract email from tags if available
        let email: string | undefined;
        if (awsUser.Tags) {
          const emailTag = awsUser.Tags.find(tag => tag.Key?.toLowerCase() === 'email');
          email = emailTag?.Value;
        }

        // Determine user status based on last activity and access keys
        let status: 'active' | 'inactive' | 'locked' = 'active';
        if (accessKeyCount === 0 && !awsUser.PasswordLastUsed) {
          status = 'inactive';
        }

        // Upsert user in database
        await AWSUser.findOneAndUpdate(
          {
            userName: awsUser.UserName,
            accountId: account.accountId,
            companyId: new mongoose.Types.ObjectId(companyId)
          },
          {
            userName: awsUser.UserName!,
            arn: awsUser.Arn!,
            email,
            createDate: awsUser.CreateDate!,
            lastActivity: awsUser.PasswordLastUsed,
            status,
            groups,
            policies,
            accessKeys: accessKeyCount,
            mfaEnabled,
            accountId: account.accountId,
            accountName: account.accountName,
            companyId: new mongoose.Types.ObjectId(companyId),
            region: account.region,
            lastSync: new Date(),
            isActive: true
          },
          { upsert: true, new: true }
        );

        syncedCount++;
      } catch (error) {
        console.error(`❌ Error syncing user ${awsUser.UserName}:`, error);
      }
    }

    return syncedCount;
  }

  private async syncGroupsForAccount(iamClient: IAMClient, account: any, companyId: string): Promise<number> {
    console.log('👥 Fetching groups from AWS IAM...');
    
    const listGroupsCommand = new ListGroupsCommand({});
    const groupsResponse = await iamClient.send(listGroupsCommand);
    
    console.log(`📊 AWS IAM returned ${groupsResponse.Groups?.length || 0} groups`);
    
    if (!groupsResponse.Groups || groupsResponse.Groups.length === 0) {
      console.log('ℹ️ No groups found in AWS IAM for this account');
      return 0;
    }

    let syncedCount = 0;

    for (const awsGroup of groupsResponse.Groups) {
      try {
        // Get group policies using the correct command
        const policiesResponse = await iamClient.send(new ListAttachedGroupPoliciesCommand({ 
          GroupName: awsGroup.GroupName 
        }));
        const policies = policiesResponse.AttachedPolicies?.map(p => p.PolicyName || '') || [];

        // Count users in group (we'll update this during user sync)
        const userCount = await AWSUser.countDocuments({
          companyId: new mongoose.Types.ObjectId(companyId),
          accountId: account.accountId,
          groups: awsGroup.GroupName,
          isActive: true
        });

        // Upsert group in database
        await AWSGroup.findOneAndUpdate(
          {
            groupName: awsGroup.GroupName,
            accountId: account.accountId,
            companyId: new mongoose.Types.ObjectId(companyId)
          },
          {
            groupName: awsGroup.GroupName!,
            arn: awsGroup.Arn!,
            path: awsGroup.Path || '/',
            createDate: awsGroup.CreateDate!,
            userCount,
            policies,
            accountId: account.accountId,
            accountName: account.accountName,
            companyId: new mongoose.Types.ObjectId(companyId),
            region: account.region,
            lastSync: new Date(),
            isActive: true
          },
          { upsert: true, new: true }
        );

        syncedCount++;
        console.log(`✅ Synced group: ${awsGroup.GroupName}`);
      } catch (error) {
        console.error(`❌ Error syncing group ${awsGroup.GroupName}:`, error);
      }
    }

    return syncedCount;
  }

  async getUsersFromDatabase(companyId: string, accountId?: string): Promise<any[]> {
    const query: any = {
      companyId: new mongoose.Types.ObjectId(companyId),
      isActive: true
    };

    if (accountId) {
      query.accountId = accountId;
    }

    const users = await AWSUser.find(query).sort({ userName: 1 });
    
    return users.map(user => ({
      id: user._id.toString(),
      userName: user.userName,
      email: user.email,
      arn: user.arn,
      createDate: user.createDate.toISOString(),
      lastActivity: user.lastActivity?.toISOString(),
      status: user.status,
      groups: user.groups,
      policies: user.policies,
      accessKeys: user.accessKeys,
      mfaEnabled: user.mfaEnabled,
      accountId: user.accountId,
      accountName: user.accountName
    }));
  }

  async getGroupsFromDatabase(companyId: string, accountId?: string): Promise<any[]> {
    const query: any = {
      companyId: new mongoose.Types.ObjectId(companyId),
      isActive: true
    };

    if (accountId) {
      query.accountId = accountId;
    }

    const groups = await AWSGroup.find(query).sort({ groupName: 1 });
    
    return groups.map(group => ({
      id: group._id.toString(),
      groupName: group.groupName,
      arn: group.arn,
      userCount: group.userCount,
      policies: group.policies
    }));
  }

  async createUserInAWS(companyId: string, accountId: string, userData: { userName: string; email?: string; groups?: string[] }): Promise<any> {
    const iamClient = await this.getIAMClient(accountId, companyId);
    
    // Create user in AWS
    const createUserCommand = new CreateUserCommand({
      UserName: userData.userName,
      Tags: userData.email ? [{ Key: 'Email', Value: userData.email }] : undefined
    });

    const result = await iamClient.send(createUserCommand);
    
    // Add user to groups if specified
    if (userData.groups && userData.groups.length > 0) {
      // TODO: Add user to groups using AddUserToGroupCommand
    }

    // Sync the new user to database
    await this.syncUsersFromAWS(companyId);

    return {
      id: result.User?.Arn,
      userName: result.User?.UserName,
      arn: result.User?.Arn,
      createDate: result.User?.CreateDate?.toISOString(),
      status: 'active',
      groups: userData.groups || [],
      policies: [],
      accessKeys: 0,
      mfaEnabled: false,
      accountId,
      accountName: 'development' // TODO: Get from account
    };
  }

  async updateUserInAWS(companyId: string, userId: string, updateData: { 
    newUserName?: string; 
    groups?: string[] 
  }): Promise<any> {
    // Find user in database
    const user = await AWSUser.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const iamClient = await this.getIAMClient(user.accountId, companyId);
    
    // Update username if provided
    if (updateData.newUserName && updateData.newUserName !== user.userName) {
      const updateUserCommand = new UpdateUserCommand({
        UserName: user.userName,
        NewUserName: updateData.newUserName
      });
      await iamClient.send(updateUserCommand);
    }

    // Update groups if provided
    if (updateData.groups) {
      // Get current groups
      const currentGroupsResponse = await iamClient.send(new ListGroupsForUserCommand({ 
        UserName: updateData.newUserName || user.userName 
      }));
      const currentGroups = currentGroupsResponse.Groups?.map(g => g.GroupName || '') || [];
      
      // Remove from groups not in the new list
      for (const group of currentGroups) {
        if (!updateData.groups.includes(group)) {
          await iamClient.send(new RemoveUserFromGroupCommand({
            GroupName: group,
            UserName: updateData.newUserName || user.userName
          }));
        }
      }
      
      // Add to new groups
      for (const group of updateData.groups) {
        if (!currentGroups.includes(group)) {
          await iamClient.send(new AddUserToGroupCommand({
            GroupName: group,
            UserName: updateData.newUserName || user.userName
          }));
        }
      }
    }

    // Sync the updated user to database
    await this.syncUsersFromAWS(companyId);
    
    // Return updated user
    const updatedUser = await AWSUser.findById(userId);
    return {
      id: updatedUser?._id.toString(),
      userName: updatedUser?.userName,
      groups: updatedUser?.groups || []
    };
  }

  async deleteUserFromAWS(companyId: string, userId: string): Promise<void> {
    // Find user in database
    const user = await AWSUser.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const iamClient = await this.getIAMClient(user.accountId, companyId);
    
    try {
      // First, remove user from all groups
      const groupsResponse = await iamClient.send(new ListGroupsForUserCommand({ 
        UserName: user.userName 
      }));
      
      if (groupsResponse.Groups) {
        for (const group of groupsResponse.Groups) {
          await iamClient.send(new RemoveUserFromGroupCommand({
            GroupName: group.GroupName!,
            UserName: user.userName
          }));
        }
      }
      
      // Delete access keys
      const accessKeysResponse = await iamClient.send(new ListAccessKeysCommand({ 
        UserName: user.userName 
      }));
      
      if (accessKeysResponse.AccessKeyMetadata) {
        for (const key of accessKeysResponse.AccessKeyMetadata) {
          const { DeleteAccessKeyCommand } = await import('@aws-sdk/client-iam');
          await iamClient.send(new DeleteAccessKeyCommand({
            UserName: user.userName,
            AccessKeyId: key.AccessKeyId!
          }));
        }
      }
      
      // Delete MFA devices
      const mfaResponse = await iamClient.send(new ListMFADevicesCommand({ 
        UserName: user.userName 
      }));
      
      if (mfaResponse.MFADevices) {
        for (const device of mfaResponse.MFADevices) {
          const { DeactivateMFADeviceCommand, DeleteVirtualMFADeviceCommand } = await import('@aws-sdk/client-iam');
          await iamClient.send(new DeactivateMFADeviceCommand({
            UserName: user.userName,
            SerialNumber: device.SerialNumber!
          }));
          
          if (device.SerialNumber?.includes(':mfa/')) {
            await iamClient.send(new DeleteVirtualMFADeviceCommand({
              SerialNumber: device.SerialNumber
            }));
          }
        }
      }
      
      // Delete user policies
      const policiesResponse = await iamClient.send(new ListAttachedUserPoliciesCommand({ 
        UserName: user.userName 
      }));
      
      if (policiesResponse.AttachedPolicies) {
        for (const policy of policiesResponse.AttachedPolicies) {
          const { DetachUserPolicyCommand } = await import('@aws-sdk/client-iam');
          await iamClient.send(new DetachUserPolicyCommand({
            UserName: user.userName,
            PolicyArn: policy.PolicyArn!
          }));
        }
      }
      
      // Finally, delete the user
      const deleteUserCommand = new DeleteUserCommand({
        UserName: user.userName
      });
      await iamClient.send(deleteUserCommand);
      
      // Mark user as inactive in database
      await AWSUser.findByIdAndUpdate(userId, { isActive: false });
    } catch (error) {
      console.error('Error deleting user from AWS:', error);
      throw new Error(`Failed to delete user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getUserStats(companyId: string): Promise<any> {
    const stats = await AWSUser.aggregate([
      {
        $match: {
          companyId: new mongoose.Types.ObjectId(companyId),
          isActive: true
        }
      },
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          activeUsers: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          },
          mfaEnabledUsers: {
            $sum: { $cond: ['$mfaEnabled', 1, 0] }
          },
          totalAccessKeys: { $sum: '$accessKeys' }
        }
      }
    ]);

    const groupCount = await AWSGroup.countDocuments({
      companyId: new mongoose.Types.ObjectId(companyId),
      isActive: true
    });

    return {
      totalUsers: stats[0]?.totalUsers || 0,
      activeUsers: stats[0]?.activeUsers || 0,
      mfaEnabledUsers: stats[0]?.mfaEnabledUsers || 0,
      totalGroups: groupCount,
      totalAccessKeys: stats[0]?.totalAccessKeys || 0
    };
  }
}
