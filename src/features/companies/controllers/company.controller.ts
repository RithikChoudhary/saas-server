import { Request, Response } from 'express';
import { Company } from '../../../database/models';

export const getCompanyDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('🏢 GET COMPANY DETAILS CALLED');
    console.log('📋 req.user:', req.user);
    
    const { companyId } = req.user!;
    console.log('🆔 Company ID:', companyId);

    const company = await Company.findById(companyId);
    console.log('🔍 Company found:', company ? 'Yes' : 'No');
    
    if (!company) {
      console.log('❌ Company not found in database');
      res.status(404).json({
        success: false,
        message: 'Company not found'
      });
      return;
    }

    console.log('✅ Returning company data:', company.name);
    res.json({
      success: true,
      data: company
    });
  } catch (error) {
    console.error('❌ Error fetching company details:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

export const updateCompanyGeneral = async (req: Request, res: Response): Promise<void> => {
  try {
    const { companyId } = req.user!;
    const { name, domain, industry, size } = req.body;

    // Validate required fields
    if (!name || !domain || !industry || !size) {
      res.status(400).json({
        success: false,
        message: 'Name, domain, industry, and size are required'
      });
      return;
    }

    // Check if domain is already taken by another company
    const existingCompany = await Company.findOne({ 
      domain: domain.toLowerCase(),
      _id: { $ne: companyId }
    });

    if (existingCompany) {
      res.status(400).json({
        success: false,
        message: 'Domain is already taken by another company'
      });
      return;
    }

    const company = await Company.findByIdAndUpdate(
      companyId,
      {
        name: name.trim(),
        domain: domain.toLowerCase().trim(),
        industry,
        size
      },
      { new: true, runValidators: true }
    );

    if (!company) {
      res.status(404).json({
        success: false,
        message: 'Company not found'
      });
      return;
    }

    res.json({
      success: true,
      data: company,
      message: 'Company general information updated successfully'
    });
  } catch (error: any) {
    console.error('Error updating company general info:', error);
    
    if (error.name === 'ValidationError') {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map((err: any) => err.message)
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

export const updateCompanyBilling = async (req: Request, res: Response): Promise<void> => {
  try {
    const { companyId } = req.user!;
    const { email, address, paymentMethod } = req.body;

    // Validate required fields
    if (!email || !address) {
      res.status(400).json({
        success: false,
        message: 'Billing email and address are required'
      });
      return;
    }

    const company = await Company.findByIdAndUpdate(
      companyId,
      {
        'billing.email': email.trim(),
        'billing.address': address.trim(),
        'billing.paymentMethod': paymentMethod?.trim() || null
      },
      { new: true, runValidators: true }
    );

    if (!company) {
      res.status(404).json({
        success: false,
        message: 'Company not found'
      });
      return;
    }

    res.json({
      success: true,
      data: company,
      message: 'Billing information updated successfully'
    });
  } catch (error: any) {
    console.error('Error updating company billing:', error);
    
    if (error.name === 'ValidationError') {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map((err: any) => err.message)
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

export const updateCompanySettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { companyId } = req.user!;
    const { 
      ssoEnabled, 
      mfaRequired, 
      passwordPolicy,
      allowSelfRegistration,
      requireEmailVerification
    } = req.body;

    const updateData: any = {};

    // Security settings
    if (typeof ssoEnabled === 'boolean') {
      updateData['settings.ssoEnabled'] = ssoEnabled;
    }
    if (typeof mfaRequired === 'boolean') {
      updateData['settings.mfaRequired'] = mfaRequired;
    }
    if (typeof allowSelfRegistration === 'boolean') {
      updateData['settings.allowSelfRegistration'] = allowSelfRegistration;
    }
    if (typeof requireEmailVerification === 'boolean') {
      updateData['settings.requireEmailVerification'] = requireEmailVerification;
    }

    // Password policy
    if (passwordPolicy) {
      if (passwordPolicy.minLength && passwordPolicy.minLength >= 6 && passwordPolicy.minLength <= 32) {
        updateData['settings.passwordPolicy.minLength'] = passwordPolicy.minLength;
      }
      if (typeof passwordPolicy.requireUppercase === 'boolean') {
        updateData['settings.passwordPolicy.requireUppercase'] = passwordPolicy.requireUppercase;
      }
      if (typeof passwordPolicy.requireLowercase === 'boolean') {
        updateData['settings.passwordPolicy.requireLowercase'] = passwordPolicy.requireLowercase;
      }
      if (typeof passwordPolicy.requireNumbers === 'boolean') {
        updateData['settings.passwordPolicy.requireNumbers'] = passwordPolicy.requireNumbers;
      }
      if (typeof passwordPolicy.requireSpecialChars === 'boolean') {
        updateData['settings.passwordPolicy.requireSpecialChars'] = passwordPolicy.requireSpecialChars;
      }
    }

    const company = await Company.findByIdAndUpdate(
      companyId,
      updateData,
      { new: true, runValidators: true }
    );

    if (!company) {
      res.status(404).json({
        success: false,
        message: 'Company not found'
      });
      return;
    }

    res.json({
      success: true,
      data: company,
      message: 'Security settings updated successfully'
    });
  } catch (error: any) {
    console.error('Error updating company settings:', error);
    
    if (error.name === 'ValidationError') {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map((err: any) => err.message)
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

export const updateCompanyUserSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { companyId } = req.user!;
    const { allowSelfRegistration, requireEmailVerification } = req.body;

    const updateData: any = {};

    if (typeof allowSelfRegistration === 'boolean') {
      updateData['settings.allowSelfRegistration'] = allowSelfRegistration;
    }
    if (typeof requireEmailVerification === 'boolean') {
      updateData['settings.requireEmailVerification'] = requireEmailVerification;
    }

    const company = await Company.findByIdAndUpdate(
      companyId,
      updateData,
      { new: true, runValidators: true }
    );

    if (!company) {
      res.status(404).json({
        success: false,
        message: 'Company not found'
      });
      return;
    }

    res.json({
      success: true,
      data: company,
      message: 'User settings updated successfully'
    });
  } catch (error: any) {
    console.error('Error updating user settings:', error);
    
    if (error.name === 'ValidationError') {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map((err: any) => err.message)
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
