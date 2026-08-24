import { getSupabaseServerClient } from "@/lib/supabase/server";

/** Chat IDs from env TELEGRAM_ADMIN_CHAT_IDS=123,456 */
export function envAdminChatIds(): number[] {
  const raw = process.env.TELEGRAM_ADMIN_CHAT_IDS ?? "";
  return raw
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n) && n !== 0);
}

export async function listAdminChatIds(): Promise<number[]> {
  const fromEnv = envAdminChatIds();
  const supabase = getSupabaseServerClient();
  if (!supabase) return fromEnv;

  const { data, error } = await supabase
    .from("telegram_admin_chats")
    .select("chat_id");

  if (error) {
    // table may not exist yet
    return fromEnv;
  }

  const fromDb = (data ?? [])
    .map((r) => Number((r as { chat_id: number | string }).chat_id))
    .filter((n) => Number.isFinite(n));

  return Array.from(new Set([...fromEnv, ...fromDb]));
}

export async function linkAdminChat(
  chatId: number,
  username?: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return {
      ok: false,
      error:
        "БД не настроена. Добавь chat_id в TELEGRAM_ADMIN_CHAT_IDS на Vercel.",
    };
  }

  const { error } = await supabase.from("telegram_admin_chats").upsert(
    {
      chat_id: chatId,
      username: username ?? null,
      linked_at: new Date().toISOString(),
    },
    { onConflict: "chat_id" },
  );

  if (error) {
    return {
      ok: false,
      error:
        "Таблица telegram_admin_chats не готова. База ещё не настроена.",
    };
  }
  return { ok: true };
}

export async function unlinkAdminChat(chatId: number): Promise<void> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return;
  await supabase.from("telegram_admin_chats").delete().eq("chat_id", chatId);
}
