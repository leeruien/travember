package com.travember.social;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;

public final class Dtos {

    private Dtos() {
    }

    public record CommentRequest(@NotBlank @Size(max = 2000) String body) {
    }

    public record CommentResponse(
            UUID id,
            UUID placeId,
            UUID authorId,
            String authorName,
            String body,
            Instant createdAt) {

        static CommentResponse from(Comment c) {
            return new CommentResponse(c.getId(), c.getPlaceId(), c.getAuthorId(), c.getAuthorName(), c.getBody(),
                    c.getCreatedAt());
        }
    }

    public record LikeState(long likeCount, boolean likedByMe) {
    }

    /** The counts shown with a page. `likedByMe` is false for guests. */
    public record PageStats(long likeCount, boolean likedByMe, long commentCount) {
        public static final PageStats NONE = new PageStats(0, false, 0);
    }
}
