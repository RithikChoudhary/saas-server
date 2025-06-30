export * as syncController from './controllers/sync.controller';
export * as realSyncController from './controllers/realSync.controller';
export * as webhooksController from './controllers/webhooks.controller';
export { default as syncRoutes } from './routes/sync.routes';
export { default as realSyncRoutes } from './routes/realSync.routes';
export { default as webhooksRoutes } from './routes/webhooks.routes';
export * as integrationServices from './services/realApiIntegration';
export * from './aws/AWSIntegration';
export * from './github/GitHubIntegration';
export * from './office365/Office365Integration';
export * from './base/BaseIntegration';

// Integration registry
import { BaseIntegration } from './base/BaseIntegration';

const integrations = new Map<string, BaseIntegration>();

export function registerIntegration(name: string, integration: BaseIntegration) {
  integrations.set(name.toLowerCase(), integration);
}

export function getIntegration(name: string): BaseIntegration | null {
  return integrations.get(name.toLowerCase()) || null;
}
