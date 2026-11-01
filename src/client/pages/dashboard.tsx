import { useApp, useResource } from "../lib/context";
import type { Note, Stats } from "../lib/types";
import {
  Heading,
  InboxWarning,
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
      <InboxWarning stats={stats} />
      <div className="pipeline">
        {metrics.map(([path, value, key]) => (
          <a key={path} className="metric" href={`#${path}`}>
            <strong>{value}</strong>
            <span>{t(key)}</span>
          </a>
        ))}
      </div>
      <div className="split">
        <div className="stack">
          <Panel>
            <h2>{t("today_one")}</h2>
            {stats.next_actions[0] ? (
              <>
                <h3>{stats.next_actions[0].next_action}</h3>
                <a
                  className="small muted"
                  href={`#/note/${stats.next_actions[0].id}`}
                >
                  {stats.next_actions[0].title}
                </a>
              </>
            ) : (
              <p className="muted">{t("no_actions")}</p>
            )}
          </Panel>
          <Panel>
            <h2>{t("weekly")}</h2>
            <p className="small muted">
              {t("cap")} / {t("shipped")}
            </p>
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
          </Panel>
          {stats.next_actions.length > 1 && (
            <Panel>
              <h2>{t("next_actions")}</h2>
              {stats.next_actions.slice(1).map((note) => (
                <a
                  key={note.id}
                  className="note-item"
                  href={`#/note/${note.id}`}
                >
                  <strong>{note.next_action}</strong>
                  <p className="small muted">{note.title}</p>
                </a>
              ))}
            </Panel>
          )}
        </div>
        <div className="stack">
          <Panel>
            <strong className="stat-number">
              {Math.round(stats.ship_ratio * 100)}%
            </strong>
            <h2>{t("ship_ratio")}</h2>
            <p className="hint">{t("ship_ratio_hint")}</p>
          </Panel>
          <Panel>
            <strong className="stat-number">{stats.reviews_due}</strong>
            <h2>{t("reviews_due")}</h2>
            <a href="#/review">{t("review")} →</a>
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
