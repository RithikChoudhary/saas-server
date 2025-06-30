import mongoose, { Schema, Document } from 'mongoose';

export interface IGitHubRepository extends Document {
  companyId: mongoose.Types.ObjectId;
  connectionId: mongoose.Types.ObjectId;
  githubId: number;
  nodeId: string;
  name: string;
  fullName: string;
  description?: string;
  private: boolean;
  owner: {
    login: string;
    type: 'User' | 'Organization';
  };
  htmlUrl: string;
  language?: string;
  stargazersCount: number;
  watchersCount: number;
  forksCount: number;
  openIssuesCount: number;
  defaultBranch: string;
  topics: string[];
  archived: boolean;
  disabled: boolean;
  pushedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  lastSync: Date;
  isActive: boolean;
}

const GitHubRepositorySchema: Schema = new Schema({
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
  nodeId: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true,
    index: true
  },
  fullName: {
    type: String,
    required: true,
    index: true
  },
  description: String,
  private: {
    type: Boolean,
    default: false
  },
  owner: {
    login: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['User', 'Organization'],
      required: true
    }
  },
  htmlUrl: {
    type: String,
    required: true
  },
  language: String,
  stargazersCount: {
    type: Number,
    default: 0
  },
  watchersCount: {
    type: Number,
    default: 0
  },
  forksCount: {
    type: Number,
    default: 0
  },
  openIssuesCount: {
    type: Number,
    default: 0
  },
  defaultBranch: {
    type: String,
    default: 'main'
  },
  topics: [{
    type: String
  }],
  archived: {
    type: Boolean,
    default: false
  },
  disabled: {
    type: Boolean,
    default: false
  },
  pushedAt: Date,
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
  collection: 'github_repositories'
});

// Compound indexes
GitHubRepositorySchema.index({ companyId: 1, githubId: 1 }, { unique: true });
GitHubRepositorySchema.index({ companyId: 1, fullName: 1 });
GitHubRepositorySchema.index({ companyId: 1, 'owner.login': 1 });
GitHubRepositorySchema.index({ companyId: 1, language: 1 });
GitHubRepositorySchema.index({ companyId: 1, isActive: 1 });

export const GitHubRepository = mongoose.model<IGitHubRepository>('GitHubRepository', GitHubRepositorySchema);
