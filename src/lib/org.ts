import { getAdminSession } from "@/lib/auth/admin";
import { DEFAULT_ORG_ID } from "@/lib/org-constants";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export { DEFAULT_ORG_ID, SECOND_ORG_ID } from "@/lib/org-constants";

export type Organization = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
};

type OrgMode = "unknown" | "enabled" | "disabled";
let orgMode: OrgMode = "unknown";

/** Есть ли multi-org в БД (таблица organizations). */
export async function isMultiOrgEnabled(): Promise<boolean> {
  if (orgMode === "enabled") return true;
  if (orgMode === "disabled") return false;

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    orgMode = "disabled";
    return false;
  }

  const { error } = await supabase.from("organizations").select("id").limit(1);
  if (error) {
    orgMode = "disabled";
    return false;
  }
  orgMode = "enabled";
  return true;
}

export function resetOrgModeCache() {
  orgMode = "unknown";
}

export async function listOrganizations(): Promise<Organization[]> {
  if (!(await isMultiOrgEnabled())) {
    return [
      {
        id: DEFAULT_ORG_ID,
        name: "Основной центр",
        slug: "default",
        is_active: true,
      },
    ];
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, slug, is_active")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as Organization[];
}

/**
 * Текущий филиал для админских запросов.
 * null = multi-org выключен (legacy, без фильтра).
 */
export async function getAdminOrgId(): Promise<string | null> {
  const multi = await isMultiOrgEnabled();
  if (!multi) return null;

  const session = await getAdminSession();
  if (session?.org_id) return session.org_id;

  return DEFAULT_ORG_ID;
}

/** Добавить organization_id в insert, если multi-org. */
export async function orgInsertFields(
  orgId?: string | null,
): Promise<Record<string, string>> {
  if (!(await isMultiOrgEnabled())) return {};
  const id = orgId ?? DEFAULT_ORG_ID;
  return { organization_id: id };
}
