import { IAMClient, GetUserCommand, ListUsersCommand } from '@aws-sdk/client-iam';
import { BaseIntegration, IntegrationConfig, ConnectionResult, UserData } from '../base/BaseIntegration';

export class AWSIntegration extends BaseIntegration {
  config: IntegrationConfig = {
    name: 'AWS',
    category: 'development',
    description: 'Comprehensive cloud computing platform with computing power, database storage, and content delivery.',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/9/93/Amazon_Web_Services_Logo.svg',
    website: 'https://aws.amazon.com',
    features: ['EC2 Compute', 'S3 Storage', 'RDS Database', 'Lambda Functions', 'CloudFormation'],
    integrations: ['SSO', 'SAML', 'API', 'IAM'],
    pricing: {
      model: 'pay_as_you_go',
      tiers: [
        { name: 'Free Tier', price: 0, features: ['12 months free', 'Limited usage'] },
        { name: 'On-Demand', price: 50, features: ['Pay per hour', 'No commitments'] },
        { name: 'Reserved', price: 200, features: ['1-3 year terms', 'Up to 75% savings'] }
      ]
    },
    credentials: {
      fields: [
        {
          name: 'accessKeyId',
          label: 'Access Key ID',
          type: 'text',
          placeholder: 'AKIAIOSFODNN7EXAMPLE',
          required: true,
          description: 'Your AWS access key ID'
        },
        {
          name: 'secretAccessKey',
          label: 'Secret Access Key',
          type: 'password',
          placeholder: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
          required: true,
          description: 'Your AWS secret access key'
        },
        {
          name: 'region',
          label: 'Region',
          type: 'text',
          placeholder: 'us-east-1',
          required: false,
          description: 'AWS region (optional, defaults to us-east-1)'
        }
      ],
      permissions: [
        'iam:ListUsers',
        'iam:GetUser',
        'iam:CreateUser',
        'iam:UpdateUser',
        'iam:DeleteUser'
      ],
      setupSteps: [
        '1. Go to AWS IAM Console',
        '2. Create a new IAM user for integration',
        '3. Attach the required IAM policies',
        '4. Generate access keys for the user',
        '5. Copy the Access Key ID and Secret Access Key'
      ]
    }
  };

  async testConnection(credentials: Record<string, string>): Promise<ConnectionResult> {
    try {
      console.log('🔗 Testing AWS connection...');
      
      // Create IAM client with credentials
      const iam = new IAMClient({
        region: credentials.region || 'us-east-1',
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey
        }
      });

      // Test connection by getting current user
      const command = new GetUserCommand({});
      const result = await iam.send(command);
      
      console.log('✅ AWS connected successfully');
      return {
        success: true,
        message: 'Successfully connected to AWS',
        data: {
          user: result.User,
          region: credentials.region || 'us-east-1'
        }
      };
    } catch (error: any) {
      console.error('❌ AWS connection failed:', error.message);
      return {
        success: false,
        error: `AWS connection failed: ${error.message}`
      };
    }
  }

  async getUsers(credentials: Record<string, string>): Promise<UserData[]> {
    try {
      console.log('👥 Fetching AWS IAM users...');
      
      // Create IAM client with credentials
      const iam = new IAMClient({
        region: credentials.region || 'us-east-1',
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey
        }
      });

      // List all IAM users
      const command = new ListUsersCommand({});
      const result = await iam.send(command);
      
      const users = result.Users?.map((user: any) => {
        // Check if UserName is already an email, otherwise create one
        let email = user.UserName;
        if (!email.includes('@')) {
          email = `${user.UserName}@aws.com`;
        }
        
        return {
          id: user.UserId,
          email: email,
          firstName: user.UserName.split('@')[0] || user.UserName,
          lastName: 'User',
          name: user.UserName,
          isActive: true, // AWS IAM users don't have active/inactive status
          role: 'IAM User',
          department: 'AWS',
          externalId: user.UserId
        };
      }) || [];

      console.log(`✅ Found ${users.length} AWS IAM users`);
      return users;
      
    } catch (error: any) {
      console.error('❌ Failed to fetch AWS users:', error.message);
      throw new Error(`Failed to fetch AWS users: ${error.message}`);
    }
  }
}
