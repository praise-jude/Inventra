// Framework-free validators shared by the signup form (inline, as-you-type
// errors) and the `registerAccount` server action (authoritative check —
// never trust the client). Keep these pure so they work in both bundles.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateFullName(value: string): string | null {
  const v = value.trim();
  if (!v) return "Full name is required.";
  if (v.length < 3) return "Full name must be at least 3 characters.";
  return null;
}

export function validateEmail(value: string): string | null {
  const v = value.trim();
  if (!v) return "Email is required.";
  if (!EMAIL_RE.test(v)) return "Enter a valid email address.";
  return null;
}

export function validateBusinessEmail(value: string): string | null {
  const v = value.trim();
  if (!v) return null; // optional
  if (!EMAIL_RE.test(v)) return "Enter a valid business email address.";
  return null;
}

export interface PasswordRule {
  key: string;
  label: string;
  test: (pw: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  { key: "length", label: "At least 8 characters", test: (pw) => pw.length >= 8 },
  { key: "upper", label: "One uppercase letter", test: (pw) => /[A-Z]/.test(pw) },
  { key: "lower", label: "One lowercase letter", test: (pw) => /[a-z]/.test(pw) },
  { key: "number", label: "One number", test: (pw) => /\d/.test(pw) },
  { key: "special", label: "One special character", test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];

export function passwordStrength(pw: string): number {
  return PASSWORD_RULES.filter((r) => r.test(pw)).length;
}

export function validatePassword(pw: string): string | null {
  const unmet = PASSWORD_RULES.filter((r) => !r.test(pw));
  if (unmet.length > 0) return `Password must have: ${unmet.map((r) => r.label.toLowerCase()).join(", ")}.`;
  return null;
}

export function validateBusinessName(value: string): string | null {
  if (!value.trim()) return "Business name is required.";
  return null;
}

export function validateRequiredSelect(value: string, label: string): string | null {
  if (!value) return `${label} is required.`;
  return null;
}
