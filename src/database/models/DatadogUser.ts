import { Schema, model, Document } from 'mongoose';

export interface IDatadogUser extends Document {
  companyId: string;
  connectionId: string;
  datadogUserId: string;
  email: string;
  name: string;
  handle: string;
  title?: string;
  verified: boolean;
  disabled: boolean;
  status: 'Active' | 'Pending' | 'Disabled';
  roles: string[];
  teams: string[];
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
  // Google Workspace correlation
  googleWorkspaceUserId?: string;
  correlationStatus: 'matched' | 'unmatched' | 'conflict';
  correlationScore?: number;
}

const DatadogUserSchema = new Schema<IDatadogUser>({
  companyId: {
    type: String,
    required: true,
    index: true
  },
  connectionId: {
    type: String,
    required: true,
    index: true
  },
  datadogUserId: {
    type: String,
    required: true,
    index: true
  },
  email: {
    type: String,
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  handle: {
    type: String,
    required: true
  },
  title: {
    type: String
  },
  verified: {
    type: Boolean,
    default: false
  },
  disabled: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['Active', 'Pending', 'Disabled'],
    default: 'Active'
  },
  roles: [{
    type: String
  }],
  teams: [{
    type: String
  }],
  lastLogin: {
    type: Date
  },
  // Google Workspace correlation fields
  googleWorkspaceUserId: {
    type: String,
    index: true
  },
  correlationStatus: {
    type: String,
    enum: ['matched', 'unmatched', 'conflict'],
    default: 'unmatched',
    index: true
  },
  correlationScore: {
    type: Number,
    min: 0,
    max: 1
  }
}, {
  timestamps: true
});

// Compound indexes
DatadogUserSchema.index({ companyId: 1, datadogUserId: 1 }, { unique: true });
DatadogUserSchema.index({ companyId: 1, email: 1 });
DatadogUserSchema.index({ companyId: 1, status: 1 });
DatadogUserSchema.index({ companyId: 1, correlationStatus: 1 });
DatadogUserSchema.index({ connectionId: 1, datadogUserId: 1 });

export const DatadogUser = model<IDatadogUser>('DatadogUser', DatadogUserSchema);
