import { Schema, model, Document } from 'mongoose';

export interface IDatadogConnection extends Document {
  companyId: string;
  organizationId: string;
  organizationName: string;
  site: string;
  apiKey: {
    encrypted: string;
    iv: string;
    authTag: string;
  };
  applicationKey: {
    encrypted: string;
    iv: string;
    authTag: string;
  };
  connectionType: 'api-key';
  isActive: boolean;
  lastSync: Date;
  syncStatus: 'pending' | 'syncing' | 'completed' | 'failed';
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DatadogConnectionSchema = new Schema<IDatadogConnection>({
  companyId: {
    type: String,
    required: true,
    index: true
  },
  organizationId: {
    type: String,
    required: true,
    index: true
  },
  organizationName: {
    type: String,
    required: true
  },
  site: {
    type: String,
    required: true,
    enum: ['datadoghq.com', 'us3.datadoghq.com', 'us5.datadoghq.com', 'datadoghq.eu', 'ap1.datadoghq.com', 'ddog-gov.com'],
    default: 'datadoghq.com'
  },
  apiKey: {
    encrypted: {
      type: String,
      required: true
    },
    iv: {
      type: String,
      required: true
    },
    authTag: {
      type: String,
      required: true
    }
  },
  applicationKey: {
    encrypted: {
      type: String,
      required: true
    },
    iv: {
      type: String,
      required: true
    },
    authTag: {
      type: String,
      required: true
    }
  },
  connectionType: {
    type: String,
    enum: ['api-key'],
    default: 'api-key'
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  lastSync: {
    type: Date,
    default: Date.now
  },
  syncStatus: {
    type: String,
    enum: ['pending', 'syncing', 'completed', 'failed'],
    default: 'pending'
  },
  errorMessage: {
    type: String
  }
}, {
  timestamps: true
});

// Compound indexes
DatadogConnectionSchema.index({ companyId: 1, organizationId: 1 }, { unique: true });
DatadogConnectionSchema.index({ companyId: 1, isActive: 1 });

export const DatadogConnection = model<IDatadogConnection>('DatadogConnection', DatadogConnectionSchema);
