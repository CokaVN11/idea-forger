import { useEffect, useRef } from "react";
import { api, store, todayStr } from "../lib/api";
import { useApp, useTask } from "../lib/context";
import { Button, Heading, Panel } from "../components/shared";
export function Settings() {
  const { t, lang, setLang, theme, setTheme, notify, refresh } = useApp();
  const { busy, run } = useTask();
  const bookmark = useRef<HTMLAnchorElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    // Assign through the DOM: React blocks javascript: URLs in JSX, while bookmarklets require one.
    const base = JSON.stringify(`${location.origin}/#/capture`);
    bookmark.current?.setAttribute(
      "href",
      `javascript:(()=>{window.open(${base}+'?url='+encodeURIComponent(location.href)+'&title='+encodeURIComponent(document.title)+'&text='+encodeURIComponent(String(getSelection())),'_blank')})()`,
    );
  }, []);
  const exportData = () =>
    void run(async () => {
      const data = await api<unknown>("/export");
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `idea-forge-${todayStr()}.json`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  const frameworks = [
    ["Capture", "Commonplace Book, Inbox", "Input"],
    [
      "Distill",
      "Progressive Summarization, Feynman, Spaced Repetition",
      "Learner",
    ],
    ["Connect", "Zettelkasten, Timeline", "Context"],
    ["Spark", "Combinatorial Creativity, SCAMPER", "Ideation"],
    ["Ship", "PARA, CODE, WIP limit, Ship ratio", "Activator"],
  ];
  return (
    <>
      <Heading title={t("settings")} />
      <div className="grid-2">
        <Panel>
          <h2>
            {t("language")} / {t("theme")}
          </h2>
          <div className="row">
            <Button
              variant={lang === "vi" ? "default" : "outline"}
              onClick={() => setLang("vi")}
            >
              Tiếng Việt
            </Button>
            <Button
              variant={lang === "en" ? "default" : "outline"}
              onClick={() => setLang("en")}
            >
              English
            </Button>
          </div>
          <div className="row">
            {["auto", "light", "dark"].map((value) => (
              <Button
                key={value}
                size="sm"
                variant={theme === value ? "default" : "outline"}
                onClick={() => setTheme(value)}
              >
                {t(`th_${value}`)}
              </Button>
            ))}
          </div>
        </Panel>
        <Panel>
          <h2>{t("bookmarklet")}</h2>
          <p className="muted small">{t("bookmarklet_hint")}</p>
          <a
            className="bookmarklet"
            ref={bookmark}
            draggable
            onClick={(event) => event.preventDefault()}
          >
            + Idea Forge
          </a>
        </Panel>
        <Panel>
          <h2>{t("backup")}</h2>
          <div className="row">
            <Button variant="outline" disabled={busy} onClick={exportData}>
              {t("export")}
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => fileInput.current?.click()}
            >
              {t("import")}
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file || !confirm(t("import_confirm"))) return;
                void run(async () => {
                  const data = JSON.parse(await file.text());
                  await api("/import", "POST", { ...data, replace: true });
                  refresh();
                  notify(t("imported"));
                });
              }}
            />
          </div>
        </Panel>
        <Panel>
          <h2>{t("shortcuts")}</h2>
          <p className="small">
            <kbd>c</kbd> {t("sc_capture")} · <kbd>/</kbd> {t("sc_search")} ·{" "}
            <kbd>Ctrl/⌘ ↵</kbd> {t("sc_save")}
          </p>
          <Button
            variant="ghost"
            onClick={() => {
              store.del("if_token");
              window.dispatchEvent(new Event("idea-forge:logout"));
            }}
          >
            {t("logout")}
          </Button>
        </Panel>
      </div>
      <Panel>
        <h2>{t("framework")}</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Step</th>
                <th>Framework</th>
                <th>CliftonStrengths</th>
              </tr>
            </thead>
            <tbody>
              {frameworks.map(([step, framework, talent], index) => (
                <tr key={step}>
                  <td>
                    {index + 1} · {step}
                  </td>
                  <td>{framework}</td>
                  <td>{talent}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
