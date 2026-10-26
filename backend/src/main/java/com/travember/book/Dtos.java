package com.travember.book;

import com.travember.destination.Dtos.DestinationResponse;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

public final class Dtos {

    private Dtos() {
    }

    /** `coverUrl` must be an upload in the author's own folder; leave it empty for the automatic cover. */
    public record BookRequest(
            @NotBlank @Size(max = 200) String title,
            @Size(max = 2000) String description,
            @Size(max = 2000) String coverUrl) {
    }

    /**
     * A book as it appears on the shelf. `coverUrl` is what to show: the author's cover, or else the book's
     * first photo, or null for the plain designed cover. `customCoverUrl` is only the one the author chose.
     */
    public record BookSummary(
            UUID id,
            UUID ownerId,
            String title,
            String description,
            String authorName,
            String coverUrl,
            String customCoverUrl,
            long chapterCount,
            long pageCount) {
    }

    /** A book opened: everything on the shelf, plus its chapters (with their pages) in book order. */
    public record BookDetail(
            UUID id,
            UUID ownerId,
            String title,
            String description,
            String authorName,
            String coverUrl,
            String customCoverUrl,
            long chapterCount,
            long pageCount,
            List<DestinationResponse> chapters) {

        static BookDetail from(BookSummary b, List<DestinationResponse> chapters) {
            return new BookDetail(b.id(), b.ownerId(), b.title(), b.description(), b.authorName(), b.coverUrl(),
                    b.customCoverUrl(), b.chapterCount(), b.pageCount(), chapters);
        }
    }
}
