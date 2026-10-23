package com.travember.social;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/** A reader's comment on a page. */
@Entity
@Table(name = "place_comments")
public class Comment {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, updatable = false)
    private UUID placeId;

    @Column(nullable = false, updatable = false)
    private UUID authorId;

    /** Copied from the author's token when they comment, since auth.users isn't readable by readers. */
    @Column(nullable = false, updatable = false)
    private String authorName;

    @Column(nullable = false, updatable = false)
    private String body;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    protected Comment() {
    }

    public Comment(UUID placeId, UUID authorId, String authorName, String body) {
        this.placeId = placeId;
        this.authorId = authorId;
        this.authorName = authorName;
        this.body = body;
    }

    public UUID getId() { return id; }
    public UUID getPlaceId() { return placeId; }
    public UUID getAuthorId() { return authorId; }
    public String getAuthorName() { return authorName; }
    public String getBody() { return body; }
    public Instant getCreatedAt() { return createdAt; }
}
