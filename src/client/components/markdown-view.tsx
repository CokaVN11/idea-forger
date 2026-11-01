import { useEffect, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { useApp } from "../lib/context";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";

const extensions = [
  StarterKit.configure({
    link: { openOnClick: true, HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" } },
  }),
  TaskList,
  TaskItem,
  Table,
  TableRow,
  TableHeader,
  TableCell,
  Markdown,
];

// Read-only render of a markdown body; the markdown stays the stored format.
export function MarkdownView({ text }: { text: string }) {
  const editor = useEditor({
    extensions,
    content: text,
    contentType: "markdown",
    editable: false,
    immediatelyRender: false,
  });
  useEffect(() => {
    if (editor) editor.commands.setContent(text, { contentType: "markdown" });
  }, [editor, text]);
  return <EditorContent editor={editor} className="body-text md-view" />;
}

// Tiptap's serializer escapes `[[x]]`, `_`, `&`, `~` and `\\`, and turns bare URLs into `[url](url)`;
// undo that so vault notes survive an edit. shortcut: a literal `\\` before a letter collapses to `\`.
const unescapeMd = (md: string) =>
  md
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, text: string, href: string) =>
      text.replace(/\\(.)/g, "$1") === href ? href : m,
    )
    .replace(/\\\[\\\[(.*?)\\\]\\\]/g, "[[$1]]")
    .replace(/(\w)\\_(?=\w)/g, "$1_")
    .replace(/&amp;/g, "&")
    .replace(/\\~/g, "~")
    .replace(/\\\\(?=[A-Za-z])/g, "\\");

// In-place editor for a form: the markdown is submitted through a hidden `body` input.
export function MarkdownField({ value }: { value: string }) {
  const { t } = useApp();
  const [md, setMd] = useState(value);
  const editor = useEditor({
    extensions,
    content: value,
    contentType: "markdown",
    immediatelyRender: false,
    onUpdate: ({ editor }) => setMd(unescapeMd(editor.getMarkdown())),
  });
  return (
    // A div, not Field's <label>: a label would forward clicks to the first task checkbox.
    <div className="field">
      <span className="field-label">{t("body")}</span>
      <EditorContent editor={editor} className="md-view md-edit" />
      <input type="hidden" name="body" value={md} />
    </div>
  );
}
