import { 
  IAMClient, 
  CreateGroupCommand,
  DeleteGroupCommand,
  AttachGroupPolicyCommand,
  DetachGroupPolicyCommand,
  ListPoliciesCommand,
  ListAttachedGroupPoliciesCommand,
  GetGroupCommand,
  UpdateGroupCommand,
  Policy
} from '@aws-sdk/client-iam';
import { AWSAccount, AWSGroup } from '../../../../database/models';
import mongoose from 'mongoose';
import { decrypt } from '../../../../utils/encryption';

export class AWSGroupsService {
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
    
    if (typeof secretAccessKey === 'object' && secretAccessKey !== null && 'encrypted' in secretAccessKey) {
      secretAccessKey = decrypt(secretAccessKey as any);
    }
    
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

  async createGroupInAWS(companyId: string, accountId: string, groupData: {
    groupName: string;
    path?: string;
    policies?: string[];
  }): Promise<any> {
    const iamClient = await this.getIAMClient(accountId, companyId);
    
    try {
      // Create group in AWS
      const createGroupCommand = new CreateGroupCommand({
        GroupName: groupData.groupName,
        Path: groupData.path || '/'
      });

      const result = await iamClient.send(createGroupCommand);
      
      // Attach policies if provided
      if (groupData.policies && groupData.policies.length > 0) {
        for (const policyArn of groupData.policies) {
          try {
            await iamClient.send(new AttachGroupPolicyCommand({
              GroupName: groupData.groupName,
              PolicyArn: policyArn
            }));
          } catch (error) {
            console.error(`Error attaching policy ${policyArn} to group:`, error);
          }
        }
      }

      // Save to database
      const group = await AWSGroup.create({
        groupName: groupData.groupName,
        arn: result.Group?.Arn!,
        path: result.Group?.Path || '/',
        createDate: result.Group?.CreateDate!,
        userCount: 0,
        policies: groupData.policies || [],
        accountId,
        accountName: 'AWS Account', // You might want to fetch this
        companyId: new mongoose.Types.ObjectId(companyId),
        region: 'global',
        lastSync: new Date(),
        isActive: true
      });

      return {
        id: group._id.toString(),
        groupName: group.groupName,
        arn: group.arn,
        policies: group.policies,
        createDate: group.createDate
      };
    } catch (error) {
      console.error('Error creating group in AWS:', error);
      throw error;
    }
  }

  async updateGroupInAWS(companyId: string, groupId: string, updateData: {
    newGroupName?: string;
    policies?: string[];
  }): Promise<any> {
    // Find group in database
    const group = await AWSGroup.findById(groupId);
    if (!group) {
      throw new Error('Group not found');
    }

    const iamClient = await this.getIAMClient(group.accountId, companyId);
    
    try {
      // Update group name if provided
      if (updateData.newGroupName && updateData.newGroupName !== group.groupName) {
        const updateGroupCommand = new UpdateGroupCommand({
          GroupName: group.groupName,
          NewGroupName: updateData.newGroupName
        });
        await iamClient.send(updateGroupCommand);
      }

      // Update policies if provided
      if (updateData.policies) {
        const currentGroupName = updateData.newGroupName || group.groupName;
        
        // Get current attached policies
        const attachedPoliciesResponse = await iamClient.send(new ListAttachedGroupPoliciesCommand({
          GroupName: currentGroupName
        }));
        
        const currentPolicies = attachedPoliciesResponse.AttachedPolicies?.map(p => p.PolicyArn!) || [];
        
        // Detach policies that are not in the new list
        for (const policyArn of currentPolicies) {
          if (!updateData.policies.includes(policyArn)) {
            await iamClient.send(new DetachGroupPolicyCommand({
              GroupName: currentGroupName,
              PolicyArn: policyArn
            }));
          }
        }
        
        // Attach new policies
        for (const policyArn of updateData.policies) {
          if (!currentPolicies.includes(policyArn)) {
            await iamClient.send(new AttachGroupPolicyCommand({
              GroupName: currentGroupName,
              PolicyArn: policyArn
            }));
          }
        }
      }

      // Update database
      const updatedGroup = await AWSGroup.findByIdAndUpdate(
        groupId,
        {
          groupName: updateData.newGroupName || group.groupName,
          policies: updateData.policies || group.policies,
          lastSync: new Date()
        },
        { new: true }
      );

      return {
        id: updatedGroup?._id.toString(),
        groupName: updatedGroup?.groupName,
        policies: updatedGroup?.policies || []
      };
    } catch (error) {
      console.error('Error updating group in AWS:', error);
      throw error;
    }
  }

  async deleteGroupFromAWS(companyId: string, groupId: string): Promise<void> {
    // Find group in database
    const group = await AWSGroup.findById(groupId);
    if (!group) {
      throw new Error('Group not found');
    }

    const iamClient = await this.getIAMClient(group.accountId, companyId);
    
    try {
      // First, detach all policies
      const attachedPoliciesResponse = await iamClient.send(new ListAttachedGroupPoliciesCommand({
        GroupName: group.groupName
      }));
      
      if (attachedPoliciesResponse.AttachedPolicies) {
        for (const policy of attachedPoliciesResponse.AttachedPolicies) {
          await iamClient.send(new DetachGroupPolicyCommand({
            GroupName: group.groupName,
            PolicyArn: policy.PolicyArn!
          }));
        }
      }
      
      // Delete the group
      const deleteGroupCommand = new DeleteGroupCommand({
        GroupName: group.groupName
      });
      await iamClient.send(deleteGroupCommand);
      
      // Mark as inactive in database
      await AWSGroup.findByIdAndUpdate(groupId, { isActive: false });
    } catch (error) {
      console.error('Error deleting group from AWS:', error);
      throw error;
    }
  }

  async getAvailablePolicies(companyId: string, accountId: string): Promise<any[]> {
    const iamClient = await this.getIAMClient(accountId, companyId);
    
    try {
      const policies: Policy[] = [];
      let awsMarker: string | undefined;
      
      // Get AWS managed policies
      do {
        const listPoliciesCommand = new ListPoliciesCommand({
          Scope: 'AWS',
          MaxItems: 100,
          Marker: awsMarker
        });
        
        const response = await iamClient.send(listPoliciesCommand);
        if (response.Policies) {
          policies.push(...response.Policies);
        }
        awsMarker = response.Marker;
      } while (awsMarker);
      
      // Get customer managed policies
      let localMarker: string | undefined;
      do {
        const listLocalPoliciesCommand = new ListPoliciesCommand({
          Scope: 'Local',
          MaxItems: 100,
          Marker: localMarker
        });
        
        const localResponse = await iamClient.send(listLocalPoliciesCommand);
        if (localResponse.Policies) {
          policies.push(...localResponse.Policies);
        }
        localMarker = localResponse.Marker;
      } while (localMarker);
      
      // Return formatted policies
      return policies.map(policy => ({
        arn: policy.Arn,
        name: policy.PolicyName,
        description: policy.Description,
        isAWSManaged: policy.Arn?.includes(':aws:policy/'),
        createDate: policy.CreateDate,
        updateDate: policy.UpdateDate
      }));
    } catch (error) {
      console.error('Error fetching available policies:', error);
      throw error;
    }
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
      policies: group.policies,
      createDate: group.createDate,
      accountId: group.accountId,
      accountName: group.accountName
    }));
  }
}
