import { useEffect, useState } from "react";
import { useApp, useDebounced, useResource } from "../lib/context";
import type { Note, Tag } from "../lib/types";
import { KINDS } from "../lib/messages";
import {
  Button,
  Empty,
  Field,
  Heading,
  Input,
  NativeSelect,
  NoteItem,
  Panel,
  ResourceState,
} from "../components/shared";
export function Library({ query }: { query: URLSearchParams }) {
  const { t, kindLabel } = useApp();
  const [search, setSearch] = useState(query.get("q") ?? "");
  const q = useDebounced(search);
  const [stage, setStage] = useState(query.get("stage") ?? "");
  const [kind, setKind] = useState("");
  const [tag, setTag] = useState(query.get("tag") ?? "");
  const [offset, setOffset] = useState(0);
  const [previous, setPrevious] = useState<Note[]>([]);
  useEffect(() => {
    setOffset(0);
    setPrevious([]);
  }, [q, stage, kind, tag]);
  const params = new URLSearchParams({
    q,
    stage,
    kind,
    tag,
    limit: "40",
    offset: String(offset),
  });
  const { data, error } = useResource<{ notes: Note[] }>(`/notes?${params}`);
  const { data: tags } = useResource<{ tags: Tag[] }>("/tags");
  return (
    <>
      <Heading title={t("library")} subtitle={t("library_sub")} />
      <Panel>
        <div className="grid-3">
          <Field label={t("search_ph")}>
            <Input
              type="search"
              autoFocus={query.has("focus")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("search_ph")}
            />
          </Field>
          <Field label={t("stage")}>
            <NativeSelect
              value={stage}
              onChange={(event) => setStage(event.target.value)}
            >
              <option value="">{t("all")}</option>
              {["inbox", "distilled", "archived"].map((key) => (
                <option key={key} value={key}>
                  {t(`st_${key}`)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label={t("kind")}>
            <NativeSelect
              value={kind}
              onChange={(event) => setKind(event.target.value)}
            >
              <option value="">{t("all")}</option>
              {Object.keys(KINDS.vi).map((key) => (
                <option key={key} value={key}>
                  {kindLabel(key)}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
        <div className="row tags">
          {tags?.tags.slice(0, 40).map((item) => (
            <Button
              key={item.name}
              size="sm"
              variant={tag === item.name ? "default" : "secondary"}
              aria-pressed={tag === item.name}
              onClick={() => setTag(tag === item.name ? "" : item.name)}
            >
              #{item.name} · {item.c}
            </Button>
          ))}
        </div>
      </Panel>
      <div className="stack">
        {previous.map((note) => (
          <NoteItem key={note.id} note={note} />
        ))}
        {!data ? (
          <ResourceState error={error} />
        ) : data.notes.length ? (
          data.notes.map((note) => <NoteItem key={note.id} note={note} />)
        ) : !previous.length ? (
          <Empty>{t("no_results")}</Empty>
        ) : null}
        {data && data.notes.length === 40 && (
          <Button
            variant="outline"
            onClick={() => {
              setPrevious((notes) => [...notes, ...data.notes]);
              setOffset((value) => value + 40);
            }}
          >
            {t("load_more")}
          </Button>
        )}
      </div>
    </>
  );
}
export function Timeline({ query }: { query: URLSearchParams }) {
  const { t, lang } = useApp();
  const [tag, setTag] = useState(query.get("tag") ?? "");
  const { data, error } = useResource<{ notes: Note[] }>(
    `/notes?order=learned&limit=500&include_archived=1&tag=${encodeURIComponent(tag)}`,
  );
  const { data: tags } = useResource<{ tags: Tag[] }>("/tags");
  const groups = new Map<string, Note[]>();
  for (const note of data?.notes ?? []) {
    const month = note.learned_at?.slice(0, 7) ?? "";
    groups.set(month, [...(groups.get(month) ?? []), note]);
  }
  return (
    <>
      <Heading title={t("timeline")} subtitle={t("timeline_sub")}>
        <Field label={t("filter_tag")}>
          <NativeSelect
            value={tag}
            onChange={(event) => setTag(event.target.value)}
          >
            <option value="">{t("all")}</option>
            {tags?.tags.map((tag) => (
              <option key={tag.name}>{tag.name}</option>
            ))}
          </NativeSelect>
        </Field>
      </Heading>
      {!data ? (
        <ResourceState error={error} />
      ) : !data.notes.length ? (
        <Empty>{t("no_results")}</Empty>
      ) : (
        [...groups].map(([month, notes]) => (
          <section key={month} className="timeline">
            <h2>
              {month
                ? new Date(`${month}-01T00:00:00`).toLocaleDateString(
                    lang === "vi" ? "vi-VN" : "en-US",
                    { month: "long", year: "numeric" },
                  )
                : "—"}
            </h2>
            <div className="stack">
              {notes.map((note) => (
                <NoteItem key={note.id} note={note} />
              ))}
            </div>
          </section>
        ))
      )}
    </>
  );
}
