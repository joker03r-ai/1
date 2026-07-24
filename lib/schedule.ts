// Запланированные публикации (расписание постинга).

export type PostStatus = "draft" | "planned" | "published" | "review" | "paused" | "error";

export const STATUS_LABELS: Record<PostStatus, string> = {
  draft: "Черновик",
  planned: "Запланировано",
  published: "Опубликовано",
  review: "На согласовании",
  paused: "Приостановлено",
  error: "Ошибка",
};

// Единая палитра статусов (класс + подпись + цвет-точка).
export const STATUS_META: Record<PostStatus, { label: string; cls: string }> = {
  draft: { label: "Черновик", cls: "s-draft" },
  planned: { label: "Запланировано", cls: "s-planned" },
  published: { label: "Опубликовано", cls: "s-published" },
  review: { label: "На согласовании", cls: "s-review" },
  paused: { label: "Приостановлено", cls: "s-paused" },
  error: { label: "Ошибка", cls: "s-error" },
};

export type ScheduledPost = {
  id: string;
  text: string;
  channel: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM (по базовому городу)
  cityId: string; // базовый город (часовой пояс)
  regionMode: "sim" | "local"; // одновременно / по местному времени
  repeat: string;
  type: string; // тип контента
  status: PostStatus;
  // Дополнительно (новый редактор контента)
  title?: string; // заголовок / краткое имя
  image?: string; // data-URI миниатюры
  createdBy?: "manual" | "ai"; // способ создания
  author?: string; // автор
  cta?: string; // призыв к действию
  buttons?: { text: string; url: string }[]; // инлайн-кнопки
};

const KEY = "sb_schedule";

export function loadPosts(): ScheduledPost[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]") as ScheduledPost[];
  } catch {
    return [];
  }
}

export function savePosts(list: ScheduledPost[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
}

export function pid(): string {
  return "p_" + Math.random().toString(36).slice(2, 9);
}

export function upsertPost(p: ScheduledPost) {
  const list = loadPosts();
  const i = list.findIndex((x) => x.id === p.id);
  if (i >= 0) list[i] = p;
  else list.push(p);
  savePosts(list);
  return list;
}

export function removePost(id: string) {
  const list = loadPosts().filter((x) => x.id !== id);
  savePosts(list);
  return list;
}
