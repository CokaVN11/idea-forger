import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  CheckCheck,
  FlaskConical,
  Inbox as InboxIcon,
  LayoutDashboard,
  Library as LibraryIcon,
  Plus,
  LoaderCircle,
  Settings as SettingsIcon,
  Sprout,
} from "lucide-react";
import { go, store } from "./lib/api";
import { useApp, useResource, useTask } from "./lib/context";
import type { Stats } from "./lib/types";
import { Button, Field, Input, Panel } from "./components/shared";
import { NavigationIcon } from "./components/navigation-icon";
import { Dashboard } from "./pages/dashboard";
import { Capture } from "./pages/capture";
import { Inbox } from "./pages/inbox";
import { Review } from "./pages/review";
import { Library, Timeline } from "./pages/library";
import { NotePage } from "./pages/note";
import { Spark } from "./pages/spark";
import { Ship } from "./pages/ship";
import { Settings } from "./pages/settings";
export function App() {
  const [token, setToken] = useState(store.get("if_token"));
  useEffect(() => {
    const logout = () => setToken("");
    window.addEventListener("idea-forge:logout", logout);
    return () => window.removeEventListener("idea-forge:logout", logout);
  }, []);
  return token ? <Shell /> : <Login onLogin={setToken} />;
}
function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark" aria-hidden="true">
        <Sprout />
      </span>
      Idea Forge
    </div>
  );
}
function Login({ onLogin }: { onLogin: (token: string) => void }) {
  const { t, lang, setLang } = useApp();
  const { busy, run } = useTask();
  const [error, setError] = useState("");
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const token = String(new FormData(event.currentTarget).get("token") ?? "");
    void run(async () => {
      setError("");
      const response = await fetch("/api/ping", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        setError(
          response.status === 401
            ? t("bad_token")
            : `${response.status} ${response.statusText}`,
        );
        return;
      }
      store.set("if_token", token);
      onLogin(token);
    });
  };
  return (
    <main className="login">
      <Panel>
        <Brand />
        <h1>{t("login_title")}</h1>
        <p className="small muted">
          {lang === "vi"
            ? "Nhập API token của bạn để mở kho ý tưởng."
            : "Enter your API token to open your idea library."}
        </p>
        <form onSubmit={submit}>
          <fieldset disabled={busy}>
            <Field label={t("token")}>
              <Input
                name="token"
                type="password"
                autoComplete="current-password"
                spellCheck={false}
                aria-invalid={!!error}
                aria-describedby={error ? "login-error" : undefined}
                required
              />
            </Field>
            <div className="row between">
              <Button type="submit" aria-busy={busy}>
                {busy && (
                  <LoaderCircle
                    className="loading-spinner"
                    aria-hidden="true"
                  />
                )}
                {t("unlock")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setLang(lang === "vi" ? "en" : "vi")}
              >
                {lang === "vi" ? "English" : "Tiếng Việt"}
              </Button>
            </div>
            {error && (
              <p id="login-error" role="alert" className="danger">
                {error}
              </p>
            )}
          </fieldset>
        </form>
      </Panel>
    </main>
  );
}
function Shell() {
  const { t, lang, setLang } = useApp();
  const [hash, setHash] = useState(location.hash || "#/");
  const main = useRef<HTMLElement>(null);
  const { data: stats } = useResource<Stats>("/stats");
  const raw = hash.slice(1);
  const question = raw.indexOf("?");
  const path = question < 0 ? raw : raw.slice(0, question);
  const query = new URLSearchParams(
    question < 0 ? "" : raw.slice(question + 1),
  );
  const parts = path.split("/").filter(Boolean);
  const page = parts[0] || "";
  useEffect(() => {
    const change = () => {
      setHash(location.hash || "#/");
      window.scrollTo(0, 0);
      main.current?.focus({ preventScroll: true });
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    function key(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        const form = target.closest("form");
        if (form) {
          event.preventDefault();
          form.requestSubmit(
            form.querySelector<HTMLButtonElement>('button[type="submit"]') ??
              undefined,
          );
        }
        return;
      }
      if (
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        target.closest("input,textarea,select,[contenteditable]")
      )
        return;
      if (event.key === "c") {
        event.preventDefault();
        go("/capture");
      }
      if (event.key === "/") {
        event.preventDefault();
        go("/library?focus=1");
      }
    }
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);
  // Same five destinations on desktop and mobile; sub-views use SectionTabs.
  const tabs = [
    { href: "/", label: "dashboard", Icon: LayoutDashboard, also: [] },
    {
      href: "/inbox",
      label: "distill",
      Icon: InboxIcon,
      also: ["review"],
      badge: stats ? stats.stages.inbox + stats.reviews_due : 0,
    },
    {
      href: "/library",
      label: "library",
      Icon: LibraryIcon,
      also: ["note", "timeline"],
    },
    { href: "/spark", label: "spark", Icon: FlaskConical, also: [] },
    { href: "/ship", label: "ship", Icon: CheckCheck, also: [] },
  ] as const;
  const isActive = (tab: (typeof tabs)[number]) =>
    path === tab.href || (tab.also as readonly string[]).includes(page);
  let content;
  switch (page) {
    case "capture":
      content = <Capture query={query} />;
      break;
    case "inbox":
      content = <Inbox />;
      break;
    case "review":
      content = <Review />;
      break;
    case "library":
      content = <Library query={query} />;
      break;
    case "timeline":
      content = <Timeline query={query} />;
      break;
    case "note":
      content = <NotePage key={parts[1]} id={Number(parts[1])} />;
      break;
    case "spark":
      content = <Spark />;
      break;
    case "ship":
      content = <Ship />;
      break;
    case "settings":
      content = <Settings />;
      break;
    default:
      content = <Dashboard />;
  }
  return (
    <>
      <a
        href="#main"
        className="skip-link"
        onClick={(event) => {
          event.preventDefault();
          main.current?.focus();
        }}
      >
        {lang === "vi" ? "Đến nội dung" : "Skip to content"}
      </a>
      <div className="shell">
        <aside
          className="sidebar"
          aria-label={lang === "vi" ? "Điều hướng" : "Navigation"}
        >
          <Brand />
          <Button className="side-capture" asChild>
            <a
              href="#/capture"
              aria-current={page === "capture" ? "page" : undefined}
            >
              <Plus aria-hidden="true" />
              {t("capture")}
            </a>
          </Button>
          <nav aria-label={lang === "vi" ? "Điều hướng chính" : "Main navigation"}>
            {tabs.map((tab) => (
              <a
                key={tab.href}
                href={`#${tab.href}`}
                aria-current={isActive(tab) ? "page" : undefined}
              >
                <span className="nav-title">
                  <tab.Icon aria-hidden="true" />
                  {t(tab.label)}
                </span>
                {"badge" in tab && tab.badge > 0 && (
                  <span className="nav-badge">{tab.badge}</span>
                )}
              </a>
            ))}
          </nav>
          <footer className="side-foot">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setLang(lang === "vi" ? "en" : "vi")}
            >
              {lang === "vi" ? "EN" : "VI"}
            </Button>
            <Button size="sm" variant="ghost" asChild>
              <a
                href="#/settings"
                aria-current={page === "settings" ? "page" : undefined}
              >
                <SettingsIcon aria-hidden="true" />
                {t("settings")}
              </a>
            </Button>
          </footer>
        </aside>
        <main ref={main} id="main" className="main" tabIndex={-1}>
          <div key={hash} className="page">
            {content}
          </div>
        </main>
      </div>
      <nav
        className="tab-bar"
        aria-label={lang === "vi" ? "Điều hướng chính" : "Main navigation"}
      >
        {tabs.map((tab) => (
          <a
            key={tab.href}
            href={`#${tab.href}`}
            aria-current={isActive(tab) ? "page" : undefined}
          >
            <span className={`tab-icon tab-${tab.label}`}>
              <NavigationIcon name={tab.label} />
            </span>
            <span>{t(tab.label)}</span>
          </a>
        ))}
      </nav>
    </>
  );
}
