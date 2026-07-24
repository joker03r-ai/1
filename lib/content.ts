// Черновики контента — общий склад материалов между разделами
// «Парсинг», «Контент» и «Продвижение». Из черновика пост попадает в
// «Календарь» (становится запланированной публикацией) или в кампанию.

export type Draft = {
  id: string;
  text: string;
  type: string; // Текст, Изображение, Текст + фото, ...
  source?: string; // откуда: «Парсинг», «Создан вручную», «ИИ», «Контент-план»
  image?: string; // data-URI превью (для картинок)
  createdAt: number;
};

const KEY = "sb_drafts";

export function loadDrafts(): Draft[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]") as Draft[];
  } catch {
    return [];
  }
}

export function saveDrafts(list: Draft[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
}

export function did(): string {
  return "d_" + Math.random().toString(36).slice(2, 9);
}

export function addDraft(text: string, type = "Текст", source = "Создан вручную", image?: string): Draft {
  const d: Draft = { id: did(), text, type, source, image, createdAt: Date.now() };
  saveDrafts([d, ...loadDrafts()]);
  return d;
}

export function addDrafts(items: { text: string; type?: string; image?: string }[], source = "ИИ"): Draft[] {
  const created = items.map((it) => ({ id: did(), text: it.text, type: it.type || "Текст", image: it.image, source, createdAt: Date.now() }));
  saveDrafts([...created, ...loadDrafts()]);
  return created;
}

export function updateDraft(id: string, patch: Partial<Draft>) {
  saveDrafts(loadDrafts().map((d) => (d.id === id ? { ...d, ...patch } : d)));
}

export function removeDraft(id: string) {
  saveDrafts(loadDrafts().filter((d) => d.id !== id));
}
