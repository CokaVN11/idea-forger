import { useEffect, useState, type FormEvent } from "react";
import { api, formBody, store } from "../lib/api";
import { PROMPTS } from "../lib/messages";
import { useApp, useResource, useTask } from "../lib/context";
import type { Note, Tag } from "../lib/types";
import {
  Button,
  Empty,
  Field,
  Heading,
  NativeSelect,
  NoteItem,
  Panel,
  SaveButton,
  AreaField,
  TextField,
} from "../components/shared";
export function Spark() {
  const { t, lang, notify, refresh } = useApp();
  const { busy, run } = useTask();
  const { data: tags } = useResource<{ tags: Tag[] }>("/tags");
  const [mode, setMode] = useState(store.get("if_spark_mode", "distant"));
  const [tag, setTag] = useState("");
  const [pair, setPair] = useState<Note[]>([]);
  const [promptIndex, setPromptIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const promptText = PROMPTS[lang][promptIndex];
  const collide = () =>
    run(async () => {
      const data = await api<{ notes: Note[] }>(
        `/spark?${new URLSearchParams({ mode, tag })}`,
      );
      setPair(data.notes);
      setLoaded(true);
      setPromptIndex(Math.floor(Math.random() * PROMPTS[lang].length));
    });
  useEffect(() => {
    void collide();
  }, []);
  const reroll = (index: number) =>
    void run(async () => {
      const keep = pair[1 - index];
      for (let attempt = 0; attempt < 6; attempt++) {
        const { notes } = await api<{ notes: Note[] }>("/spark?mode=random");
        const candidate = notes.find(
          (note) => note.id !== keep.id && note.id !== pair[index].id,
        );
        if (candidate) {
          setPair((items) =>
            items.map((note, i) => (i === index ? candidate : note)),
          );
          return;
        }
      }
    });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const body = formBody(form);
    void run(async () => {
      const { id } = await api<{ id: number }>("/sparks", "POST", {
        ...body,
        note_a: pair[0].id,
        note_b: pair[1].id,
        prompt: promptText[0],
      });
      notify(`${t("saved")} · #${id}`);
      form.reset();
      refresh();
      const data = await api<{ notes: Note[] }>(
        `/spark?${new URLSearchParams({ mode, tag })}`,
      );
      setPair(data.notes);
    });
  };
  return (
    <>
      <Heading title={t("collider")} subtitle={t("spark_sub")} />
      <Panel>
        <div className="row">
          <Field label={t("collide")}>
            <NativeSelect
              value={mode}
              onChange={(event) => {
                setMode(event.target.value);
                store.set("if_spark_mode", event.target.value);
              }}
            >
              <option value="distant">{t("mode_distant")}</option>
              <option value="random">{t("mode_random")}</option>
            </NativeSelect>
          </Field>
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
          <Button disabled={busy} onClick={() => void collide()}>
            {t("collide")}
          </Button>
        </div>
      </Panel>
      {pair.length < 2 ? (
        <Empty>
          {loaded ? t("need_notes") : lang === "vi" ? "Đang tải…" : "Loading…"}
        </Empty>
      ) : (
        <>
          <div className="grid-2">
            {pair.map((note, index) => (
              <Panel key={index}>
                <div className="row between">
                  <h2>{index === 0 ? "A" : "B"}</h2>
                  <Button
                    disabled={busy}
                    variant="ghost"
                    onClick={() => reroll(index)}
                  >
                    ↻ {t("reroll")}
                  </Button>
                </div>
                <NoteItem note={note} />
              </Panel>
            ))}
          </div>
          <Panel>
            <div className="row between">
              <h2>{promptText[0]}</h2>
              <Button
                variant="ghost"
                onClick={() =>
                  setPromptIndex((index) => (index + 1) % PROMPTS[lang].length)
                }
              >
                {t("new_prompt")}
              </Button>
            </div>
            <p>{promptText[1]}</p>
          </Panel>
          <Panel>
            <form onSubmit={submit}>
              <fieldset disabled={busy}>
                <AreaField field="idea" rows={4} required />
                <TextField field="next_action" />
                <SaveButton>{t("save_idea")}</SaveButton>
              </fieldset>
            </form>
          </Panel>
        </>
      )}
    </>
  );
}
