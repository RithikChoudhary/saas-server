import { Request, Response } from 'express';
import { AzureIntegrationService } from '../services/AzureIntegration';

const azureService = new AzureIntegrationService();

export const getAzureOverview = async (req: Request, res: Response) => {
  try {
    console.log('🔷 Azure Controller: Getting overview data...');
    
    const overview = await azureService.getOverview();
    
    res.json({
      success: true,
      message: 'Azure overview data retrieved successfully',
      data: overview
    });
  } catch (error) {
    console.error('❌ Azure Controller: Error getting overview:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get Azure overview',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

export const getAzureSubscriptions = async (req: Request, res: Response) => {
  try {
    console.log('🔷 Azure Controller: Getting subscriptions...');
    
    const subscriptions = await azureService.getSubscriptions();
    
    res.json({
      success: true,
      message: 'Azure subscriptions retrieved successfully',
      data: subscriptions
    });
  } catch (error) {
    console.error('❌ Azure Controller: Error getting subscriptions:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get Azure subscriptions',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

export const createAzureSubscription = async (req: Request, res: Response) => {
  try {
    console.log('🔷 Azure Controller: Creating subscription...');
    
    const { subscriptionId, subscriptionName, tenantId } = req.body;
    
    if (!subscriptionId || !subscriptionName || !tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: subscriptionId, subscriptionName, tenantId'
      });
    }
    
    const subscription = await azureService.createSubscription({
      subscriptionId,
      subscriptionName,
      tenantId
    });
    
    res.status(201).json({
      success: true,
      message: 'Azure subscription created successfully',
      data: subscription
    });
  } catch (error) {
    console.error('❌ Azure Controller: Error creating subscription:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create Azure subscription',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

export const updateAzureSubscription = async (req: Request, res: Response) => {
  try {
    console.log('🔷 Azure Controller: Updating subscription...');
    
    const { subscriptionId } = req.params;
    const updateData = req.body;
    
    const subscription = await azureService.updateSubscription(subscriptionId, updateData);
    
    res.json({
      success: true,
      message: 'Azure subscription updated successfully',
      data: subscription
    });
  } catch (error) {
    console.error('❌ Azure Controller: Error updating subscription:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update Azure subscription',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

export const deleteAzureSubscription = async (req: Request, res: Response) => {
  try {
    console.log('🔷 Azure Controller: Deleting subscription...');
    
    const { subscriptionId } = req.params;
    
    await azureService.deleteSubscription(subscriptionId);
    
    res.json({
      success: true,
      message: 'Azure subscription deleted successfully'
    });
  } catch (error) {
    console.error('❌ Azure Controller: Error deleting subscription:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to delete Azure subscription',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

export const syncAzureSubscription = async (req: Request, res: Response) => {
  try {
    console.log('🔷 Azure Controller: Syncing subscription...');
    
    const { subscriptionId } = req.params;
    
    await azureService.syncSubscription(subscriptionId);
    
    res.json({
      success: true,
      message: 'Azure subscription sync initiated successfully'
    });
  } catch (error) {
    console.error('❌ Azure Controller: Error syncing subscription:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to sync Azure subscription',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

export const getAzureUsers = async (req: Request, res: Response) => {
  try {
    console.log('🔷 Azure Controller: Getting users...');
    
    const { tenantId } = req.query;
    
    const users = await azureService.getUsers(tenantId as string);
    
    res.json({
      success: true,
      message: 'Azure users retrieved successfully',
      data: users
    });
  } catch (error) {
    console.error('❌ Azure Controller: Error getting users:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get Azure users',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

export const getAzureCostData = async (req: Request, res: Response) => {
  try {
    console.log('🔷 Azure Controller: Getting cost data...');
    
    const { subscriptionId } = req.query;
    
    const costData = await azureService.getCostData(subscriptionId as string);
    
    res.json({
      success: true,
      message: 'Azure cost data retrieved successfully',
      data: costData
    });
  } catch (error) {
    console.error('❌ Azure Controller: Error getting cost data:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get Azure cost data',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

export const getAzureSecurityData = async (req: Request, res: Response) => {
  try {
    console.log('🔷 Azure Controller: Getting security data...');
    
    const { subscriptionId } = req.query;
    
    const securityData = await azureService.getSecurityData(subscriptionId as string);
    
    res.json({
      success: true,
      message: 'Azure security data retrieved successfully',
      data: securityData
    });
  } catch (error) {
    console.error('❌ Azure Controller: Error getting security data:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get Azure security data',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

export const getAzureManagementGroups = async (req: Request, res: Response) => {
  try {
    console.log('🔷 Azure Controller: Getting management groups...');
    
    const managementGroups = await azureService.getManagementGroups();
    
    res.json({
      success: true,
      message: 'Azure management groups retrieved successfully',
      data: managementGroups
    });
  } catch (error) {
    console.error('❌ Azure Controller: Error getting management groups:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get Azure management groups',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};
