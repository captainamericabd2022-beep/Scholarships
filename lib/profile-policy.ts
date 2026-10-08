import { sharedAdministratorDataKey } from "./auth-policy";

export const profileFields = ["country", "degree", "intake", "cgpa", "graduation", "ieltsTarget", "priority", "currentStatus", "preferredFields", "workExperience"] as const;
export type ApplicantProfile = Record<(typeof profileFields)[number], string>;
export function neutralProfile(): ApplicantProfile { return Object.fromEntries(profileFields.map((key) => [key, ""])) as ApplicantProfile; }
export function profileDataKey(email: string, owner: string | undefined, admins: string | undefined) {
  return sharedAdministratorDataKey(email, owner, admins) ?? `profile:${email.trim().toLowerCase()}`;
}
export function validateProfile(input: unknown): ApplicantProfile {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Supply a profile object.");
  const values = input as Record<string, unknown>;
  if (Object.keys(values).some((key) => !profileFields.includes(key as typeof profileFields[number]))) throw new Error("Unknown profile field. Account email and access permissions cannot be changed here.");
  const profile = neutralProfile();
  for (const field of profileFields) {
    const value = values[field] ?? "";
    if (typeof value !== "string" || value.length > 500 || [...value].some((character) => character.charCodeAt(0) < 32 && ![9, 10, 13].includes(character.charCodeAt(0)))) throw new Error(`${field}: enter text of at most 500 characters.`);
    profile[field] = value.trim();
  }
  return profile;
}
