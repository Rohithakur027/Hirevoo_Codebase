import type { Recipient } from '@/components/campaigns/contactuploader/ContactUploader';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface DeduplicationResult {
  uniqueContacts: Recipient[];
  duplicates: Array<{
    email: string;
    count: number;
    contacts: Recipient[];
  }>;
}

/**
 * Advanced email validation using regex and domain checks
 */
export function validateEmailAdvanced(email: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!email || typeof email !== 'string') {
    errors.push('Email is required');
    return { isValid: false, errors, warnings };
  }

  const trimmedEmail = email.trim().toLowerCase();

  // Basic regex validation
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  if (!emailRegex.test(trimmedEmail)) {
    errors.push('Invalid email format');
    return { isValid: false, errors, warnings };
  }

  // Extract domain
  const [, domain] = trimmedEmail.split('@');

  // Check for common disposable email domains
  const disposableDomains = [
    '10minutemail.com', 'guerrillamail.com', 'mailinator.com', 'temp-mail.org',
    'throwaway.email', 'yopmail.com', 'maildrop.cc', 'tempail.com'
  ];

  if (disposableDomains.includes(domain)) {
    warnings.push('This appears to be a disposable email address');
  }

  // Check for role-based emails
  const rolePrefixes = ['admin', 'info', 'contact', 'support', 'sales', 'hello', 'noreply'];
  const localPart = trimmedEmail.split('@')[0];

  if (rolePrefixes.some(prefix => localPart.includes(prefix))) {
    warnings.push('This appears to be a role-based email address');
  }

  // Check for very long domains (potential typos)
  if (domain.length > 50) {
    warnings.push('Domain name is unusually long - please verify');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Check if email domain has valid MX records (client-side approximation)
 */
export function hasValidDomain(email: string): boolean {
  if (!email) return false;

  const [, domain] = email.toLowerCase().split('@');
  if (!domain) return false;

  // Basic domain validation - check for at least one dot and valid TLD
  const parts = domain.split('.');
  if (parts.length < 2) return false;

  const tld = parts[parts.length - 1];
  const validTlds = ['com', 'org', 'net', 'edu', 'gov', 'mil', 'int', 'info', 'biz', 'name', 'pro', 'coop', 'aero', 'museum', 'cat', 'travel', 'jobs', 'mobi', 'post', 'tel', 'asia', 'me', 'io', 'co', 'uk', 'de', 'fr', 'it', 'es', 'ca', 'au', 'jp', 'cn', 'in', 'br', 'mx', 'ar', 'cl', 'pe', 'co', 've', 'ec'];

  return validTlds.includes(tld) || tld.length >= 2; // Allow for newer TLDs
}

/**
 * Find and categorize duplicates in contact list
 */
export function findDuplicates(contacts: Recipient[]): DeduplicationResult {
  const emailMap = new Map<string, Recipient[]>();

  // Group contacts by normalized email
  contacts.forEach(contact => {
    const normalizedEmail = contact.email.toLowerCase().trim();
    if (!emailMap.has(normalizedEmail)) {
      emailMap.set(normalizedEmail, []);
    }
    emailMap.get(normalizedEmail)!.push(contact);
  });

  const uniqueContacts: Recipient[] = [];
  const duplicates: Array<{
    email: string;
    count: number;
    contacts: Recipient[];
  }> = [];

  emailMap.forEach((contactGroup, email) => {
    if (contactGroup.length === 1) {
      uniqueContacts.push(contactGroup[0]);
    } else {
      duplicates.push({
        email,
        count: contactGroup.length,
        contacts: contactGroup
      });
      // Keep the first occurrence as unique
      uniqueContacts.push(contactGroup[0]);
    }
  });

  return { uniqueContacts, duplicates };
}

/**
 * Remove duplicates, keeping the contact with most complete information
 */
export function deduplicateContacts(contacts: Recipient[]): Recipient[] {
  const emailMap = new Map<string, Recipient[]>();

  // Group by email
  contacts.forEach(contact => {
    const normalizedEmail = contact.email.toLowerCase().trim();
    if (!emailMap.has(normalizedEmail)) {
      emailMap.set(normalizedEmail, []);
    }
    emailMap.get(normalizedEmail)!.push(contact);
  });

  const deduplicated: Recipient[] = [];

  emailMap.forEach(contactGroup => {
    if (contactGroup.length === 1) {
      deduplicated.push(contactGroup[0]);
    } else {
      // Keep the contact with most complete information
      const bestContact = contactGroup.reduce((best, current) => {
        const bestScore = (best.name ? 1 : 0) + (best.company ? 1 : 0) + (best.role ? 1 : 0);
        const currentScore = (current.name ? 1 : 0) + (current.company ? 1 : 0) + (current.role ? 1 : 0);
        return currentScore > bestScore ? current : best;
      });
      deduplicated.push(bestContact);
    }
  });

  return deduplicated;
}

/**
 * Validate entire contact list
 */
export function validateContactList(contacts: Recipient[]): {
  validContacts: Recipient[];
  invalidContacts: Array<Recipient & { validationErrors: string[] }>;
  warnings: Array<{ contact: Recipient; warnings: string[] }>;
} {
  const validContacts: Recipient[] = [];
  const invalidContacts: Array<Recipient & { validationErrors: string[] }> = [];
  const warnings: Array<{ contact: Recipient; warnings: string[] }> = [];

  contacts.forEach(contact => {
    const validation = validateEmailAdvanced(contact.email);

    if (validation.isValid) {
      validContacts.push(contact);
      if (validation.warnings.length > 0) {
        warnings.push({ contact, warnings: validation.warnings });
      }
    } else {
      invalidContacts.push({
        ...contact,
        validationErrors: validation.errors
      });
    }
  });

  return { validContacts, invalidContacts, warnings };
}

/**
 * Suggest corrections for common email typos
 */
export function suggestEmailCorrections(email: string): string[] {
  if (!email) return [];

  const suggestions: string[] = [];
  const [local, domain] = email.toLowerCase().split('@');

  if (!domain) return suggestions;

  // Common domain typos
  const domainCorrections: Record<string, string[]> = {
    'gmail.com': ['gmai.com', 'gmial.com', 'gmail.co', 'gmal.com', 'gamil.com'],
    'yahoo.com': ['yaho.com', 'yahho.com', 'yahoo.co'],
    'hotmail.com': ['hotmai.com', 'hotmial.com', 'hotmail.co'],
    'outlook.com': ['outlook.co', 'outlok.com', 'outloook.com'],
  };

  // Check if domain matches any common typos
  for (const [correct, typos] of Object.entries(domainCorrections)) {
    if (typos.includes(domain)) {
      suggestions.push(`${local}@${correct}`);
    }
  }

  return suggestions;
}