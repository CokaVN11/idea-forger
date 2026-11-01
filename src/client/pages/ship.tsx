import type { FormEvent } from "react";
import { api, formBody, todayStr } from "../lib/api";
import { useApp, useResource, useTask } from "../lib/context";
import type { Output } from "../lib/types";
import {
  Badge,
  Button,
  ExternalLink,
  Heading,
  OutputKind,
  Panel,
  ResourceState,
  SaveButton,
  TextField,
  fmtDate,
} from "../components/shared";
const statuses = ["planned", "doing", "shipped"];
export function Ship() {
  const { t, lang, refresh, notify } = useApp();
  const { busy, run } = useTask();
  const { data, error } = useResource<{ outputs: Output[] }>("/outputs");
  const mutate = (task: () => Promise<unknown>) =>
    void run(async () => {
      await task();
      refresh();
    });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const body = formBody(form);
    mutate(async () => {
      await api("/outputs", "POST", body);
      form.reset();
    });
  };
  if (!data) return <ResourceState error={error} />;
  const doing = data.outputs.filter(
    (output) => output.status === "doing",
  ).length;
  return (
    <>
      <Heading title={t("outputs")} subtitle={t("ship_sub")} />
      {doing > 2 && <div className="banner">{t("wip_warn", { n: 2 })}</div>}
      <Panel>
        <form onSubmit={submit}>
          <fieldset disabled={busy}>
            <div className="output-form">
              <TextField field="title" required />
              <OutputKind />
              <TextField field="deadline" type="date" />
              <SaveButton>{t("add")}</SaveButton>
            </div>
          </fieldset>
        </form>
      </Panel>
      <div className="kanban">
        {statuses.map((status, index) => (
          <section key={status} className="kanban-column">
            <h2 className="row between">
              {t(status === "shipped" ? "out_shipped" : status)}
              <Badge variant="secondary">
                {
                  data.outputs.filter((output) => output.status === status)
                    .length
                }
                {status === "doing" && "/2"}
              </Badge>
            </h2>
            {data.outputs
              .filter((output) => output.status === status)
              .map((output) => (
                <Panel key={output.id}>
                  <div className="row between">
                    <span className="kind">{t(`k_${output.kind}`)}</span>
                    {output.deadline && (
                      <time
                        className={`small ${output.deadline < todayStr() && status !== "shipped" ? "danger" : "muted"}`}
                      >
                        {fmtDate(output.deadline, lang)}
                      </time>
                    )}
                  </div>
                  <h3>
                    {output.url ? (
                      <ExternalLink href={output.url}>
                        {output.title}
                      </ExternalLink>
                    ) : (
                      output.title
                    )}
                  </h3>
                  {output.notes.map((note) => (
                    <a
                      key={note.id}
                      className="small muted"
                      href={`#/note/${note.id}`}
                    >
                      ↳ {note.title}
                    </a>
                  ))}
                  <div className="row between">
                    <div className="row">
                      {index > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          aria-label={t(statuses[index - 1])}
                          onClick={() =>
                            mutate(() =>
                              api(`/outputs/${output.id}`, "PATCH", {
                                status: statuses[index - 1],
                              }),
                            )
                          }
                        >
                          ←
                        </Button>
                      )}
                      {index < 2 && (
                        <Button
                          size="sm"
                          disabled={busy}
                          aria-label={t(
                            statuses[index + 1] === "shipped"
                              ? "out_shipped"
                              : statuses[index + 1],
                          )}
                          onClick={() =>
                            mutate(async () => {
                              await api(`/outputs/${output.id}`, "PATCH", {
                                status: statuses[index + 1],
                              });
                              if (index === 1) notify("Shipped!");
                            })
                          }
                        >
                          →
                        </Button>
                      )}
                    </div>
                    <div className="row">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => {
                          const url = prompt("URL", output.url || "");
                          if (url !== null)
                            mutate(() =>
                              api(`/outputs/${output.id}`, "PATCH", { url }),
                            );
                        }}
                      >
                        URL
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        aria-label={t("del")}
                        onClick={() => {
                          if (confirm(t("confirm_del")))
                            mutate(() =>
                              api(`/outputs/${output.id}`, "DELETE"),
                            );
                        }}
                      >
                        ✕
                      </Button>
                    </div>
                  </div>
                </Panel>
              ))}
          </section>
        ))}
      </div>
    </>
  );
}
