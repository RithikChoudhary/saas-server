import mongoose, { Schema, Document } from 'mongoose';

export interface IAWSResource extends Document {
  resourceId: string;
  resourceType: 'EC2' | 'S3' | 'RDS' | 'Lambda' | 'VPC' | 'ELB' | 'SecurityGroup' | 'ElasticIP';
  name: string;
  arn?: string;
  state: string;
  region: string;
  accountId: string;
  metadata: {
    // EC2 specific
    instanceType?: string;
    availabilityZone?: string;
    publicIP?: string;
    privateIP?: string;
    platform?: string;
    launchTime?: Date;
    
    // S3 specific
    bucketSize?: number;
    objectCount?: number;
    creationDate?: Date;
    
    // RDS specific
    engine?: string;
    engineVersion?: string;
    dbInstanceClass?: string;
    allocatedStorage?: number;
    
    // Lambda specific
    runtime?: string;
    codeSize?: number;
    timeout?: number;
    memorySize?: number;
    lastModified?: Date;
    invocations24h?: number;
    errors24h?: number;
  };
  tags: Map<string, string>;
  companyId: mongoose.Types.ObjectId;
  lastSync: Date;
  isActive: boolean;
}

const AWSResourceSchema = new Schema<IAWSResource>({
  resourceId: { type: String, required: true },
  resourceType: { 
    type: String, 
    required: true,
    enum: ['EC2', 'S3', 'RDS', 'Lambda', 'VPC', 'ELB', 'SecurityGroup', 'ElasticIP']
  },
  name: { type: String, required: true },
  arn: { type: String },
  state: { type: String, required: true },
  region: { type: String, required: true },
  accountId: { type: String, required: true },
  metadata: {
    instanceType: String,
    availabilityZone: String,
    publicIP: String,
    privateIP: String,
    platform: String,
    launchTime: Date,
    bucketSize: Number,
    objectCount: Number,
    creationDate: Date,
    engine: String,
    engineVersion: String,
    dbInstanceClass: String,
    allocatedStorage: Number,
    runtime: String,
    codeSize: Number,
    timeout: Number,
    memorySize: Number,
    lastModified: Date,
    invocations24h: Number,
    errors24h: Number
  },
  tags: { type: Map, of: String, default: new Map() },
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  lastSync: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

// Indexes
AWSResourceSchema.index({ resourceId: 1, resourceType: 1, accountId: 1, companyId: 1 }, { unique: true });
AWSResourceSchema.index({ resourceType: 1, companyId: 1 });
AWSResourceSchema.index({ accountId: 1, companyId: 1 });
AWSResourceSchema.index({ state: 1 });

export const AWSResource = mongoose.model<IAWSResource>('AWSResource', AWSResourceSchema);
