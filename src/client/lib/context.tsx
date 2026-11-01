import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { I18N, KINDS } from "./messages";
import { api, store } from "./api";
export type Language = "vi" | "en";
type AppContext = {
  lang: Language;
  setLang: (lang: Language) => void;
  theme: string;
  setTheme: (theme: string) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  kindLabel: (kind: string) => string;
  revision: number;
  refresh: () => void;
  notify: (message: string) => void;
};
const Context = createContext<AppContext | null>(null);
export function Provider({ children }: { children: ReactNode }) {
  const [lang, changeLang] = useState<Language>(
    store.get("if_lang") === "en" ? "en" : "vi",
  );
  const [theme, changeTheme] = useState(store.get("if_theme", "auto"));
  const [revision, setRevision] = useState(0);
  const [message, setMessage] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.classList.toggle(
        "dark",
        theme === "dark" || (theme === "auto" && media.matches),
      );
      document.documentElement.lang = lang;
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [lang, theme]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const t = (key: string, vars?: Record<string, string | number>) => {
    const dict: Record<string, string> = I18N[lang];
    let result = dict[key] ?? key;
    for (const [key, value] of Object.entries(vars ?? {}))
      result = result.replace(`{${key}}`, String(value));
    return result;
  };
  return (
    <Context.Provider
      value={{
        lang,
        theme,
        t,
        setLang: (value) => {
          store.set("if_lang", value);
          changeLang(value);
        },
        setTheme: (value) => {
          store.set("if_theme", value);
          changeTheme(value);
        },
        kindLabel: (kind) =>
          (KINDS[lang] as Record<string, string>)[kind] ?? kind,
        revision,
        refresh: () => setRevision((n) => n + 1),
        notify: (message) => {
          setMessage(message);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setMessage(""), 4000);
        },
      }}
    >
      {children}
      <div
        role="status"
        aria-live="polite"
        className={message ? "toast" : "sr-only"}
      >
        {message}
      </div>
    </Context.Provider>
  );
}
export function useApp() {
  const context = useContext(Context);
  if (!context) throw new Error("Missing app provider");
  return context;
}
export function useResource<T>(path: string) {
  const { revision } = useApp();
  const [state, setState] = useState<{
    data?: T;
    error?: string;
    path?: string;
  }>({});
  useEffect(() => {
    let current = true;
    api<T>(path)
      .then((data) => {
        if (current) setState({ data, path });
      })
      .catch((error) => {
        if (current) setState({ error: String(error.message), path });
      });
    return () => {
      current = false;
    };
  }, [path, revision]);
  return state.path === path ? state : {};
}
export function useTask() {
  const { notify } = useApp();
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const run = async (task: () => Promise<unknown>) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      await task();
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return { busy, run };
}
export function useDebounced(value: string) {
  const [result, setResult] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setResult(value), 220);
    return () => clearTimeout(timer);
  }, [value]);
  return result;
}
