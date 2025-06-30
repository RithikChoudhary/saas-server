import mongoose, { Schema, Document } from 'mongoose';

export interface IAWSGroup extends Document {
  _id: mongoose.Types.ObjectId;
  groupName: string;
  arn: string;
  path: string;
  createDate: Date;
  userCount: number;
  policies: string[];
  accountId: string;
  accountName: string;
  companyId: mongoose.Types.ObjectId;
  region: string;
  lastSync: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AWSGroupSchema = new Schema<IAWSGroup>({
  groupName: {
    type: String,
    required: true,
    index: true
  },
  arn: {
    type: String,
    required: true,
    unique: true
  },
  path: {
    type: String,
    default: '/'
  },
  createDate: {
    type: Date,
    required: true
  },
  userCount: {
    type: Number,
    default: 0
  },
  policies: [{
    type: String
  }],
  accountId: {
    type: String,
    required: true,
    index: true
  },
  accountName: {
    type: String,
    required: true
  },
  companyId: {
    type: Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  region: {
    type: String,
    required: true
  },
  lastSync: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  collection: 'aws_groups'
});

// Indexes for performance
AWSGroupSchema.index({ companyId: 1, accountId: 1 });
AWSGroupSchema.index({ groupName: 1, accountId: 1 }, { unique: true });

// Static methods
AWSGroupSchema.statics.findByCompany = function(companyId: string) {
  return this.find({ 
    companyId: new mongoose.Types.ObjectId(companyId),
    isActive: true 
  });
};

AWSGroupSchema.statics.findByAccount = function(companyId: string, accountId: string) {
  return this.find({ 
    companyId: new mongoose.Types.ObjectId(companyId),
    accountId,
    isActive: true 
  });
};

export const AWSGroup = mongoose.model<IAWSGroup>('AWSGroup', AWSGroupSchema);
