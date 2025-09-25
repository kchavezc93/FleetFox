import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Formats a date-only value (e.g., '2025-01-15' or Date) as dd-MM-yyyy without timezone drift
export function formatDateDDMMYYYY(value: string | Date): string {
  try {
    if (!value) return '';
    let y = 0, m = 0, d = 0;
    if (typeof value === 'string') {
      // Expecting YYYY-MM-DD; split safely and avoid Date parsing to prevent TZ shifts
      const parts = value.split('T')[0].split('-');
      if (parts.length === 3) {
        y = parseInt(parts[0], 10);
        m = parseInt(parts[1], 10);
        d = parseInt(parts[2], 10);
      } else {
        // Fallback to Date if not in expected format
        const dt = new Date(value);
        y = dt.getFullYear();
        m = dt.getMonth() + 1;
        d = dt.getDate();
      }
    } else {
      y = value.getFullYear();
      m = value.getMonth() + 1;
      d = value.getDate();
    }
    const dd = d.toString().padStart(2, '0');
    const mm = m.toString().padStart(2, '0');
    return `${dd}-${mm}-${y}`;
  } catch {
    return '';
  }
}
