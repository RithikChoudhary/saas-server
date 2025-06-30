import { Router } from 'express';
import { 
  getCompanyDetails,
  updateCompanyGeneral,
  updateCompanyBilling,
  updateCompanySettings,
  updateCompanyUserSettings
} from '../controllers/company.controller';
import { authenticate } from '../../../shared/middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get company details
router.get('/', getCompanyDetails);

// Update company sections
router.put('/general', updateCompanyGeneral);
router.put('/billing', updateCompanyBilling);
router.put('/security', updateCompanySettings);
router.put('/user-settings', updateCompanyUserSettings);

export default router;
