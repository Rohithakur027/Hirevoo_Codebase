"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { Campaign, CampaignContact } from '@/types';

interface CampaignContextType {
  campaign: Campaign | null;
  createCampaign: (name: string, contacts: CampaignContact[]) => Campaign;
  updateCampaignName: (name: string) => void;
  addContacts: (contacts: CampaignContact[]) => void;
  updateContactEmail: (contactId: string, subject: string, body: string) => void;
  markContactDone: (contactId: string) => void;
  currentContactId: string | null;
  setCurrentContactId: (id: string | null) => void;
  completedCount: number;
  totalCount: number;
  resetCampaign: () => void;
}

const CampaignContext = createContext<CampaignContextType | undefined>(undefined);

export function CampaignProvider({ children }: { children: ReactNode }) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [currentContactId, setCurrentContactId] = useState<string | null>(null);

  const createCampaign = useCallback((name: string, contacts: CampaignContact[]): Campaign => {
    const newCampaign: Campaign = {
      id: `campaign-${Date.now()}`,
      name,
      status: 'composing',
      contacts,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setCampaign(newCampaign);
    return newCampaign;
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

  const resetCampaign = useCallback(() => {
    setCampaign(null);
    setCurrentContactId(null);
  }, []);

  const completedCount = campaign?.contacts.filter(c => c.emailStatus === 'done').length || 0;
  const totalCount = campaign?.contacts.length || 0;

  const contextValue: CampaignContextType = {
    campaign,
    createCampaign,
    updateCampaignName,
    addContacts,
    updateContactEmail,
    markContactDone,
    currentContactId,
    setCurrentContactId,
    completedCount,
    totalCount,
    resetCampaign,
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