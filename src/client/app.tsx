import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  BookOpen,
  CheckCheck,
  FlaskConical,
  Inbox as InboxIcon,
  LayoutDashboard,
  Library as LibraryIcon,
  Network,
  Plus,
  LoaderCircle,
  Settings as SettingsIcon,
  Sprout,
  History,
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
  const navIcons: Record<string, typeof Sprout> = {
    dashboard: LayoutDashboard,
    capture: Plus,
    inbox: InboxIcon,
    review: BookOpen,
    library: LibraryIcon,
    timeline: History,
    collider: FlaskConical,
    outputs: CheckCheck,
    settings: SettingsIcon,
  };
  const item = (href: string, key: string, badge?: number) => (
    <a
      key={href}
      href={`#${href}`}
      aria-current={
        path === href || (page === "note" && href === "/library")
          ? "page"
          : undefined
      }
    >
      <span className="nav-title">
        {(() => {
          const Icon = navIcons[key] || Network;
          return <Icon aria-hidden="true" />;
        })()}
        {t(key)}
      </span>
      {badge !== undefined && <span className="nav-badge">{badge}</span>}
    </a>
  );
  const groups = [
    ["Capture", item("/capture", "capture")],
    [
      "Distill",
      <>
        {item("/inbox", "inbox", stats?.stages.inbox)}
        {item("/review", "review", stats?.reviews_due)}
      </>,
    ],
    [
      "Connect",
      <>
        {item("/library", "library")}
        {item("/timeline", "timeline")}
      </>,
    ],
    ["Spark", item("/spark", "collider")],
    ["Ship", item("/ship", "outputs")],
  ] as const;
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
          <nav aria-label={lang === "vi" ? "Tất cả tính năng" : "All features"}>
            {item("/", "dashboard")}
            {groups.map(([label, items], index) => (
              <div className="nav-group" key={label}>
                <div className="nav-label">
                  {index + 1} · {t(`step${index + 1}`)}
                </div>
                {items}
              </div>
            ))}
            <div className="nav-group">{item("/settings", "settings")}</div>
          </nav>
          <footer className="side-foot">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setLang(lang === "vi" ? "en" : "vi")}
            >
              {lang === "vi" ? "EN" : "VI"}
            </Button>
            <Button size="sm" asChild>
              <a href="#/capture">
                <Plus aria-hidden="true" />
                {t("capture")}
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
        {[
          ["/", "dashboard"],
          ["/inbox", "distill"],
          ["/library", "library"],
          ["/spark", "spark"],
          ["/ship", "ship"],
        ].map(([href, label]) => {
          const target = String(href);
          const active =
            path === target ||
            (target === "/inbox" && page === "review") ||
            (target === "/library" && ["note", "timeline"].includes(page));
          return (
            <a
              key={target}
              href={`#${target}`}
              aria-current={active ? "page" : undefined}
            >
              <span className={`tab-icon tab-${label}`}>
                <NavigationIcon
                  name={
                    label as
                      "dashboard" | "distill" | "library" | "spark" | "ship"
                  }
                />
              </span>
              <span>{t(String(label))}</span>
            </a>
          );
        })}
      </nav>
    </>
  );
}
