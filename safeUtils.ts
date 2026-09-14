/**
 * Centralized Safe Type & String Normalization Helpers
 * Prevents "Cannot read properties of undefined (reading 'replace')" and other runtime type crashes.
 */

/**
 * Safely converts any value to a trimmed string.
 * Handles undefined, null, numbers, booleans, and strings without throwing.
 * Never blindly converts objects to "[object Object]".
 */
export function safeString(value: any): string {
  if (value === undefined || value === null) {
    return '';
  }
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim();
  }
  return '';
}

/**
 * Safely parses a numeric value (e.g. "₹2,05,000", "205000", "Rs. 1,50,000.00", 205000).
 * Returns { value: number | null, isParsed: boolean, raw: any }
 * Does NOT turn invalid text into zero.
 */
export function safeNumber(value: any): { value: number | null; isParsed: boolean; raw: any } {
  if (value === undefined || value === null || value === '') {
    return { value: null, isParsed: true, raw: value };
  }
  if (typeof value === 'number') {
    if (isNaN(value)) {
      return { value: null, isParsed: false, raw: value };
    }
    return { value, isParsed: true, raw: value };
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') {
      return { value: null, isParsed: true, raw: value };
    }

    // Clean currency prefixes/suffixes and thousand separators
    const cleaned = trimmed
      .replace(/^(?:rs\.?|inr|₹|\$)\s*/i, '')
      .replace(/\s*(?:\/\-|inr)$/i, '')
      .replace(/,/g, '')
      .replace(/\s+/g, '')
      .trim();

    if (/^-?\d+(\.\d+)?$/.test(cleaned)) {
      const num = parseFloat(cleaned);
      if (!isNaN(num)) {
        return { value: num, isParsed: true, raw: value };
      }
    }

    // Fallback: extract continuous digits with optional decimal point
    const match = trimmed.replace(/,/g, '').match(/-?\d+(\.\d+)?/);
    if (match) {
      const num = parseFloat(match[0]);
      if (!isNaN(num)) {
        return { value: num, isParsed: true, raw: value };
      }
    }

    return { value: null, isParsed: false, raw: value };
  }
  return { value: null, isParsed: false, raw: value };
}

/**
 * Safely formats dates to DD-MM-YYYY or preserves valid date strings.
 * Never throws on undefined or non-string values.
 */
export function safeDate(value: any): string {
  const str = safeString(value);
  if (!str) return '';

  // If date is like DD/MM/YY or DD/MM/YYYY or DD-MM-YYYY
  const slashParts = str.split(/[/\-\.]/);
  if (slashParts.length === 3) {
    let day = slashParts[0].padStart(2, '0');
    let month = slashParts[1].padStart(2, '0');
    let year = slashParts[2];
    if (year.length === 2) {
      year = `20${year}`;
    }
    if (day.length === 2 && month.length === 2 && year.length === 4) {
      return `${day}-${month}-${year}`;
    }
  }
  return str;
}

/**
 * Safely strips Base64 data URL prefixes without throwing.
 */
export function safeCleanBase64(value: any): string {
  if (typeof value !== 'string') return '';
  return value.replace(/^data:[^;]+;base64,/, '').trim();
}

/**
 * Maps Roman numerals, Arabic numbers, or raw text to standardized installment Nature:
 * 1 / I -> "First"
 * 2 / II -> "Second"
 * 3 / III -> "Third"
 * 4 / IV -> "Fourth"
 * 5 / V -> "Fifth"
 * etc.
 */
export function installmentToNature(installment: any): string {
  const str = safeString(installment).trim();
  if (!str) return 'First';

  // Clean prefixes like "Installment II" or "Inst. 2"
  const clean = str.toUpperCase().replace(/^INSTALLMENT\s*[-–:]*\s*|^INST\.?\s*[-–:]*\s*/i, '').trim();

  const ordinalMap: Record<string, string> = {
    '1': 'First',
    'I': 'First',
    '1ST': 'First',
    'FIRST': 'First',
    '2': 'Second',
    'II': 'Second',
    '2ND': 'Second',
    'SECOND': 'Second',
    '3': 'Third',
    'III': 'Third',
    '3RD': 'Third',
    'THIRD': 'Third',
    '4': 'Fourth',
    'IV': 'Fourth',
    '4TH': 'Fourth',
    'FOURTH': 'Fourth',
    '5': 'Fifth',
    'V': 'Fifth',
    '5TH': 'Fifth',
    'FIFTH': 'Fifth',
    '6': 'Sixth',
    'VI': 'Sixth',
    '6TH': 'Sixth',
    '7': 'Seventh',
    'VII': 'Seventh',
    '7TH': 'Seventh',
    '8': 'Eighth',
    'VIII': 'Eighth',
    '8TH': 'Eighth',
    '9': 'Ninth',
    'IX': 'Ninth',
    '9TH': 'Ninth',
    '10': 'Tenth',
    'X': 'Tenth',
    '10TH': 'Tenth',
  };

  if (ordinalMap[clean]) {
    return ordinalMap[clean];
  }

  const num = parseInt(clean, 10);
  if (!isNaN(num) && ordinalMap[String(num)]) {
    return ordinalMap[String(num)];
  }

  return str;
}

/**
 * Returns the exact Nature value for a payment split transaction:
 * Transaction 0: baseNature (e.g. "First" or "Second")
 * Transaction 1: `${baseNature}-1` (e.g. "First-1" or "Second-1")
 * Transaction 2: `${baseNature}-2` (e.g. "First-2" or "Second-2")
 * Transaction 3: `${baseNature}-3` (e.g. "First-3" or "Second-3")
 * Transaction 4: `${baseNature}-4` (e.g. "Second-4")
 */
export function formatSplitNature(baseNature: string, splitIndex: number): string {
  const base = installmentToNature(baseNature) || 'First';
  if (splitIndex <= 0) {
    return base;
  }
  return `${base}-${splitIndex}`;
}

/**
 * Derives payment month string like "Aug26" or "Feb26" from a date string.
 */
export function derivePaymentMonth(dateStr: any): string {
  const str = safeDate(dateStr);
  if (!str) return '';

  const parts = str.split('-');
  if (parts.length === 3) {
    const monthNum = parseInt(parts[1], 10);
    const yearStr = parts[2].slice(-2);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    if (monthNum >= 1 && monthNum <= 12) {
      return `${months[monthNum - 1]}${yearStr}`;
    }
  }
  return '';
}

