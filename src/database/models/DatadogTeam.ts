import { Schema, model, Document } from 'mongoose';

export interface IDatadogTeam extends Document {
  companyId: string;
  connectionId: string;
  datadogTeamId: string;
  name: string;
  handle: string;
  description?: string;
  avatar?: string;
  banner?: string;
  hiddenModules: string[];
  linkCount: number;
  userCount: number;
  summary?: {
    dashboards?: number;
    monitors?: number;
    slos?: number;
  };
  createdAt: Date;
  updatedAt: Date;
  // Google Workspace correlation
  googleWorkspaceGroupId?: string;
  correlationStatus: 'matched' | 'unmatched' | 'conflict';
  correlationScore?: number;
}

const DatadogTeamSchema = new Schema<IDatadogTeam>({
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
  datadogTeamId: {
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
  description: {
    type: String
  },
  avatar: {
    type: String
  },
  banner: {
    type: String
  },
  hiddenModules: [{
    type: String
  }],
  linkCount: {
    type: Number,
    default: 0
  },
  userCount: {
    type: Number,
    default: 0
  },
  summary: {
    dashboards: {
      type: Number,
      default: 0
    },
    monitors: {
      type: Number,
      default: 0
    },
    slos: {
      type: Number,
      default: 0
    }
  },
  // Google Workspace correlation fields
  googleWorkspaceGroupId: {
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
DatadogTeamSchema.index({ companyId: 1, datadogTeamId: 1 }, { unique: true });
DatadogTeamSchema.index({ companyId: 1, name: 1 });
DatadogTeamSchema.index({ companyId: 1, correlationStatus: 1 });
DatadogTeamSchema.index({ connectionId: 1, datadogTeamId: 1 });

export const DatadogTeam = model<IDatadogTeam>('DatadogTeam', DatadogTeamSchema);
