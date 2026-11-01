import { useRef, useState, type FormEvent } from "react";
import { api, formBody, go } from "../lib/api";
import { useApp, useDebounced, useResource, useTask } from "../lib/context";
import type { Note, NoteDetail, NoteLink, Output, Tag } from "../lib/types";
import {
  AreaField,
  Badge,
  Button,
  Field,
  Heading,
  Input,
  KindField,
  NativeSelect,
  Panel,
  ParaField,
  ResourceState,
  SaveButton,
  TagsField,
  TextField,
  fmtDate,
} from "../components/shared";
export function NotePage({ id }: { id: number }) {
  const { t, lang, refresh, notify } = useApp();
  const { busy, run } = useTask();
  const { data, error } = useResource<NoteDetail>(`/notes/${id}`);
  const { data: suggestions } = useResource<{
    suggestions: (Note & { via: string })[];
  }>(`/notes/${id}/suggest`);
  const { data: allOutputs } = useResource<{ outputs: Output[] }>("/outputs");
  const { data: tags } = useResource<{ tags: Tag[] }>("/tags");
  const [search, setSearch] = useState("");
  const query = useDebounced(search);
  const { data: matches } = useResource<{ notes: Note[] }>(
    `/notes?limit=10&q=${encodeURIComponent(query)}`,
  );
  const [selected, setSelected] = useState<Pick<Note, "id" | "title"> | null>(
    null,
  );
  // AI draft merged over the form's current values; `rev` remounts the uncontrolled form to apply it.
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [rev, setRev] = useState(0);
  const formEl = useRef<HTMLFormElement>(null);
  const [reasons, setReasons] = useState<Record<number, string>>({});
  if (!data) return <ResourceState error={error} />;
  const note = data.note;
  const v = (field: keyof Note) =>
    draft[field] ??
    (field === "tags" ? note.tags.join(", ") : String(note[field] ?? ""));
  const aiDistill = () => {
    // Read the form before run() disables the fieldset: disabled fields drop out of FormData.
    const current = formBody(formEl.current!);
    void run(async () => {
      const { draft: ai } = await api<{ draft: Record<string, string | string[]> }>(
        `/notes/${id}/distill`,
        "POST",
      );
      const merged: Record<string, string> = {};
      for (const [key, value] of Object.entries(current))
        merged[key] = Array.isArray(value) ? value.join(", ") : String(value);
      for (const [key, value] of Object.entries(ai))
        if (key !== "tags" && key !== "kind" && value) merged[key] = String(value);
      merged.tags = [
        ...new Set([...(current.tags as string[]), ...(ai.tags as string[])]),
      ].join(", ");
      setDraft(merged);
      setRev((n) => n + 1);
      notify(t("ai_distill_done"));
    });
  };
  const aiConnect = () =>
    void run(async () => {
      const { suggestions: out } = await api<{
        suggestions: { id: number; reason: string }[];
      }>(`/notes/${id}/connect`, "POST");
      setReasons(Object.fromEntries(out.map((item) => [item.id, item.reason])));
      notify(t("ai_connect_done"));
    });
  const mutate = (task: () => Promise<unknown>) =>
    void run(async () => {
      await task();
      refresh();
    });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = formBody(event.currentTarget);
    if (
      (event.nativeEvent as SubmitEvent).submitter?.getAttribute("name") ===
      "distill"
    )
      body.stage = "distilled";
    mutate(async () => {
      await api(`/notes/${id}`, "PATCH", body);
      setDraft({});
      notify(t("saved"));
    });
  }
  const link = (target: number, reason: string) =>
    api(`/notes/${id}/links`, "POST", { to_id: target, reason });
  const linkRows = (links: NoteLink[]) =>
    links.map((item) => (
      <div key={item.link_id} className="link-row">
        <div>
          <a href={`#/note/${item.id}`}>{item.title}</a>
          <p className="small muted">{item.reason}</p>
        </div>
        <Button
          disabled={busy}
          variant="ghost"
          size="sm"
          onClick={() => mutate(() => api(`/links/${item.link_id}`, "DELETE"))}
        >
          {t("unlink")}
        </Button>
      </div>
    ));
  return (
    <>
      <Heading
        title={note.title}
        subtitle={`#${id} · ${t(`st_${note.stage}`)}`}
      >
        <div className="row">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              mutate(() =>
                api(`/notes/${id}`, "PATCH", {
                  stage: note.stage === "archived" ? "distilled" : "archived",
                }),
              )
            }
          >
            {t(note.stage === "archived" ? "restore" : "archive")}
          </Button>
          <Button
            disabled={busy}
            onClick={() =>
              mutate(async () => {
                await api("/outputs", "POST", {
                  title: note.next_action || note.title,
                  note_ids: [id],
                });
                go("/ship");
              })
            }
          >
            {t("make_output")}
          </Button>
        </div>
      </Heading>
      <div className="split">
        <Panel>
          <form key={rev} ref={formEl} onSubmit={submit}>
            <fieldset disabled={busy}>
              <div className="grid-2">
                <TextField field="title" value={v("title")} />
                <KindField value={v("kind")} />
              </div>
              <AreaField field="summary" value={v("summary")} />
              <AreaField field="why_matters" value={v("why_matters")} />
              <AreaField field="body" rows={6} value={v("body")} />
              <div className="grid-2">
                <TextField
                  field="source_url"
                  type="url"
                  value={v("source_url")}
                />
                <TextField field="source_title" value={v("source_title")} />
                <TagsField
                  value={v("tags")}
                  tags={tags?.tags.map((tag) => tag.name)}
                />
                <TextField
                  field="learned_at"
                  type="date"
                  value={v("learned_at")}
                />
                <ParaField value={v("para")} />
                <TextField field="para_ref" value={v("para_ref")} />
              </div>
              <TextField field="next_action" value={v("next_action")} />
              <div className="row">
                <SaveButton />
                <>
                  {note.stage === "inbox" && (
                    <SaveButton name="distill" variant="outline">
                      {t("do_distill")}
                    </SaveButton>
                  )}
                </>
                <Button type="button" variant="outline" onClick={aiDistill}>
                  {t("ai_distill")}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    if (confirm(t("confirm_del")))
                      mutate(async () => {
                        await api(`/notes/${id}`, "DELETE");
                        go("/library");
                      });
                  }}
                >
                  {t("del")}
                </Button>
              </div>
            </fieldset>
          </form>
        </Panel>
        <div className="stack">
          <Panel>
            <h2>{t("add_link")}</h2>
            <Field label={t("pick_note")}>
              <Input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("pick_note")}
              />
            </Field>
            {query &&
              !selected &&
              matches?.notes
                .filter((item) => item.id !== id)
                .map((item) => (
                  <Button
                    key={item.id}
                    className="picker-result"
                    variant="ghost"
                    onClick={() => {
                      setSelected(item);
                      setSearch("");
                    }}
                  >
                    {item.title}
                  </Button>
                ))}
            {selected && (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const reason = String(
                    new FormData(event.currentTarget).get("reason") ?? "",
                  );
                  mutate(async () => {
                    await link(selected.id, reason);
                    setSelected(null);
                  });
                }}
              >
                <p>{selected.title}</p>
                <Field label={t("link_reason")}>
                  <Input name="reason" placeholder={t("link_reason_ph")} />
                </Field>
                <SaveButton disabled={busy}>{t("link")}</SaveButton>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setSelected(null)}
                >
                  ✕
                </Button>
              </form>
            )}
          </Panel>
          <Panel>
            <h2>
              {t("links_out")}{" "}
              <Badge variant="secondary">{data.links.length}</Badge>
            </h2>
            {linkRows(data.links)}
            <h2>
              {t("backlinks")}{" "}
              <Badge variant="secondary">{data.backlinks.length}</Badge>
            </h2>
            {linkRows(data.backlinks)}
          </Panel>
          <Panel>
            <div className="link-row">
              <h2>{t("suggestions")}</h2>
              {!!suggestions?.suggestions.length && (
                <Button
                  disabled={busy}
                  size="sm"
                  variant="outline"
                  onClick={aiConnect}
                >
                  {t("ai_connect")}
                </Button>
              )}
            </div>
            {suggestions?.suggestions.length ? (
              suggestions.suggestions.map((item) => (
                <div className="link-row" key={item.id}>
                  <div>
                    <a href={`#/note/${item.id}`}>{item.title}</a>
                    <p className="small muted">
                      {item.via} · {reasons[item.id] || item.summary}
                    </p>
                  </div>
                  <Button
                    disabled={busy}
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const reason = prompt(
                        t("link_reason"),
                        reasons[item.id] ?? "",
                      );
                      if (reason !== null) mutate(() => link(item.id, reason));
                    }}
                  >
                    {t("link")}
                  </Button>
                </div>
              ))
            ) : (
              <p className="muted small">{t("no_suggest")}</p>
            )}
          </Panel>
          <Panel>
            <h2>{t("in_outputs")}</h2>
            {data.outputs.map((output) => (
              <div className="link-row" key={output.id}>
                <a href="#/ship">{output.title}</a>
                <Badge variant="secondary">
                  {t(
                    output.status === "shipped" ? "out_shipped" : output.status,
                  )}
                </Badge>
              </div>
            ))}
            {!!allOutputs?.outputs.filter(
              (output) => !data.outputs.some((item) => item.id === output.id),
            ).length && (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const output = new FormData(event.currentTarget).get(
                    "output",
                  );
                  mutate(() =>
                    api(`/outputs/${output}/notes`, "POST", { note_id: id }),
                  );
                }}
              >
                <Field label={t("attach_note")}>
                  <NativeSelect name="output">
                    {allOutputs.outputs
                      .filter(
                        (output) =>
                          !data.outputs.some((item) => item.id === output.id),
                      )
                      .map((output) => (
                        <option key={output.id} value={output.id}>
                          {output.title}
                        </option>
                      ))}
                  </NativeSelect>
                </Field>
                <SaveButton disabled={busy} variant="outline">
                  {t("attach_note")}
                </SaveButton>
              </form>
            )}
          </Panel>
          <Panel>
            <h2>{t("review_info")}</h2>
            <p className="small muted">
              {t("next_review")}:{" "}
              {note.review_due ? fmtDate(note.review_due, lang) : t("never")} ·{" "}
              {note.review_count} {t("times")}
            </p>
          </Panel>
        </div>
      </div>
    </>
  );
}
