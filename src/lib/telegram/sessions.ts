import { getSupabaseServerClient } from "@/lib/supabase/server";

export type TgBotKind = "student" | "admin" | "teacher";

export type TgSession = {
  chat_id: number;
  bot: TgBotKind;
  state: string;
  data: Record<string, unknown>;
};

export async function getTgSession(
  chatId: number,
  bot: TgBotKind = "student",
): Promise<TgSession> {
  const empty: TgSession = { chat_id: chatId, bot, state: "", data: {} };
  const supabase = getSupabaseServerClient();
  if (!supabase) return empty;

  const { data, error } = await supabase
    .from("telegram_sessions")
    .select("chat_id, bot, state, data")
    .eq("chat_id", chatId)
    .eq("bot", bot)
    .maybeSingle();

  if (error || !data) return empty;
  return {
    chat_id: Number(data.chat_id),
    bot: (data.bot as TgBotKind) || bot,
    state: data.state || "",
    data: (data.data as Record<string, unknown>) || {},
  };
}

export async function setTgSession(
  chatId: number,
  bot: TgBotKind,
  state: string,
  data: Record<string, unknown> = {},
): Promise<void> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return;

  await supabase.from("telegram_sessions").upsert(
    {
      chat_id: chatId,
      bot,
      state,
      data,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "chat_id,bot" },
  );
}

export async function clearTgSession(
  chatId: number,
  bot: TgBotKind = "student",
): Promise<void> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return;
  await supabase
    .from("telegram_sessions")
    .delete()
    .eq("chat_id", chatId)
    .eq("bot", bot);
}

export async function patchTgSession(
  chatId: number,
  bot: TgBotKind,
  state: string,
  patch: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const cur = await getTgSession(chatId, bot);
  const data = { ...cur.data, ...patch };
  await setTgSession(chatId, bot, state, data);
  return data;
}
