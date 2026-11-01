import { Plus, Settings, Sprout } from "lucide-react";
import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  type ComponentProps,
  type ReactNode,
} from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { MarkdownView } from "./markdown-view";
import { NativeSelect } from "./ui/native-select";
import { useApp } from "../lib/context";
import { KINDS, OUT_KINDS } from "../lib/messages";
import type { Note, Stats } from "../lib/types";
export { Button, Input, Textarea, Card, Badge, NativeSelect };
export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={`panel gap-3 rounded-lg shadow-none ${className}`}>
      {children}
    </Card>
  );
}
export function Heading({
  title,
  subtitle,
  children,
  captureAction = true,
}: {
  captureAction?: boolean;
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  const { t } = useApp();
  return (
    <header className="page-head">
      <div className="heading-content">
        <div className="heading-title">
          <h1>{title}</h1>
          <div className="mobile-page-actions">
            {captureAction && (
              <Button variant="outline" size="icon" asChild>
                <a href="#/capture" aria-label={t("capture")}>
                  <Plus aria-hidden="true" />
                </a>
              </Button>
            )}
            <Button variant="ghost" size="icon" asChild>
              <a href="#/settings" aria-label={t("settings")}>
                <Settings aria-hidden="true" />
              </a>
            </Button>
          </div>
        </div>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {children}
    </header>
  );
}
export function SectionTabs({
  active,
  group,
}: {
  active: string;
  group: "distill" | "connect";
}) {
  const { t, lang } = useApp();
  const routes =
    group === "distill" ? ["inbox", "review"] : ["library", "timeline"];
  return (
    <nav
      className="section-tabs"
      aria-label={lang === "vi" ? "Chế độ xem" : "View"}
    >
      {routes.map((route) => (
        <a
          key={route}
          href={`#/${route}`}
          aria-current={active === route ? "page" : undefined}
        >
          {t(route)}
        </a>
      ))}
    </nav>
  );
}
export function ResourceState({ error }: { error?: string }) {
  const { lang } = useApp();
  return (
    <Panel>
      <p role={error ? "alert" : "status"}>
        {error || (lang === "vi" ? "Đang tải…" : "Loading…")}
      </p>
      {error && (
        <Button variant="outline" onClick={() => location.reload()}>
          {lang === "vi" ? "Thử lại" : "Retry"}
        </Button>
      )}
    </Panel>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-art" aria-hidden="true">
        <Sprout />
        <span />
        <span />
      </div>
      <div className="empty-copy">{children}</div>
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const hintId = useId();
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {hint
        ? Children.map(children, (child) =>
            isValidElement<{ "aria-describedby"?: string }>(child)
              ? cloneElement(child, {
                  "aria-describedby": [child.props["aria-describedby"], hintId]
                    .filter(Boolean)
                    .join(" "),
                })
              : child,
          )
        : children}
      {hint && (
        <span id={hintId} className="hint">{hint}</span>
      )}
    </label>
  );
}
export function TextField({
  field,
  value,
  type = "text",
  required = false,
}: {
  field: string;
  value?: string;
  type?: string;
  required?: boolean;
}) {
  const { t } = useApp();
  return (
    <Field label={t(field === "source_url" ? "url" : field)}>
      <Input
        name={field}
        type={type}
        defaultValue={value ?? ""}
        required={required}
      />
    </Field>
  );
}
export function AreaField({
  field,
  value,
  rows = 3,
  required = false,
}: {
  field: string;
  value?: string;
  rows?: number;
  required?: boolean;
}) {
  const { t } = useApp();
  const key = field === "why_matters" ? "why" : field;
  return (
    <Field label={t(key)}>
      <Textarea
        name={field}
        defaultValue={value ?? ""}
        rows={rows}
        required={required}
        placeholder={t(`${key}_ph`)}
      />
    </Field>
  );
}
export function SelectField({
  field,
  value,
  options,
}: {
  field: string;
  value?: string;
  options: string[];
}) {
  const { t, kindLabel } = useApp();
  const label = (key: string) =>
    field === "kind"
      ? kindLabel(key)
      : field === "para"
        ? t(`p_${key}`)
        : t(`k_${key}`);
  return (
    <Field label={t(field === "output_kind" ? "out_kind" : field)}>
      <NativeSelect
        name={field === "output_kind" ? "kind" : field}
        defaultValue={value}
      >
        {options.map((key) => (
          <option key={key} value={key}>
            {label(key)}
          </option>
        ))}
      </NativeSelect>
    </Field>
  );
}
export function KindField({ value }: { value?: string }) {
  return (
    <SelectField
      field="kind"
      value={value ?? "idea"}
      options={Object.keys(KINDS.vi)}
    />
  );
}
export function ParaField({ value }: { value?: string }) {
  return (
    <SelectField
      field="para"
      value={value ?? "resource"}
      options={["project", "area", "resource", "archive"]}
    />
  );
}
export function OutputKind() {
  return (
    <SelectField field="output_kind" value="prototype" options={OUT_KINDS} />
  );
}
export function TagsField({
  value = "",
  tags = [],
}: {
  value?: string;
  tags?: string[];
}) {
  const { t } = useApp();
  const id = useId();
  return (
    <Field label={t("tags")}>
      <Input
        name="tags"
        defaultValue={value}
        list={id}
        placeholder={t("tags_ph")}
      />
      <datalist id={id}>
        {tags.map((tag) => (
          <option key={tag} value={tag} />
        ))}
      </datalist>
    </Field>
  );
}
export function SaveButton(props: ComponentProps<typeof Button>) {
  const { t } = useApp();
  return (
    <Button type="submit" {...props}>
      {props.children ?? t("save")}
    </Button>
  );
}
export function DeleteButton({
  onClick,
  children,
  ...props
}: ComponentProps<typeof Button>) {
  const { t } = useApp();
  return (
    <Button
      type="button"
      variant="ghost"
      className="danger"
      {...props}
      onClick={(event) => {
        if (confirm(t("confirm_del"))) onClick?.(event);
      }}
    >
      {children ?? t("del")}
    </Button>
  );
}
export function ExternalLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  if (!/^https?:\/\//i.test(href)) return <span>{children}</span>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}
export function BodyText({ text }: { text: string }) {
  return <MarkdownView text={text} />;
}
export function NoteItem({ note }: { note: Note }) {
  const { kindLabel, t, lang } = useApp();
  return (
    <a className="note-item" href={`#/note/${note.id}`}>
      <div className="row between">
        <span className="kind">
          {kindLabel(note.kind)}
          {note.stage &&
            note.stage !== "distilled" &&
            ` · ${t(`st_${note.stage}`)}`}
        </span>
        <span className="small muted">{fmtDate(note.learned_at, lang)}</span>
      </div>
      <strong>{note.title}</strong>
      <p className="excerpt muted">{note.summary || note.body}</p>
      {!!note.tags?.length && (
        <div className="row tags">
          {note.tags.map((tag) => (
            <Badge key={tag} variant="secondary">
              #{tag}
            </Badge>
          ))}
        </div>
      )}
    </a>
  );
}
export function InboxWarning({ stats }: { stats: Stats }) {
  const { t } = useApp();
  return stats.stages.inbox >= stats.inbox_limit ? (
    <div className="banner">
      {t("inbox_full", { n: stats.stages.inbox, max: stats.inbox_limit })}
      <a href="#/inbox">{t("go_distill")}</a>
    </div>
  ) : null;
}
export function fmtDate(value: string | null, lang: string) {
  if (!value) return "";
  const date = new Date(
    value.length <= 10 ? `${value}T00:00:00` : `${value.replace(" ", "T")}Z`,
  );
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(lang === "vi" ? "vi-VN" : "en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}
