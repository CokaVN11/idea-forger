export const store = {
  get(key: string, fallback = "") {
    try {
      return localStorage.getItem(key) ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* Storage may be disabled. */
    }
  },
  del(key: string) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* Storage may be disabled. */
    }
  },
};
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${store.get("if_token")}`,
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status === 401) {
    store.del("if_token");
    window.dispatchEvent(new Event("idea-forge:logout"));
    throw new Error("Unauthorized");
  }
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || response.statusText);
  return data as T;
}
export const go = (path: string) => {
  location.hash = path;
};
export const tagsToArr = (value: FormDataEntryValue | null) =>
  String(value ?? "")
    .split(/[,\n]/)
    .map((s) => s.trim().replace(/^#/, ""))
    .filter(Boolean);
export function formBody(form: HTMLFormElement) {
  const data = new FormData(form);
  const body: Record<string, unknown> = Object.fromEntries(data);
  if (data.has("tags")) body.tags = tagsToArr(data.get("tags"));
  return body;
}
export function todayStr() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}
