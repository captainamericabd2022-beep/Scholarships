type OwnerProfile = {
  country: string;
  degree: string;
  intake: string;
  cgpa: string;
  graduation: string;
  ieltsTarget: string;
  priority: string;
};

export async function readOwnerProfile(): Promise<OwnerProfile> {
  const configured = process.env.OWNER_PROFILE_JSON ?? "";
  let values: Partial<OwnerProfile> = {};
  try { values = JSON.parse(configured || "{}"); } catch { /* Missing settings use neutral labels. */ }
  const field = (key: keyof OwnerProfile, fallback = "Not set") => typeof values?.[key] === "string" && values[key]?.trim() ? values[key]!.trim().slice(0, 200) : fallback;
  return {
    country: field("country"), degree: field("degree", "CSE"), intake: field("intake"),
    cgpa: field("cgpa"), graduation: field("graduation"), ieltsTarget: field("ieltsTarget"),
    priority: field("priority", "Full funding"),
  };
}
