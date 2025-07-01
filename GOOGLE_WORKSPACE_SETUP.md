# Google Workspace Service Account Setup Guide

## Prerequisites
1. Google Workspace Admin access
2. Google Cloud Project with Admin SDK API enabled
3. Service Account with domain-wide delegation

## Step-by-Step Setup

### 1. Create Service Account in Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project or create a new one
3. Navigate to **IAM & Admin** > **Service Accounts**
4. Click **Create Service Account**
5. Fill in:
   - Service account name: `saas-management-platform`
   - Service account ID: (auto-generated)
   - Description: `Service account for SaaS Management Platform`
6. Click **Create and Continue**
7. Skip the optional steps and click **Done**

### 2. Enable Domain-Wide Delegation

1. Click on the created service account
2. Go to the **Details** tab
3. Under **Domain-wide delegation**, click **Show domain-wide delegation**
4. Click **Enable domain-wide delegation**
5. Enter a product name for the consent screen (e.g., "SaaS Management Platform")
6. Click **Save**
7. Note down the **Client ID** (you'll need this for the next step)

### 3. Download Service Account Key

1. In the service account details, go to **Keys** tab
2. Click **Add Key** > **Create new key**
3. Select **JSON** format
4. Click **Create**
5. Save the downloaded JSON file securely

### 4. Configure Domain-Wide Delegation in Google Workspace

1. Go to [Google Admin Console](https://admin.google.com)
2. Navigate to **Security** > **API Controls** > **Domain-wide delegation**
3. Click **Add new**
4. Enter:
   - **Client ID**: The Client ID from step 2.7
   - **OAuth Scopes**: Add these scopes (one per line):
     ```
     https://www.googleapis.com/auth/admin.directory.user.readonly
     https://www.googleapis.com/auth/admin.directory.group.readonly
     https://www.googleapis.com/auth/admin.directory.orgunit.readonly
     https://www.googleapis.com/auth/admin.directory.customer.readonly
     ```
5. Click **Authorize**

### 5. Enable Required APIs

In Google Cloud Console:
1. Go to **APIs & Services** > **Library**
2. Search and enable these APIs:
   - Admin SDK API
   - Google Workspace Admin SDK

### 6. Configure in SaaS Management Platform

1. In the platform, go to **Credentials** > **Google Workspace**
2. Upload the service account JSON file
3. Enter the admin email (must be a super admin): `admin@yourdomain.com`
4. Test the connection

## Common Issues and Solutions

### Error: "unauthorized_client"
**Cause**: Domain-wide delegation not properly configured
**Solution**: 
- Ensure you've completed step 4 correctly
- Wait 5-10 minutes for changes to propagate
- Verify the Client ID matches exactly

### Error: "403 Forbidden"
**Cause**: Insufficient permissions or wrong admin email
**Solution**:
- Ensure the admin email is a super admin
- Check that all required scopes are authorized
- Verify APIs are enabled in Google Cloud Console

### Error: "Invalid grant"
**Cause**: Service account key issues
**Solution**:
- Generate a new service account key
- Ensure the JSON file is not corrupted
- Check that the service account is active

## Testing the Setup

Run this command to test the sync:
```bash
cd saas-management-platform/backend
npm run sync
```

## Security Best Practices

1. **Limit Scopes**: Only grant the minimum required scopes
2. **Rotate Keys**: Regularly rotate service account keys
3. **Monitor Usage**: Check API usage in Google Cloud Console
4. **Audit Logs**: Review admin audit logs for API access

## Troubleshooting Checklist

- [ ] Service account created in Google Cloud Console
- [ ] Domain-wide delegation enabled on service account
- [ ] Client ID noted from service account
- [ ] Domain-wide delegation authorized in Google Admin Console
- [ ] All required scopes added
- [ ] Admin SDK API enabled in Google Cloud Console
- [ ] Service account key downloaded (JSON format)
- [ ] Admin email is a super admin account
- [ ] Waited 5-10 minutes for propagation

## Additional Resources

- [Google Workspace Admin SDK Documentation](https://developers.google.com/admin-sdk)
- [Domain-wide Delegation Guide](https://developers.google.com/admin-sdk/directory/v1/guides/delegation)
- [Service Account Best Practices](https://cloud.google.com/iam/docs/best-practices-for-using-service-accounts)
