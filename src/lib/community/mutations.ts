import { communityApi } from "./api";
import { communityStore, lockedMutation } from "./store";
import type { Post } from "./contract";
export async function togglePost(
  owner: string,
  post: Post,
  kind: "vote" | "save" | "follow",
) {
  const key = `${owner}:${kind}:${kind === "follow" ? post.author.id : post.id}`;
  return lockedMutation(key, async () => {
    const before =
      kind === "vote"
        ? post.viewerVoted
        : kind === "save"
          ? post.viewerSaved
          : post.author.viewerFollows;
    function patch(state: boolean) {
      communityStore.patchPosts(owner, (current) => {
        if (kind === "follow")
          return current.author.id && current.author.id === post.author.id
            ? {
                ...current,
                author: { ...current.author, viewerFollows: state },
              }
            : current;
        if (current.id !== post.id) return current;
        return kind === "save"
          ? { ...current, viewerSaved: state }
          : {
              ...current,
              viewerVoted: state,
              upvoteCount: Math.max(
                0,
                current.upvoteCount +
                  Number(state) -
                  Number(current.viewerVoted),
              ),
            };
      });
    }
    patch(!before);
    try {
      const response = await communityApi<{
        voted?: boolean;
        saved?: boolean;
        following?: boolean;
      }>(
        owner,
        `toggle-${kind}`,
        kind === "follow" ? { targetId: post.author.id } : { postId: post.id },
      );
      const confirmed =
        kind === "vote"
          ? response.voted
          : kind === "save"
            ? response.saved
            : response.following;
      patch(!!confirmed);
      communityStore.invalidate();
      return kind === "save"
        ? confirmed
          ? "Saved"
          : "Removed from saved"
        : kind === "follow"
          ? confirmed
            ? "Following this member"
            : "Unfollowed"
          : "";
    } catch (error) {
      patch(before);
      throw error;
    }
  });
}
