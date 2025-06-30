import mongoose, { Schema, Document } from 'mongoose';

export interface IAWSBilling extends Document {
  accountId: string;
  accountName: string;
  billingPeriod: {
    start: Date;
    end: Date;
  };
  totalCost: number;
  currency: string;
  serviceBreakdown: Array<{
    serviceName: string;
    cost: number;
    percentage: number;
    trend: 'up' | 'down' | 'stable';
    usageQuantity?: number;
    unit?: string;
  }>;
  dailyCosts: Array<{
    date: Date;
    cost: number;
    services: Map<string, number>;
  }>;
  budgets: Array<{
    name: string;
    limit: number;
    actual: number;
    percentage: number;
    alertThreshold: number;
  }>;
  forecastedCost: number;
  monthOverMonthChange: number;
  companyId: mongoose.Types.ObjectId;
  lastSync: Date;
  isActive: boolean;
}

const AWSBillingSchema = new Schema<IAWSBilling>({
  accountId: { type: String, required: true },
  accountName: { type: String, required: true },
  billingPeriod: {
    start: { type: Date, required: true },
    end: { type: Date, required: true }
  },
  totalCost: { type: Number, required: true, default: 0 },
  currency: { type: String, default: 'USD' },
  serviceBreakdown: [{
    serviceName: { type: String, required: true },
    cost: { type: Number, required: true },
    percentage: { type: Number, required: true },
    trend: { 
      type: String, 
      enum: ['up', 'down', 'stable'],
      default: 'stable'
    },
    usageQuantity: Number,
    unit: String
  }],
  dailyCosts: [{
    date: { type: Date, required: true },
    cost: { type: Number, required: true },
    services: { type: Map, of: Number, default: new Map() }
  }],
  budgets: [{
    name: { type: String, required: true },
    limit: { type: Number, required: true },
    actual: { type: Number, required: true },
    percentage: { type: Number, required: true },
    alertThreshold: { type: Number, default: 80 }
  }],
  forecastedCost: { type: Number, default: 0 },
  monthOverMonthChange: { type: Number, default: 0 },
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  lastSync: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

// Indexes
AWSBillingSchema.index({ accountId: 1, 'billingPeriod.start': 1, companyId: 1 }, { unique: true });
AWSBillingSchema.index({ companyId: 1, 'billingPeriod.start': -1 });
AWSBillingSchema.index({ accountId: 1, companyId: 1 });

export const AWSBilling = mongoose.model<IAWSBilling>('AWSBilling', AWSBillingSchema);
