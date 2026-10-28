package com.travember.social;

import com.travember.social.Dtos.CommentResponse;
import com.travember.social.Dtos.LikeState;
import com.travember.social.Dtos.PageStats;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Likes and comments on pages. Anyone signed in can like or comment on any page. Likes are plain SQL:
 * they're a (page, user) pair with no behaviour, and counting them in bulk is what the book page needs.
 */
@Service
@Transactional
public class SocialService {

    private final JdbcClient jdbc;
    private final CommentRepository comments;

    public SocialService(JdbcClient jdbc, CommentRepository comments) {
        this.jdbc = jdbc;
        this.comments = comments;
    }

    /** Counts for many pages at once, in three queries however many pages there are. */
    @Transactional(readOnly = true)
    public Map<UUID, PageStats> stats(Collection<UUID> placeIds, UUID viewerId) {
        if (placeIds.isEmpty()) return Map.of();
        var likes = countByPlace("select place_id, count(*) from place_likes where place_id in (:ids) group by place_id",
                placeIds);
        var commentCounts = countByPlace(
                "select place_id, count(*) from place_comments where place_id in (:ids) group by place_id", placeIds);
        Set<UUID> liked = viewerId == null ? Set.of() : new HashSet<>(jdbc
                .sql("select place_id from place_likes where user_id = :user and place_id in (:ids)")
                .param("user", viewerId)
                .param("ids", placeIds)
                .query(UUID.class)
                .list());

        var result = new HashMap<UUID, PageStats>();
        for (UUID id : placeIds) {
            result.put(id, new PageStats(likes.getOrDefault(id, 0L), liked.contains(id),
                    commentCounts.getOrDefault(id, 0L)));
        }
        return result;
    }

    public LikeState like(UUID userId, UUID placeId) {
        pageOwner(placeId, userId);
        jdbc.sql("insert into place_likes (place_id, user_id) values (:place, :user) on conflict do nothing")
                .param("place", placeId)
                .param("user", userId)
                .update();
        return likeState(userId, placeId);
    }

    public LikeState unlike(UUID userId, UUID placeId) {
        pageOwner(placeId, userId);
        jdbc.sql("delete from place_likes where place_id = :place and user_id = :user")
                .param("place", placeId)
                .param("user", userId)
                .update();
        return likeState(userId, placeId);
    }

    /** `viewerId` is null for guests. */
    @Transactional(readOnly = true)
    public List<CommentResponse> comments(UUID placeId, UUID viewerId) {
        pageOwner(placeId, viewerId);
        return comments.findByPlaceIdOrderByCreatedAtAsc(placeId).stream().map(CommentResponse::from).toList();
    }

    public CommentResponse addComment(UUID userId, String authorName, UUID placeId, String body) {
        pageOwner(placeId, userId);
        return CommentResponse.from(comments.save(new Comment(placeId, userId, authorName, body.trim())));
    }

    /** A comment can be removed by whoever wrote it, or by the author of the page it's on. */
    public void deleteComment(UUID userId, UUID commentId) {
        var c = comments.findById(commentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Comment not found"));
        if (!c.getAuthorId().equals(userId) && !pageOwner(c.getPlaceId(), userId).equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Only the comment's author or the page's author can delete it");
        }
        comments.delete(c);
    }

    private LikeState likeState(UUID userId, UUID placeId) {
        var s = stats(List.of(placeId), userId).get(placeId);
        return new LikeState(s.likeCount(), s.likedByMe());
    }

    /**
     * The user who wrote the chapter this page is in. 404 if the page doesn't exist, or if it's in someone
     * else's private book or draft chapter (no book counts as private): nobody else can read, like or
     * comment on it.
     */
    private UUID pageOwner(UUID placeId, UUID viewerId) {
        record Page(UUID ownerId, boolean isPrivate) {
        }
        var page = jdbc.sql("""
                        select d.owner_id, coalesce(b.is_private, true) from places p
                        join destinations d on d.id = p.destination_id
                        left join books b on b.id = d.book_id
                        where p.id = :id""")
                .param("id", placeId)
                .query((rs, n) -> new Page(rs.getObject(1, UUID.class), rs.getBoolean(2)))
                .optional()
                .filter(p -> !p.isPrivate() || p.ownerId().equals(viewerId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Page not found"));
        return page.ownerId();
    }

    private Map<UUID, Long> countByPlace(String sql, Collection<UUID> placeIds) {
        return jdbc.sql(sql).param("ids", placeIds)
                .query((rs, n) -> Map.entry(rs.getObject(1, UUID.class), rs.getLong(2)))
                .stream()
                .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
    }
}
