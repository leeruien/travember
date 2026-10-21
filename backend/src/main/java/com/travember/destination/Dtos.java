package com.travember.destination;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class Dtos {

    private Dtos() {
    }

    public record DestinationRequest(
            @NotBlank @Size(max = 200) String title,
            @Size(max = 120) String country,
            @Size(max = 5000) String summary,
            @Size(max = 2000) String coverImageUrl,
            LocalDate startDate,
            LocalDate endDate) {
    }

    public record PlaceRequest(
            @NotBlank @Size(max = 200) String name,
            @Size(max = 5000) String note,
            @NotNull @DecimalMin("-90") @DecimalMax("90") Double latitude,
            @NotNull @DecimalMin("-180") @DecimalMax("180") Double longitude,
            LocalDate visitedOn) {
    }

    public record PlaceResponse(
            UUID id,
            UUID destinationId,
            String name,
            String note,
            double latitude,
            double longitude,
            LocalDate visitedOn) {

        static PlaceResponse from(Place p) {
            return new PlaceResponse(p.getId(), p.getDestination().getId(), p.getName(), p.getNote(),
                    p.getLatitude(), p.getLongitude(), p.getVisitedOn());
        }
    }

    public record DestinationResponse(
            UUID id,
            UUID ownerId,
            String title,
            String country,
            String summary,
            String coverImageUrl,
            LocalDate startDate,
            LocalDate endDate,
            List<PlaceResponse> places) {

        static DestinationResponse from(Destination d) {
            return new DestinationResponse(d.getId(), d.getOwnerId(), d.getTitle(), d.getCountry(), d.getSummary(),
                    d.getCoverImageUrl(), d.getStartDate(), d.getEndDate(),
                    d.getPlaces().stream().map(PlaceResponse::from).toList());
        }
    }
}
