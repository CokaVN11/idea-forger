import { api, formBody, go, todayStr } from "../lib/api";
import { useApp, useResource, useTask } from "../lib/context";
import type { Stats, Tag } from "../lib/types";
import {
  AreaField,
  Field,
  Heading,
  InboxWarning,
  Input,
  KindField,
  Panel,
  SaveButton,
  TagsField,
  TextField,
} from "../components/shared";
import type { FormEvent } from "react";
export function Capture({ query }: { query: URLSearchParams }) {
  const { t, notify, refresh } = useApp();
  const { busy, run } = useTask();
  const { data: stats } = useResource<Stats>("/stats");
  const { data } = useResource<{ tags: Tag[] }>("/tags");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const open =
      (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") ===
      "open";
    void run(async () => {
      const body = formBody(form);
      const { id } = await api<{ id: number }>("/notes", "POST", body);
      notify(`${t("saved")} · #${id}`);
      refresh();
      if (open) {
        go(`/note/${id}`);
        return;
      }
      form.reset();
      for (const name of ["body", "title", "source_url", "source_title"])
        (form.elements.namedItem(name) as HTMLInputElement).value = "";
      (form.elements.namedItem("tags") as HTMLInputElement).value = (
        body.tags as string[]
      ).join(", ");
      (form.elements.namedItem("body") as HTMLTextAreaElement).focus();
      history.replaceState(null, "", "#/capture");
    });
  }
  return (
    <>
      <Heading title={t("capture_title")} subtitle={t("capture_sub")} />
      {stats && <InboxWarning stats={stats} />}
      <Panel className="form-width">
        <form onSubmit={submit}>
          <fieldset disabled={busy}>
            <AreaField field="body" value={query.get("text") ?? ""} rows={6} />
            <div className="grid-2">
              <TextField
                field="title"
                value={!query.get("text") ? (query.get("title") ?? "") : ""}
              />
              <KindField
                value={
                  query.get("url")
                    ? query.get("text")
                      ? "quote"
                      : "link"
                    : "idea"
                }
              />
              <TextField
                field="source_url"
                type="url"
                value={query.get("url") ?? ""}
              />
              <TextField
                field="source_title"
                value={query.get("title") ?? ""}
              />
              <TagsField tags={data?.tags.map((tag) => tag.name)} />
              <Field label={t("learned_at")} hint={t("learned_hint")}>
                <Input
                  type="date"
                  name="learned_at"
                  defaultValue={todayStr()}
                />
              </Field>
            </div>
            <div className="row">
              <SaveButton value="new">{t("save_new")}</SaveButton>
              <SaveButton variant="outline" value="open">
                {t("save")} →
              </SaveButton>
            </div>
          </fieldset>
        </form>
      </Panel>
    </>
  );
}
