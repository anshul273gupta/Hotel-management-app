// All Record keys use `string` for SQLite compatibility (no native enums).

export const ID_PROOF_TYPES = [
  "Aadhaar Card",
  "PAN Card",
  "Passport",
  "Driving License",
  "Voter ID",
  "Other",
] as const;

/** Strips spaces/hyphens and uppercases an ID proof number before format validation. */
export function normalizeIdProofNumber(value: string): string {
  return value.replace(/[\s-]/g, "").toUpperCase();
}

/** Validation rules for each Indian ID proof type, applied to the normalized number. */
export const ID_PROOF_PATTERNS: Record<
  (typeof ID_PROOF_TYPES)[number],
  { regex: RegExp; message: string; label: string; placeholder: string; maxLength: number }
> = {
  "Aadhaar Card": {
    regex: /^[2-9][0-9]{11}$/,
    message: "Enter a valid 12-digit Aadhaar number",
    label: "Aadhaar Number",
    placeholder: "12-digit Aadhaar number",
    maxLength: 14,
  },
  "PAN Card": {
    regex: /^[A-Z]{5}[0-9]{4}[A-Z]$/,
    message: "Enter a valid PAN number (format: ABCDE1234F)",
    label: "PAN Number",
    placeholder: "5 letters + 4 digits + 1 letter",
    maxLength: 10,
  },
  Passport: {
    regex: /^[A-Z][0-9]{7}$/,
    message: "Enter a valid Indian passport number (1 letter + 7 digits)",
    label: "Passport Number",
    placeholder: "1 letter followed by 7 digits",
    maxLength: 8,
  },
  "Driving License": {
    regex: /^[A-Z]{2}[0-9]{13}$/,
    message: "Enter a valid driving licence number (state code + 13 digits)",
    label: "Driving Licence Number",
    placeholder: "State code + 13 digits",
    maxLength: 20,
  },
  "Voter ID": {
    regex: /^[A-Z]{3}[0-9]{7}$/,
    message: "Enter a valid Voter ID / EPIC number (3 letters + 7 digits)",
    label: "Voter ID / EPIC Number",
    placeholder: "3 letters + 7 digits",
    maxLength: 10,
  },
  Other: {
    regex: /^[A-Z0-9]{3,20}$/,
    message: "Enter a valid ID proof number",
    label: "ID Number",
    placeholder: "ID proof number",
    maxLength: 20,
  },
};

export const EXPENSE_CATEGORIES = [
  "Utilities",
  "Salaries",
  "Maintenance",
  "Supplies",
  "Food & Beverage",
  "Marketing",
  "Other",
] as const;

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  CARD: "Card",
  UPI: "UPI",
  BANK_TRANSFER: "Bank Transfer",
  OTHER: "Other",
};

export const ROOM_TYPE_LABELS: Record<string, string> = {
  DELUXE: "Deluxe",
  PREMIUM: "Premium",
  SUITE: "Suite",
};

export const ROOM_STATUS_LABELS: Record<string, string> = {
  AVAILABLE: "Available",
  RESERVED: "Reserved",
  OCCUPIED: "Occupied",
  MAINTENANCE: "Maintenance",
};

export const ROOM_STATUS_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  AVAILABLE: {
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    border: "border-emerald-300 dark:border-emerald-800",
    text: "text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  RESERVED: {
    bg: "bg-pink-50 dark:bg-pink-950/40",
    border: "border-pink-300 dark:border-pink-800",
    text: "text-pink-700 dark:text-pink-300",
    dot: "bg-pink-500",
  },
  OCCUPIED: {
    bg: "bg-rose-50 dark:bg-rose-950/40",
    border: "border-rose-300 dark:border-rose-800",
    text: "text-rose-700 dark:text-rose-300",
    dot: "bg-rose-500",
  },
  MAINTENANCE: {
    bg: "bg-orange-50 dark:bg-orange-950/40",
    border: "border-orange-300 dark:border-orange-800",
    text: "text-orange-700 dark:text-orange-300",
    dot: "bg-orange-500",
  },
};

export const CLEANING_STATUS_LABELS: Record<string, string> = {
  CLEAN: "Clean",
  CLEANING_IN_PROGRESS: "Cleaning In Progress",
  DIRTY: "Dirty",
};

export const MAINTENANCE_STATUS_LABELS: Record<string, string> = {
  OK: "OK",
  NEEDS_MAINTENANCE: "Needs Maintenance",
  UNDER_MAINTENANCE: "Under Maintenance",
};

export const SERVICE_REQUEST_TYPE_LABELS: Record<string, string> = {
  HOUSEKEEPING: "Housekeeping",
  EXTRA_TOWELS: "Extra Duvet / Towels",
  WATER_BOTTLE: "Water Bottle",
  TEA_COFFEE: "Tea / Coffee",
  TAXI_BOOKING: "Taxi Booking",
  TEMPLE_INFO: "Temple Darshan Information",
  CALL_RECEPTION: "Call Reception",
  CUSTOM: "Custom Request",
};

export const SERVICE_REQUEST_TYPE_ICONS: Record<string, string> = {
  HOUSEKEEPING: "🧹",
  EXTRA_TOWELS: "🛏",
  WATER_BOTTLE: "💧",
  TEA_COFFEE: "☕",
  TAXI_BOOKING: "🚕",
  TEMPLE_INFO: "🙏",
  CALL_RECEPTION: "📞",
  CUSTOM: "📝",
};

export const SERVICE_REQUEST_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
};

export const SERVICE_REQUEST_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
  ASSIGNED: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  IN_PROGRESS: "bg-pink-100 text-pink-700 dark:bg-pink-950/50 dark:text-pink-300",
  COMPLETED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
};

export const BOOKING_STATUS_LABELS: Record<string, string> = {
  RESERVED: "Reserved",
  CHECKED_IN: "Checked In",
  CHECKED_OUT: "Checked Out",
  CANCELLED: "Cancelled",
};

export const BOOKING_STATUS_COLORS: Record<string, string> = {
  RESERVED: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  CHECKED_IN: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  CHECKED_OUT: "bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300",
  CANCELLED: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PAID: "Paid",
  PARTIAL: "Partial",
  PENDING: "Pending",
};

export const PAYMENT_STATUS_COLORS: Record<string, string> = {
  PAID: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  PARTIAL: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  PENDING: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
};

export const ROLE_LABELS: Record<string, string> = {
  STAFF: "Staff",
  MANAGER: "Manager",
  OWNER: "Anand Gupta",
};
