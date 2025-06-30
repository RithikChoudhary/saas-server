# Backend Folder Structure

The backend has been restructured into a feature-based architecture for better maintainability, scalability, and team collaboration.

## New Structure

```
src/
├── server.ts                 # Main server entry point
├── features/                 # Feature-based modules
│   ├── auth/                 # Authentication features
│   │   ├── index.ts          # Export barrel
│   │   ├── controllers/      # Auth controllers
│   │   │   └── auth.controller.ts
│   │   ├── routes/           # Auth routes
│   │   │   └── auth.routes.ts
│   │   ├── services/         # Auth business logic (future)
│   │   └── validators/       # Auth validation (future)
│   ├── users/                # User management features
│   │   ├── index.ts          # Export barrel
│   │   ├── controllers/      # User controllers
│   │   │   └── users.controller.ts
│   │   ├── routes/           # User routes
│   │   │   └── users.routes.ts
│   │   ├── services/         # User business logic (future)
│   │   └── validators/       # User validation (future)
│   ├── companies/            # Company management features
│   │   ├── index.ts          # Export barrel
│   │   ├── controllers/      # Company controllers
│   │   │   └── company.controller.ts
│   │   ├── routes/           # Company routes
│   │   │   └── company.routes.ts
│   │   ├── services/         # Company business logic (future)
│   │   └── validators/       # Company validation (future)
│   ├── apps/                 # App management features
│   │   ├── index.ts          # Export barrel
│   │   ├── controllers/      # App controllers
│   │   │   └── apps.controller.ts
│   │   ├── routes/           # App routes
│   │   │   └── apps.routes.ts
│   │   ├── services/         # App business logic (future)
│   │   └── validators/       # App validation (future)
│   └── integrations/         # Integration features
│       ├── index.ts          # Export barrel
│       ├── controllers/      # Integration controllers
│       │   ├── sync.controller.ts
│       │   ├── realSync.controller.ts
│       │   └── webhooks.controller.ts
│       ├── routes/           # Integration routes
│       │   ├── sync.routes.ts
│       │   ├── realSync.routes.ts
│       │   └── webhooks.routes.ts
│       ├── services/         # Integration services
│       │   └── realApiIntegration.ts
│       ├── aws/              # AWS integrations
│       │   └── AWSIntegration.ts
│       ├── github/           # GitHub integrations
│       │   └── GitHubIntegration.ts
│       ├── office365/        # Office365 integrations
│       │   └── Office365Integration.ts
│       └── base/             # Base integration classes
│           └── BaseIntegration.ts
├── shared/                   # Shared utilities and components
│   ├── index.ts              # Export barrel
│   ├── database.ts           # Database configuration
│   ├── middleware/           # Express middleware
│   │   ├── auth.ts           # Authentication middleware
│   │   └── validation.ts     # Validation middleware
│   ├── utils/                # Utility functions
│   │   ├── jwt.ts            # JWT utilities
│   │   ├── memoryMonitor.ts  # Memory monitoring
│   │   ├── seedApps.ts       # Database seeding
│   │   └── reseedApps.ts     # Database reseeding
│   ├── types/                # TypeScript type definitions
│   │   └── index.ts          # Type exports
│   └── constants/            # Application constants (future)
└── database/                 # Database layer
    ├── index.ts              # Database exports
    ├── models/               # Mongoose models
    │   ├── index.ts          # Model exports
    │   ├── User.ts           # User model
    │   ├── Company.ts        # Company model
    │   ├── App.ts            # App model
    │   ├── CompanyApp.ts     # Company-App relationship
    │   ├── UserAppAccess.ts  # User-App access
    │   └── WebhookLog.ts     # Webhook logging
    ├── migrations/           # Database migrations (future)
    └── seeders/              # Database seeders (future)
```

## Benefits

### 1. **Feature-based Organization**
- Related code is grouped together by business domain
- Easy to locate and modify feature-specific code
- Clear boundaries between different parts of the application

### 2. **Better Maintainability**
- Easier to understand code organization
- Reduced coupling between features
- Simpler debugging and troubleshooting

### 3. **Enhanced Scalability**
- Easy to add new features without affecting existing ones
- Clear patterns for extending functionality
- Modular architecture supports growth

### 4. **Improved Team Collaboration**
- Different developers can work on different features independently
- Reduced merge conflicts
- Clear ownership of code sections

### 5. **Separation of Concerns**
- Controllers handle HTTP requests/responses
- Services contain business logic
- Models define data structure
- Middleware handles cross-cutting concerns

## Import Examples

### Before Restructure
```typescript
import { User } from '../models/User';
import { generateTokenPair } from '../utils/jwt';
import authRoutes from './routes/auth.routes';
```

### After Restructure
```typescript
import { User } from '../../../database/models';
import { generateTokenPair } from '../../../shared/utils/jwt';
import { authRoutes } from './features/auth';
```

### Clean Feature Imports
```typescript
// Feature imports
import { authRoutes, authController } from './features/auth';
import { usersRoutes, usersController } from './features/users';
import { companiesRoutes, companiesController } from './features/companies';

// Shared imports
import { generateTokenPair, getMemoryStats } from './shared/utils';
import { User, Company } from './database/models';
```

## Migration Notes

### 1. **File Movements**
- Controllers moved to `features/{feature}/controllers/`
- Routes moved to `features/{feature}/routes/`
- Models moved to `database/models/`
- Middleware moved to `shared/middleware/`
- Utilities moved to `shared/utils/`

### 2. **Import Path Updates**
- All import paths updated to reflect new structure
- Relative imports adjusted for new folder hierarchy
- Export barrel pattern implemented for cleaner imports

### 3. **Server Configuration**
- Main server.ts updated to use new import paths
- Route registration updated to use feature exports
- Database imports updated to use shared configuration

## Future Enhancements

### 1. **Service Layer**
- Extract business logic from controllers to services
- Implement dependency injection
- Add service interfaces for better testing

### 2. **Validation Layer**
- Create feature-specific validators
- Implement request/response schemas
- Add comprehensive input validation

### 3. **Testing Structure**
- Mirror folder structure in test files
- Feature-specific test suites
- Shared test utilities

### 4. **Documentation**
- API documentation per feature
- Feature-specific README files
- Architecture decision records (ADRs)

## Development Guidelines

### 1. **Adding New Features**
```bash
# Create feature structure
mkdir -p src/features/new-feature/{controllers,routes,services,validators}

# Create index.ts for exports
touch src/features/new-feature/index.ts

# Follow naming conventions
# - Controllers: feature.controller.ts
# - Routes: feature.routes.ts
# - Services: feature.service.ts
```

### 2. **Import Best Practices**
- Use feature index files for imports
- Prefer absolute imports over relative when possible
- Group imports by type (external, features, shared, database)

### 3. **Code Organization**
- Keep controllers thin - delegate to services
- Put business logic in services
- Use shared utilities for common functionality
- Keep models focused on data structure

This restructured backend provides a solid foundation for building and maintaining a scalable SaaS management platform!
