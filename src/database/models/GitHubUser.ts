import mongoose, { Schema, Document } from 'mongoose';

export interface IGitHubUser extends Document {
  companyId: mongoose.Types.ObjectId;
  connectionId: mongoose.Types.ObjectId;
  githubId: number;
  login: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
  type: 'User' | 'Bot';
  siteAdmin: boolean;
  company?: string;
  location?: string;
  bio?: string;
  publicRepos: number;
  followers: number;
  following: number;
  createdAt: Date;
  updatedAt: Date;
  lastSync: Date;
  isActive: boolean;
}

const GitHubUserSchema: Schema = new Schema({
  companyId: {
    type: Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  connectionId: {
    type: Schema.Types.ObjectId,
    ref: 'GitHubConnection',
    required: true,
    index: true
  },
  githubId: {
    type: Number,
    required: true,
    index: true
  },
  login: {
    type: String,
    required: true,
    index: true
  },
  email: {
    type: String,
    sparse: true
  },
  name: String,
  avatarUrl: String,
  type: {
    type: String,
    enum: ['User', 'Bot'],
    default: 'User'
  },
  siteAdmin: {
    type: Boolean,
    default: false
  },
  company: String,
  location: String,
  bio: String,
  publicRepos: {
    type: Number,
    default: 0
  },
  followers: {
    type: Number,
    default: 0
  },
  following: {
    type: Number,
    default: 0
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
  collection: 'github_users'
});

// Compound indexes
GitHubUserSchema.index({ companyId: 1, githubId: 1 }, { unique: true });
GitHubUserSchema.index({ companyId: 1, login: 1 });
GitHubUserSchema.index({ companyId: 1, email: 1 });
GitHubUserSchema.index({ companyId: 1, isActive: 1 });

export const GitHubUser = mongoose.model<IGitHubUser>('GitHubUser', GitHubUserSchema);
