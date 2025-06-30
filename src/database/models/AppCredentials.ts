import mongoose, { Schema, Document } from 'mongoose';

export interface IAppCredentials extends Document {
  companyId: mongoose.Types.ObjectId;
  appType: 'slack' | 'zoom' | 'google-workspace' | 'github' | 'aws' | 'azure' | 'office365';
  appName: string;
  credentials: {
    clientId?: string;
    clientSecret?: string;
    redirectUri?: string;
    accessKey?: string;
    secretKey?: string;
    region?: string;
    tenantId?: string;
    [key: string]: any;
  };
  isActive: boolean;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AppCredentialsSchema: Schema = new Schema({
  companyId: {
    type: Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  appType: {
    type: String,
    enum: ['slack', 'zoom', 'google-workspace', 'github', 'aws', 'azure', 'office365'],
    required: true
  },
  appName: {
    type: String,
    required: true
  },
  credentials: {
    type: Schema.Types.Mixed,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true,
  collection: 'app_credentials'
});

// Indexes
AppCredentialsSchema.index({ companyId: 1, appType: 1 });
AppCredentialsSchema.index({ companyId: 1, isActive: 1 });

export const AppCredentials = mongoose.model<IAppCredentials>('AppCredentials', AppCredentialsSchema);
