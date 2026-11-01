export interface Note {
  id: number;
  title: string;
  kind: string;
  body: string;
  summary: string;
  why_matters: string;
  source_url: string;
  source_title: string;
  tags: string[];
  stage: string;
  para: string;
  para_ref: string;
  next_action: string;
  learned_at: string;
  review_due: string | null;
  review_count: number;
}
export interface NoteLink {
  id: number;
  link_id: number;
  title: string;
  reason: string;
}
export interface Output {
  id: number;
  title: string;
  kind: string;
  status: string;
  url: string;
  deadline: string;
  notes: Pick<Note, "id" | "title">[];
}
export interface Tag {
  name: string;
  c: number;
}
export interface Stats {
  today: string;
  stages: Record<string, number>;
  inbox_limit: number;
  reviews_due: number;
  captured_30d: number;
  shipped_30d: number;
  ship_ratio: number;
  links: number;
  sparks_30d: number;
  weekly_capture: { wk: string; c: number }[];
  weekly_ship: { wk: string; c: number }[];
  next_actions: Note[];
  outputs: Record<string, number>;
}
export interface NoteDetail {
  note: Note;
  links: NoteLink[];
  backlinks: NoteLink[];
  outputs: Output[];
}
