import { useState, type FormEvent } from "react";
import { api, formBody } from "../lib/api";
import { useApp, useResource, useTask } from "../lib/context";
import type { Note, Tag } from "../lib/types";
import {
  AreaField,
  BodyText,
  Button,
  Empty,
  ExternalLink,
  Heading,
  Panel,
  ParaField,
  ResourceState,
  SaveButton,
  TagsField,
  TextField,
} from "../components/shared";
export function Inbox() {
  const { t, refresh, notify } = useApp();
  const { busy, run } = useTask();
  const { data, error } = useResource<{ notes: Note[] }>(
    "/notes?stage=inbox&limit=200",
  );
  const { data: tags } = useResource<{ tags: Tag[] }>("/tags");
  const [index, setIndex] = useState(0);
  if (!data) return <ResourceState error={error} />;
  const notes = [...data.notes].reverse();
  const note = notes[index % notes.length];
  const mutate = (task: () => Promise<unknown>) =>
    void run(async () => {
      await task();
      refresh();
    });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = formBody(event.currentTarget);
    mutate(async () => {
      await api(`/notes/${note.id}`, "PATCH", { ...body, stage: "distilled" });
      notify(t("distilled_ok"));
    });
  };
  return (
    <>
      <Heading title={t("distill_title")} subtitle={t("distill_sub")} />
      {note ? (
        <div className="split">
          <Panel>
            <p className="kind">
              {(index % notes.length) + 1} / {notes.length}
            </p>
            <h2>{note.title}</h2>
            <BodyText text={note.body} />
            {note.source_url && (
              <p className="small">
                <ExternalLink href={note.source_url}>
                  {note.source_title || note.source_url}
                </ExternalLink>
              </p>
            )}
          </Panel>
          <Panel>
            <form key={note.id} onSubmit={submit}>
              <fieldset disabled={busy}>
                <TextField field="title" value={note.title} />
                <AreaField field="summary" value={note.summary} required />
                <AreaField field="why_matters" value={note.why_matters} />
                <TagsField
                  value={note.tags.join(", ")}
                  tags={tags?.tags.map((tag) => tag.name)}
                />
                <div className="grid-2">
                  <ParaField value={note.para} />
                  <TextField field="para_ref" value={note.para_ref} />
                </div>
                <TextField field="next_action" value={note.next_action} />
                <div className="row">
                  <SaveButton>{t("do_distill")}</SaveButton>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIndex((i) => (i + 1) % notes.length)}
                  >
                    {t("skip")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      mutate(() =>
                        api(`/notes/${note.id}`, "PATCH", {
                          stage: "archived",
                        }),
                      )
                    }
                  >
                    {t("archive")}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => {
                      if (confirm(t("confirm_del")))
                        mutate(() => api(`/notes/${note.id}`, "DELETE"));
                    }}
                  >
                    {t("del")}
                  </Button>
                </div>
              </fieldset>
            </form>
          </Panel>
        </div>
      ) : (
        <Empty>
          {t("inbox_empty")}
          <div className="row">
            <a href="#/spark">{t("collider")}</a>
            <a href="#/ship">{t("outputs")}</a>
          </div>
        </Empty>
      )}
    </>
  );
}
