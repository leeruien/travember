package com.travember.destination;

import com.travember.social.Dtos.PageStats;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class Dtos {

    private Dtos() {
    }

    /**
     * `bookId` is the book the chapter goes in. Leave it out when creating to make a draft; when updating,
     * leaving it out keeps the chapter where it is, and giving one moves it there.
     */
    public record DestinationRequest(
            UUID bookId,
            @NotBlank @Size(max = 200) String title,
            @Size(max = 120) String country,
            @Size(max = 5000) String summary,
            @Size(max = 2000) String coverImageUrl,
            LocalDate startDate,
            LocalDate endDate) {
    }

    public record MediaItem(
            @NotNull @Pattern(regexp = "image|video") String kind,
            @NotBlank @Size(max = 2000) String url) {

        static MediaItem from(Media m) {
            return new MediaItem(m.getKind(), m.getUrl());
        }
    }

    /** A page. The location is required; the write-up (`note`) and the photos and videos are optional. */
    public record PlaceRequest(
            @NotBlank @Size(max = 200) String name,
            @Size(max = 5000) String note,
            @NotNull @DecimalMin("-90") @DecimalMax("90") Double latitude,
            @NotNull @DecimalMin("-180") @DecimalMax("180") Double longitude,
            LocalDate visitedOn,
            @Size(max = 20) List<@Valid MediaItem> media) {
    }

    public record PlaceResponse(
            UUID id,
            UUID destinationId,
            String name,
            String note,
            double latitude,
            double longitude,
            LocalDate visitedOn,
            List<MediaItem> media,
            long likeCount,
            boolean likedByMe,
            long commentCount) {

        static PlaceResponse from(Place p, PageStats s) {
            return new PlaceResponse(p.getId(), p.getDestination().getId(), p.getName(), p.getNote(),
                    p.getLatitude(), p.getLongitude(), p.getVisitedOn(),
                    p.getMedia().stream().map(MediaItem::from).toList(),
                    s.likeCount(), s.likedByMe(), s.commentCount());
        }
    }

    public record DestinationResponse(
            UUID id,
            UUID ownerId,
            UUID bookId,
            String title,
            String country,
            String summary,
            String coverImageUrl,
            LocalDate startDate,
            LocalDate endDate,
            List<PlaceResponse> places) {

        static DestinationResponse from(Destination d, Map<UUID, PageStats> stats) {
            return new DestinationResponse(d.getId(), d.getOwnerId(), d.getBookId(), d.getTitle(), d.getCountry(), d.getSummary(),
                    d.getCoverImageUrl(), d.getStartDate(), d.getEndDate(),
                    d.getPlaces().stream()
                            .map(p -> PlaceResponse.from(p, stats.getOrDefault(p.getId(), PageStats.NONE)))
                            .toList());
        }
    }
}
