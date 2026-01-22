interface GoogleSheetsContact {
  name?: string;
  email: string;
  company?: string;
  role?: string;
}

/**
 * Extract sheet ID and GID from Google Sheets URL
 */
export function extractSheetInfo(url: string): { sheetId: string; gid?: string } | null {
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+).*?(?:gid=(\d+))?/);
  if (!match) return null;

  return {
    sheetId: match[1],
    gid: match[2] || '0' // Default to first sheet (gid=0)
  };
}

/**
 * Fetch contacts from public Google Sheets
 * Uses the CSV export endpoint that doesn't require authentication
 */
export async function fetchContactsFromSheet(sheetUrl: string): Promise<GoogleSheetsContact[]> {
  try {
    const sheetInfo = extractSheetInfo(sheetUrl);
    if (!sheetInfo) {
      throw new Error('Invalid Google Sheets URL format');
    }

    const { sheetId, gid } = sheetInfo;

    // Use Google's CSV export endpoint for public sheets
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;

    console.log(`Fetching from public sheet: ${csvUrl}`);

    const response = await fetch(csvUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch sheet data: ${response.status} ${response.statusText}`);
    }

    const csvText = await response.text();

    if (!csvText.trim()) {
      throw new Error('The Google Sheet appears to be empty or not publicly accessible');
    }

    // Parse CSV using Papa Parse (imported in the component)
    return new Promise((resolve, reject) => {
      // We'll use Papa Parse in the component, but here we do basic parsing
      const lines = csvText.trim().split('\n');
      if (lines.length < 2) {
        reject(new Error('Sheet must have a header row and at least one data row'));
        return;
      }

      const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
      const contacts: GoogleSheetsContact[] = [];

      // Find column indices
      const emailIndex = headers.findIndex(h =>
        h.includes('email') || h.includes('e-mail') || h === 'mail'
      );
      const nameIndex = headers.findIndex(h =>
        h.includes('name') || h.includes('full name') || h.includes('firstname')
      );
      const companyIndex = headers.findIndex(h =>
        h.includes('company') || h.includes('organization') || h.includes('org')
      );
      const roleIndex = headers.findIndex(h =>
        h.includes('role') || h.includes('title') || h.includes('position') || h.includes('job')
      );

      if (emailIndex === -1) {
        reject(new Error('Sheet must have an email column'));
        return;
      }

      // Parse data rows
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Simple CSV parsing (handles quoted values with commas)
        const values: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let j = 0; j < line.length; j++) {
          const char = line[j];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        values.push(current.trim());

        // Remove quotes from values
        const cleanValues = values.map(v => v.replace(/^"|"$/g, ''));

        const email = cleanValues[emailIndex]?.trim();
        if (email) {
          contacts.push({
            email,
            name: nameIndex >= 0 ? cleanValues[nameIndex]?.trim() : undefined,
            company: companyIndex >= 0 ? cleanValues[companyIndex]?.trim() : undefined,
            role: roleIndex >= 0 ? cleanValues[roleIndex]?.trim() : undefined,
          });
        }
      }

      if (contacts.length === 0) {
        reject(new Error('No valid contacts found in the sheet'));
        return;
      }

      resolve(contacts);
    });

  } catch (error) {
    console.error('Error fetching from Google Sheets:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to fetch contacts from Google Sheets. Please ensure the sheet is publicly accessible and try again.');
  }
}

/**
 * Validate Google Sheets URL format
 */
export function isValidSheetsUrl(url: string): boolean {
  const pattern = /^https:\/\/docs\.google\.com\/spreadsheets\/d\/[a-zA-Z0-9-_]+/;
  return pattern.test(url.trim());
}