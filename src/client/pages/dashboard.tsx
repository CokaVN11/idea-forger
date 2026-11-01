import {
  ArrowRight,
  BookOpen,
  CheckCheck,
  FlaskConical,
  Inbox,
  Network,
  Plus,
  Route,
  Sprout,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { useApp, useResource } from "../lib/context";
import type { Note, Stats } from "../lib/types";
import {
  Heading,
  NoteItem,
  Panel,
  ResourceState,
} from "../components/shared";
export function Dashboard() {
  const { t } = useApp();
  const { data: stats, error } = useResource<Stats>("/stats");
  const { data: old } = useResource<{ notes: Note[] }>("/spark?old=1");
  if (!stats) return <ResourceState error={error} />;
  const metrics = [
    ["/capture", stats.captured_30d, "captured_30d"],
    ["/inbox", stats.stages.inbox, "inbox"],
    ["/library", stats.links, "links"],
    ["/spark", stats.sparks_30d, "sparks_30d"],
    ["/ship", stats.shipped_30d, "shipped_30d"],
  ] as const;
  const steps = [Plus, Inbox, Network, FlaskConical, CheckCheck];
  const next =
    stats.stages.inbox >= stats.inbox_limit && stats.stages.inbox > 0
      ? { kind: "distill", href: "/inbox", action: "go_distill", Icon: Inbox }
      : stats.reviews_due > 0
        ? { kind: "review", href: "/review", action: "review", Icon: BookOpen }
        : stats.stages.inbox > 0
          ? {
              kind: "distill",
              href: "/inbox",
              action: "go_distill",
              Icon: Inbox,
            }
          : stats.next_actions[0]
            ? {
                kind: "ship",
                href: `/note/${stats.next_actions[0].id}`,
                action: "open_next_note",
                Icon: CheckCheck,
              }
            : {
                kind: "capture",
                href: "/capture",
                action: "capture",
                Icon: Sprout,
              };
  const weeks = lastWeeks(8);
  const captures = Object.fromEntries(
    stats.weekly_capture.map((row) => [row.wk, row.c]),
  );
  const ships = Object.fromEntries(
    stats.weekly_ship.map((row) => [row.wk, row.c]),
  );
  const max = Math.max(
    1,
    ...weeks.flatMap((week) => [captures[week.key] || 0, ships[week.key] || 0]),
  );
  return (
    <>
      <Heading title={t("dashboard")} subtitle={t("tagline")} />
      <section className="next-step" aria-labelledby="next-step-title">
        <div className="next-step-copy">
          <div className="step-emblem">
            <next.Icon aria-hidden="true" />
          </div>
          <div>
            <p className="sr-only">{t("next_step_label")}</p>
            <h2 id="next-step-title">{t(`next_${next.kind}_title`)}</h2>
            <p className="muted">
              {t(`next_${next.kind}_hint`, { n: stats.reviews_due })}
            </p>
          </div>
        </div>
        <Button asChild>
          <a href={`#${next.href}`}>
            {t(next.action)}
            <ArrowRight aria-hidden="true" />
          </a>
        </Button>
      </section>
      <div className="journey-intro">
        <Route aria-hidden="true" />
        {t("journey_title")}
      </div>
      <div className="pipeline">
        {metrics.map(([path, value, key], index) => {
          const Icon = steps[index];
          return (
            <a key={path} className="metric" href={`#${path}`}>
              <div className="metric-step">
                <Icon aria-hidden="true" />
                {index + 1} · {t(`step${index + 1}`)}
              </div>
              <strong>{value}</strong>
              <span>{t(key)}</span>
            </a>
          );
        })}
      </div>
      <div className="split">
        <div className="stack">
          <Panel>
            <h2>{t("next_actions")}</h2>
            {stats.next_actions.length ? (
              stats.next_actions.map((note) => (
                <a
                  key={note.id}
                  className="note-item"
                  href={`#/note/${note.id}`}
                >
                  <strong>{note.next_action}</strong>
                  <p className="small muted">{note.title}</p>
                </a>
              ))
            ) : (
              <p className="muted">{t("no_actions")}</p>
            )}
          </Panel>
          <Panel>
            <h2>{t("weekly")}</h2>
            <p className="small muted">
              {t("cap")} / {t("shipped")}
            </p>
            {stats.weekly_capture.some((row) => row.c > 0) ||
            stats.weekly_ship.some((row) => row.c > 0) ? (
              <div className="bars" role="img" aria-label={t("weekly")}>
                {weeks.map((week) => (
                  <div
                    className="bar-col"
                    key={week.key}
                    title={`${week.label}: ${captures[week.key] || 0} / ${ships[week.key] || 0}`}
                  >
                    <div className="bar-pair">
                      <div
                        className="bar cap"
                        style={{
                          height: `${((captures[week.key] || 0) / max) * 100}%`,
                        }}
                      />
                      <div
                        className="bar ship"
                        style={{
                          height: `${((ships[week.key] || 0) / max) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="small muted">{week.label}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted chart-empty">{t("weekly_empty")}</p>
            )}
          </Panel>
        </div>
        <div className="stack">
          <Panel>
            <strong className="stat-number">
              {Math.round(stats.ship_ratio * 100)}%
            </strong>
            <h2>{t("ship_ratio")}</h2>
            <p className="hint">{t("ship_ratio_hint")}</p>
          </Panel>
          {old?.notes[0] && (
            <Panel>
              <h2>{t("rediscover")}</h2>
              <NoteItem note={old.notes[0]} />
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
function lastWeeks(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(Date.now() - (count - i - 1) * 7 * 86400000);
    const year = date.getUTCFullYear();
    const day = Math.floor((date.getTime() - Date.UTC(year, 0, 1)) / 86400000);
    const week = Math.floor((day + 7 - ((date.getUTCDay() + 6) % 7)) / 7);
    return {
      key: `${year}-${String(week).padStart(2, "0")}`,
      label: `${date.getUTCDate()}/${date.getUTCMonth() + 1}`,
    };
  });
}
