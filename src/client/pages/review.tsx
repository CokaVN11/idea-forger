import { CheckCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useApp, useResource, useTask } from "../lib/context";
import type { Note } from "../lib/types";
import {
  BodyText,
  Button,
  Heading,
  Panel,
  ResourceState,
  SectionTabs,
  Textarea,
} from "../components/shared";
export function Review() {
  const { t, refresh } = useApp();
  const { busy, run } = useTask();
  const { data, error } = useResource<{ notes: Note[] }>("/review");
  const [completed, setCompleted] = useState<number[]>([]);
  const [revealed, setRevealed] = useState(false);
  const notes =
    data?.notes.filter((note) => !completed.includes(note.id)) ?? [];
  const note = notes[0];
  const grade = (value: number) =>
    void run(async () => {
      if (!note) return;
      await api(`/notes/${note.id}/review`, "POST", { grade: value });
      setCompleted((ids) => [...ids, note.id]);
      setRevealed(false);
      refresh();
    });
  useEffect(() => {
    function key(event: KeyboardEvent) {
      if (
        (event.target as HTMLElement).closest(
          "input,textarea,select,button,a,[contenteditable]",
        )
      )
        return;
      if (event.ctrlKey || event.metaKey || event.altKey || busy || !note)
        return;
      if (event.key === " " && !revealed) {
        event.preventDefault();
        setRevealed(true);
      }
      if (revealed && ["1", "2", "3", "4"].includes(event.key)) {
        event.preventDefault();
        grade(Number(event.key) - 1);
      }
    }
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  });
  if (!data) return <ResourceState error={error} />;
  return (
    <>
      <Heading title={t("review")} subtitle={t("review_sub")} />
      <SectionTabs active="review" group="distill" />
      {(notes.length > 0 || completed.length > 0) && (
        <div className="review-progress">
          <div className="row between">
            <strong>{t("review_session")}</strong>
            <span className="small muted" role="status">
              {t("review_progress", {
                done: completed.length,
                total: completed.length + notes.length,
              })}
            </span>
          </div>
          <progress
            aria-label={t("review_session")}
            value={completed.length}
            max={completed.length + notes.length}
          />
        </div>
      )}
      {note ? (
        <Panel className="form-width">
          <h2>{note.title}</h2>
          <Textarea
            key={note.id}
            aria-label={t("recall_ph")}
            placeholder={t("recall_ph")}
            rows={3}
          />
          {revealed ? (
            <>
              <div className="reveal">
                <strong>{note.summary}</strong>
                <p className="muted">{note.why_matters}</p>
                <BodyText text={note.body} />
                <a href={`#/note/${note.id}`}>#{note.id} →</a>
              </div>
              <div className="row">
                {["again", "hard", "good", "easy"].map((key, i) => (
                  <Button
                    key={key}
                    disabled={busy}
                    variant={i === 2 ? "default" : "outline"}
                    onClick={() => grade(i)}
                  >
                    {i + 1} · {t(key)}
                  </Button>
                ))}
              </div>
            </>
          ) : (
            <Button onClick={() => setRevealed(true)}>{t("reveal")}</Button>
          )}
        </Panel>
      ) : (
        <Panel className="review-celebration form-width">
          <div className="step-emblem">
            <CheckCheck aria-hidden="true" />
          </div>
          <h2>
            {t(
              completed.length ? "review_complete_title" : "review_clear_title",
            )}
          </h2>
          <p className="muted">
            {t(
              completed.length ? "review_complete_hint" : "review_clear_hint",
              { n: completed.length },
            )}
          </p>
          <div className="row">
            <Button asChild>
              <a href="#/capture">{t("capture")}</a>
            </Button>
            <Button variant="outline" asChild>
              <a href="#/">{t("back_dashboard")}</a>
            </Button>
          </div>
        </Panel>
      )}
    </>
  );
}
