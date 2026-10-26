package com.travember.book;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/** A travel book on the shelf. Its chapters are destinations with this book's id. */
@Entity
@Table(name = "books")
public class Book {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, updatable = false)
    private UUID ownerId;

    @Column(nullable = false)
    private String title;

    private String description;

    /** The cover the author uploaded, or null to fall back to the book's first photo. */
    private String coverUrl;

    /** Copied from the author's token whenever they save the book; readers can't look users up. */
    @Column(nullable = false)
    private String authorName;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    protected Book() {
    }

    public Book(UUID ownerId) {
        this.ownerId = ownerId;
    }

    public UUID getId() { return id; }
    public UUID getOwnerId() { return ownerId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getCoverUrl() { return coverUrl; }
    public void setCoverUrl(String coverUrl) { this.coverUrl = coverUrl; }
    public String getAuthorName() { return authorName; }
    public void setAuthorName(String authorName) { this.authorName = authorName; }
    public Instant getCreatedAt() { return createdAt; }
}
