/**
 * AI & Data Privacy Sanitizer
 * This utility ensures sensitive information (PII) is removed before sending to external AI providers.
 */

const SENSITIVE_FIELD_KEYS = [
  'name', 'customer_name', 'contact_person', 'partner_name', 
  'email', 'contact', 'phone', 'address', 'recipient_address',
  'broker_name', 'tracking_no', 'bill_no', 'declaration_no',
  'file_name', 'target', 'title', 'passport_no', 'bank_info', 'id_card'
];

/**
 * Clean strings for generic emails and phone numbers using Regex
 */
function scrubText(text: string): string {
  if (!text || typeof text !== 'string') return text;
  
  return text
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_HIDDEN]') // Scrape Emails
    .replace(/\+?\d{8,15}/g, '[SENSITIVE_DATA_HIDDEN]') // Scrape long digit sequences (phones, accounts)
    .replace(/\b\d{16,19}\b/g, '[CARD_HIDDEN]'); // Scrape Card Numbers
}

/**
 * Recursively sanitizes objects/arrays for AI consumption
 */
export function sanitizeForAI(data: any): any {
  if (data === null || data === undefined) return data;

  // Handle Arrays
  if (Array.isArray(data)) {
    return data.map(item => sanitizeForAI(item));
  }

  // Handle Objects
  if (typeof data === 'object') {
    const sanitized: any = {};
    for (const key in data) {
      const lowerKey = key.toLowerCase();
      
      // Specialized logic for specific fields
      if (SENSITIVE_FIELD_KEYS.includes(lowerKey)) {
        const val = data[key];
        
        if (!val) {
          sanitized[key] = val;
        } else if (lowerKey.includes('email')) {
          sanitized[key] = '[EMAIL_REDACTED]';
        } else if (lowerKey.includes('phone') || lowerKey.includes('contact')) {
          sanitized[key] = '[CONTACT_REDACTED]';
        } else if (lowerKey.includes('address')) {
          // Keep only the last part (usually Country/City) if possible, else redact
          const parts = String(val).split(',');
          sanitized[key] = parts.length > 1 ? `[STREET_REDACTED], ${parts[parts.length - 1].trim()}` : '[ADDRESS_REDACTED]';
        } else {
          sanitized[key] = `[${key.toUpperCase()}_REDACTED]`;
        }
      } else if (typeof data[key] === 'string') {
        // For general text fields (like remarks or follow-up content), perform regex scrubbing
        sanitized[key] = scrubText(data[key]);
      } else {
        // Recursive dive
        sanitized[key] = sanitizeForAI(data[key]);
      }
    }
    return sanitized;
  }

  return data;
}

/**
 * Mask string for UI display (e.g., j***@example.com)
 */
export function maskString(str: string, type: 'email' | 'phone' | 'text' = 'text'): string {
  if (!str) return '—';
  if (type === 'email') {
    const [name, domain] = str.split('@');
    return `${name.slice(0, 2)}***@${domain}`;
  }
  if (type === 'phone') {
    return str.replace(/(\d{3})\d+(\d{4})/, '$1****$2');
  }
  return str.slice(0, 1) + '***' + str.slice(-1);
}
