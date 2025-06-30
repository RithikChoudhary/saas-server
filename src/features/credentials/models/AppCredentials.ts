import mongoose, { Schema, Document } from 'mongoose';

export interface IAppCredentials extends Document {
  companyId: mongoose.Types.ObjectId;
  appType: string;
  appName: string;
  credentials: { [key: string]: string };
  isActive: boolean;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AppCredentialsSchema = new Schema<IAppCredentials>({
  companyId: {
    type: Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  appType: {
    type: String,
    required: true,
    enum: ['slack', 'zoom', 'google-workspace', 'github', 'aws', 'azure', 'office365'],
    index: true
  },
  appName: {
    type: String,
    required: true,
    trim: true
  },
  credentials: {
    type: Schema.Types.Mixed,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
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

// Compound index for unique app credentials per company
AppCredentialsSchema.index({ companyId: 1, appType: 1, appName: 1 }, { unique: true });

// Index for efficient queries
AppCredentialsSchema.index({ companyId: 1, isActive: 1 });
AppCredentialsSchema.index({ appType: 1, isActive: 1 });

export const AppCredentials = mongoose.model<IAppCredentials>('AppCredentials', AppCredentialsSchema);
