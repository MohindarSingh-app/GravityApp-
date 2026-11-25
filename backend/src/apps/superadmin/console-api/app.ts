import express, { type ErrorRequestHandler } from 'express5';
import { AccessControlService } from './services/access-control.js';
import { AuthenticationService } from './services/authentication.js';
import { SessionManager } from './services/sessions.js';
import { JsonStore } from './infrastructure/json-store.js';
import { createApiRouter } from './http/routes.js';
import type { PlatformRegistration, PlatformRegistrationDetails } from './domain/models.js';

export interface AppOptions {
  store: JsonStore;
  access: AccessControlService;
  authentication: AuthenticationService;
  sessions: SessionManager;
  frontendOrigins: string[];
  secureCookies: boolean;
  localDemoCredentials?: { email: string; password: string } | null;
  platformDirectory?: {
    listRegistrations(): Promise<PlatformRegistration[]>;
    getRegistrationDetails(id: string): Promise<PlatformRegistrationDetails | null>;
  };
  operationsDirectory?: {
    getData(domain: string): Promise<unknown>;
  };
}

export function createApp(options: AppOptions): express.Express {
  const app = express();
  const origins = new Set(options.frontendOrigins);

  app.disable('x-powered-by');
  app.use('/api', (_request, response, next) => {
    response.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use((request, response, next) => {
    const origin = request.get('origin');
    if (origin && origins.has(origin)) {
      response.setHeader('Access-Control-Allow-Origin', origin);
      response.setHeader('Access-Control-Allow-Credentials', 'true');
      response.setHeader('Vary', 'Origin');
    } else if (origin && request.method !== 'GET' && request.method !== 'HEAD') {
      response.status(403).json({ message: 'Request origin is not allowed.' });
      return;
    }
    if (request.method === 'OPTIONS') {
      response.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      response.status(204).end();
      return;
    }
    next();
  });
  app.use(express.json({ limit: '32kb' }));
  app.get('/api/health', (_request, response) => response.json({ status: 'ok' }));
  app.use('/api', createApiRouter(options));

  const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
    if (response.headersSent) return;
    if (error instanceof SyntaxError && 'body' in error) {
      response.status(400).json({ message: 'Request body must be valid JSON.' });
      return;
    }
    if (error && typeof error === 'object' && 'type' in error && error.type === 'entity.too.large') {
      response.status(413).json({ message: 'Profile images must be no larger than 512 KB.' });
      return;
    }
    console.error('Unhandled API error:', error);
    response.status(500).json({ message: 'An unexpected server error occurred.' });
  };
  app.use(errorHandler);

  return app;
}
