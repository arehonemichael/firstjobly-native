export const TOPICS = {
  general: "General",
  job_search_help: "Job search help",
  cv_review: "CV review",
  interview_tips: "Interview tips",
  company_reviews: "Company reviews",
  success_stories: "Success stories",
  career_advice: "Career advice",
  off_topic: "Off-topic",
} as const;
export type Topic = keyof typeof TOPICS;
export const SCOPES = {
  all: "New",
  top: "Top this week",
  saved: "Saved",
  mine: "My posts",
  foryou: "For you",
} as const;
export type Scope = keyof typeof SCOPES;
export const REPORT_REASONS = {
  harassment: "Harassment or bullying",
  hate: "Hate speech",
  spam: "Spam",
  scam: "Scam or fake job",
  personal_info: "Shares personal information",
  sexual: "Sexual content",
  misinformation: "Misinformation",
  other: "Something else",
} as const;
export type Status = "visible" | "held" | "removed" | "author_deleted";
export type Author = {
  id: string | null;
  name: string | null;
  anonymous: boolean;
  handle: string;
  avatarHue: number;
  isMine: boolean;
  viewerFollows: boolean;
};
export type Media = { url: string; width: number; height: number };
export type Post = {
  id: string;
  topic: Topic;
  title: string;
  body: string;
  author: Author;
  upvoteCount: number;
  commentCount: number;
  viewerVoted: boolean;
  viewerSaved: boolean;
  status: Status;
  pinned: boolean;
  piiFlagged: boolean;
  sharedFromGraduateRoom: boolean;
  edited: boolean;
  createdAt: string;
  media: Media[];
};
export type Comment = {
  id: string;
  postId: string;
  parentId: string | null;
  body: string;
  author: Author;
  status: Status;
  edited: boolean;
  createdAt: string;
};
export type Viewer = {
  member: boolean;
  banned: boolean;
  canWrite: boolean;
  isStaff: boolean;
  newAccount: boolean;
};
export type Feed = {
  posts: Post[];
  nextCursor: string | null;
  pinned?: Post[];
};
export type Discussion = {
  post: Post;
  comments: Comment[];
  nextCursor: string | null;
};
export type Photo = {
  data: string;
  width: number;
  height: number;
  name: string;
};
export type Draft = {
  title: string;
  body: string;
  topic: Topic;
  isAnonymous: boolean;
  photos: Photo[];
};
export const EMPTY_DRAFT: Draft = {
  title: "",
  body: "",
  topic: "general",
  isAnonymous: false,
  photos: [],
};
export const SETUP_MESSAGE =
  "Finish setting up your account to join — Community is open to every FirstJobly member with a confirmed email and a completed profile.";
export const ANONYMOUS_HELP =
  "Other members will see a random nickname instead of your name. Moderators can still see who posted.";
export const PII_MESSAGE =
  "Everyone in the Community can see this — we recommend removing it. Posts with ID or phone numbers are flagged for review.";
export function hasPersonalInfo(text: string) {
  return (
    /(?:^|\D)\d{13}(?:\D|$)/.test(text) ||
    /(?:\+27|\b0)[\s-]?[6-8]\d(?:[\s-]?\d){7}\b/.test(text) ||
    /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(text)
  );
}
export function validateText(
  body: string,
  isPost: boolean,
  newAccount: boolean,
  title = "",
) {
  if (isPost && (title.trim().length < 5 || title.length > 140))
    return "Use a title between 5 and 140 characters.";
  const min = isPost ? 20 : 2,
    max = isPost ? 5000 : 2000;
  if (body.trim().length < min || body.length > max)
    return `Use between ${min} and ${max.toLocaleString()} characters.`;
  const links =
    `${isPost ? title : ""} ${body}`.match(/(?:https?:\/\/|www\.)\S+/gi) || [];
  // The server remains authoritative for every validation/spam rule.
  if (links.length > 2) return "Use at most 2 links.";
  if (links.length && newAccount)
    return "Links aren't allowed in your first 24 hours.";
  return "";
}
export function authorName(author: Author) {
  return author.anonymous
    ? author.handle || "Anonymous member"
    : author.name || "FirstJobly member";
}
export function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length > 1)
    return words
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase();
  const capitals = name.match(/[A-Z]/g);
  return capitals?.length
    ? capitals.slice(0, 2).join("")
    : name.trim().slice(0, 1).toUpperCase() || "?";
}
export function sastDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleString("en-ZA", {
    timeZone: "Africa/Johannesburg",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
export function statusMessage(status: Status, reply = false) {
  if (status === "visible") return "";
  if (reply)
    return status === "held"
      ? "Hidden while a moderator reviews it."
      : "This reply was removed.";
  return status === "held"
    ? "Hidden from others while a moderator reviews it."
    : "This discussion is no longer visible to others.";
}
/** Topological rendering keeps orphaned page-boundary replies visible and guards
 * malformed cycles. Depth 0,1,2 are the three supported reply levels. */
export function threadComments(comments: Comment[]) {
  const unique = [...new Map(comments.map((c) => [c.id, c])).values()].sort(
    (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
  );
  const ids = new Set(unique.map((c) => c.id));
  const seen = new Set<string>();
  const out: { comment: Comment; depth: number }[] = [];
  function visit(c: Comment, depth: number) {
    if (seen.has(c.id)) return;
    seen.add(c.id);
    out.push({ comment: c, depth: Math.min(depth, 2) });
    unique
      .filter((child) => child.parentId === c.id)
      .forEach((child) => visit(child, depth + 1));
  }
  unique
    .filter((c) => !c.parentId || !ids.has(c.parentId))
    .forEach((c) => visit(c, 0));
  unique.forEach((c) => visit(c, 0));
  return out;
}
