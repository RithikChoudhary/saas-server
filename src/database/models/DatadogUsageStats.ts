import { Schema, model, Document } from 'mongoose';

export interface IDatadogUsageStats extends Document {
  companyId: string;
  connectionId: string;
  datadogUserId?: string;
  datadogTeamId?: string;
  date: Date;
  period: 'daily' | 'weekly' | 'monthly';
  metrics: {
    logsIngested?: number;
    metricsIngested?: number;
    tracesIngested?: number;
    syntheticTestRuns?: number;
    rumSessions?: number;
    incidentManagementEvents?: number;
    dashboardViews?: number;
    monitorAlerts?: number;
    apiCalls?: number;
  };
  costs?: {
    logs?: number;
    metrics?: number;
    traces?: number;
    synthetic?: number;
    rum?: number;
    total?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const DatadogUsageStatsSchema = new Schema<IDatadogUsageStats>({
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
    index: true
  },
  datadogTeamId: {
    type: String,
    index: true
  },
  date: {
    type: Date,
    required: true,
    index: true
  },
  period: {
    type: String,
    enum: ['daily', 'weekly', 'monthly'],
    required: true,
    index: true
  },
  metrics: {
    logsIngested: {
      type: Number,
      default: 0
    },
    metricsIngested: {
      type: Number,
      default: 0
    },
    tracesIngested: {
      type: Number,
      default: 0
    },
    syntheticTestRuns: {
      type: Number,
      default: 0
    },
    rumSessions: {
      type: Number,
      default: 0
    },
    incidentManagementEvents: {
      type: Number,
      default: 0
    },
    dashboardViews: {
      type: Number,
      default: 0
    },
    monitorAlerts: {
      type: Number,
      default: 0
    },
    apiCalls: {
      type: Number,
      default: 0
    }
  },
  costs: {
    logs: {
      type: Number,
      default: 0
    },
    metrics: {
      type: Number,
      default: 0
    },
    traces: {
      type: Number,
      default: 0
    },
    synthetic: {
      type: Number,
      default: 0
    },
    rum: {
      type: Number,
      default: 0
    },
    total: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

// Compound indexes
DatadogUsageStatsSchema.index({ companyId: 1, date: 1, period: 1 });
DatadogUsageStatsSchema.index({ companyId: 1, datadogUserId: 1, date: 1 });
DatadogUsageStatsSchema.index({ companyId: 1, datadogTeamId: 1, date: 1 });
DatadogUsageStatsSchema.index({ connectionId: 1, date: 1, period: 1 });

export const DatadogUsageStats = model<IDatadogUsageStats>('DatadogUsageStats', DatadogUsageStatsSchema);
