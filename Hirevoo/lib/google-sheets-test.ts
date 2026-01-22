// Test script for Google Sheets integration
// Run with: npx tsx lib/google-sheets-test.ts

import { fetchContactsFromSheet, isValidSheetsUrl } from './google-sheets';

// Example public Google Sheet URL
const testUrl = 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=0';

console.log('Testing Google Sheets URL validation...');
console.log('URL is valid:', isValidSheetsUrl(testUrl));

console.log('\nTesting contact fetching...');
// Note: This will only work if the sheet is publicly accessible
// fetchContactsFromSheet(testUrl)
//   .then(contacts => {
//     console.log('Fetched contacts:', contacts);
//   })
//   .catch(error => {
//     console.error('Error:', error.message);
//   });