"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { Campaign, CampaignContact } from '@/types';

// ============================================================
// API TYPES
// ============================================================

interface CreateCampaignResponse {
  success: boolean;
  campaign?: {
    id: string;
    name: string;
    status: string;
    contactCount: number;
    createdAt: string;
    updatedAt: string;
  };
  error?: string;
  code?: string;
}

interface UpdateCampaignResponse {
  success: boolean;
  error?: string;
  code?: string;
}

// ============================================================
// CONTEXT TYPES
// ============================================================

interface CampaignContextType {
  campaign: Campaign | null;
  isLoading: boolean;
  error: string | null;
  createCampaign: (name: string, contacts: CampaignContact[]) => Campaign;
  saveCampaignToDatabase: (name: string, contacts: CampaignContact[]) => Promise<Campaign | null>;
  updateCampaignName: (name: string) => void;
  addContacts: (contacts: CampaignContact[]) => void;
  updateContactEmail: (contactId: string, subject: string, body: string) => void;
  markContactDone: (contactId: string) => void;
  saveContactsToDatabase: () => Promise<boolean>;
  currentContactId: string | null;
  setCurrentContactId: (id: string | null) => void;
  completedCount: number;
  totalCount: number;
  resetCampaign: () => void;
  setCampaign: (campaign: Campaign | null) => void;
}

const CampaignContext = createContext<CampaignContextType | undefined>(undefined);

export function CampaignProvider({ children }: { children: ReactNode }) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [currentContactId, setCurrentContactId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Create a campaign in local state only (for immediate UI feedback)
   * This returns a temporary campaign that will be persisted when saveCampaignToDatabase is called
   */
  const createCampaign = useCallback((name: string, contacts: CampaignContact[]): Campaign => {
    // Generate a temporary ID - this will be replaced with the database ID
    const tempId = `temp-${Date.now()}`;

    const newCampaign: Campaign = {
      id: tempId,
      name,
      status: 'composing',
      contacts,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setCampaign(newCampaign);
    setError(null);

    // Automatically save to database in the background
    saveCampaignToDatabaseInternal(name, contacts, newCampaign);

    return newCampaign;
  }, []);

  /**
   * Internal function to save campaign to database
   */
  const saveCampaignToDatabaseInternal = async (
    name: string,
    contacts: CampaignContact[],
    localCampaign: Campaign
  ): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          contacts: contacts.map(c => ({
            id: c.id,
            name: c.name,
            email: c.email,
            company: c.company,
            role: c.role,
            emailSubject: c.emailSubject,
            emailBody: c.emailBody,
          })),
        }),
      });

      const data: CreateCampaignResponse = await response.json();

      if (!response.ok || !data.success || !data.campaign) {
        throw new Error(data.error || 'Failed to save campaign');
      }

      console.log('[CampaignContext] Campaign saved to database:', data.campaign.id);

      // Update the campaign with the real database ID
      setCampaign(prev => {
        if (!prev || prev.id !== localCampaign.id) return prev;
        return {
          ...prev,
          id: data.campaign!.id,
          createdAt: data.campaign!.createdAt,
          updatedAt: data.campaign!.updatedAt,
        };
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save campaign';
      console.error('[CampaignContext] Save failed:', errorMessage);
      setError(errorMessage);
      // Don't clear the campaign - let user retry or continue locally
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Explicitly save campaign to database
   */
  const saveCampaignToDatabase = useCallback(async (
    name: string,
    contacts: CampaignContact[]
  ): Promise<Campaign | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          contacts: contacts.map(c => ({
            id: c.id,
            name: c.name,
            email: c.email,
            company: c.company,
            role: c.role,
            emailSubject: c.emailSubject,
            emailBody: c.emailBody,
          })),
        }),
      });

      const data: CreateCampaignResponse = await response.json();

      if (!response.ok || !data.success || !data.campaign) {
        throw new Error(data.error || 'Failed to save campaign');
      }

      const savedCampaign: Campaign = {
        id: data.campaign.id,
        name: data.campaign.name,
        status: data.campaign.status as Campaign['status'],
        contacts,
        createdAt: data.campaign.createdAt,
        updatedAt: data.campaign.updatedAt,
      };

      setCampaign(savedCampaign);
      return savedCampaign;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save campaign';
      console.error('[CampaignContext] Save failed:', errorMessage);
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateCampaignName = useCallback((name: string) => {
    setCampaign(prev => prev ? { ...prev, name, updatedAt: new Date().toISOString() } : null);
  }, []);

  const addContacts = useCallback((newContacts: CampaignContact[]) => {
    if (!campaign) return;

    setCampaign(prev => {
      if (!prev) return null;

      // Merge contacts, avoiding duplicates by email
      const existingEmails = new Set(prev.contacts.map(c => c.email));
      const uniqueNewContacts = newContacts.filter(c => !existingEmails.has(c.email));

      return {
        ...prev,
        contacts: [...prev.contacts, ...uniqueNewContacts],
        updatedAt: new Date().toISOString()
      };
    });
  }, [campaign]);

  const updateContactEmail = useCallback((contactId: string, subject: string, body: string) => {
    setCampaign(prev => {
      if (!prev) return null;

      return {
        ...prev,
        contacts: prev.contacts.map(contact =>
          contact.id === contactId
            ? { ...contact, emailSubject: subject, emailBody: body, emailStatus: 'done' as const }
            : contact
        ),
        updatedAt: new Date().toISOString()
      };
    });
  }, []);

  const markContactDone = useCallback((contactId: string) => {
    setCampaign(prev => {
      if (!prev) return null;

      return {
        ...prev,
        contacts: prev.contacts.map(contact =>
          contact.id === contactId
            ? { ...contact, emailStatus: 'done' as const }
            : contact
        ),
        updatedAt: new Date().toISOString()
      };
    });
  }, []);

  /**
   * Save all contact email content to the database
   */
  const saveContactsToDatabase = useCallback(async (): Promise<boolean> => {
    if (!campaign || campaign.id.startsWith('temp-')) {
      console.warn('[CampaignContext] Cannot save contacts - campaign not yet persisted');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const contactsToUpdate = campaign.contacts.filter(c => c.emailSubject || c.emailBody);

      if (contactsToUpdate.length === 0) {
        return true;
      }

      const response = await fetch(`/api/campaigns/${campaign.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contacts: contactsToUpdate.map(c => ({
            id: c.id,
            emailSubject: c.emailSubject,
            emailBody: c.emailBody,
          })),
        }),
      });

      const data: UpdateCampaignResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to save contacts');
      }

      console.log('[CampaignContext] Contacts saved to database');
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save contacts';
      console.error('[CampaignContext] Save contacts failed:', errorMessage);
      setError(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [campaign]);

  const resetCampaign = useCallback(() => {
    setCampaign(null);
    setCurrentContactId(null);
    setError(null);
  }, []);

  const completedCount = campaign?.contacts.filter(c => c.emailStatus === 'done').length || 0;
  const totalCount = campaign?.contacts.length || 0;

  const contextValue: CampaignContextType = {
    campaign,
    isLoading,
    error,
    createCampaign,
    saveCampaignToDatabase,
    updateCampaignName,
    addContacts,
    updateContactEmail,
    markContactDone,
    saveContactsToDatabase,
    currentContactId,
    setCurrentContactId,
    completedCount,
    totalCount,
    resetCampaign,
    setCampaign,
  };

  return (
    <CampaignContext.Provider value={contextValue}>
      {children}
    </CampaignContext.Provider>
  );
}

export function useCampaign() {
  const context = useContext(CampaignContext);
  if (!context) {
    throw new Error('useCampaign must be used within a CampaignProvider');
  }
  return context;
}

export type { Campaign };
