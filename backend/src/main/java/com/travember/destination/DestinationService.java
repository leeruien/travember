package com.travember.destination;

import com.travember.destination.Dtos.DestinationRequest;
import com.travember.destination.Dtos.DestinationResponse;
import com.travember.destination.Dtos.PlaceRequest;
import com.travember.destination.Dtos.PlaceResponse;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional
public class DestinationService {

    private final DestinationRepository destinations;
    private final PlaceRepository places;

    public DestinationService(DestinationRepository destinations, PlaceRepository places) {
        this.destinations = destinations;
        this.places = places;
    }

    @Transactional(readOnly = true)
    public List<DestinationResponse> list() {
        return destinations.findAllByOrderByStartDateAscCreatedAtAsc().stream()
                .map(DestinationResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public DestinationResponse get(UUID id) {
        return DestinationResponse.from(findDestination(id));
    }

    public DestinationResponse create(UUID userId, DestinationRequest req) {
        var d = new Destination(userId);
        apply(d, req);
        return DestinationResponse.from(destinations.save(d));
    }

    public DestinationResponse update(UUID userId, UUID id, DestinationRequest req) {
        var d = findOwnedDestination(userId, id);
        apply(d, req);
        return DestinationResponse.from(d);
    }

    public void delete(UUID userId, UUID id) {
        destinations.delete(findOwnedDestination(userId, id));
    }

    public PlaceResponse addPlace(UUID userId, UUID destinationId, PlaceRequest req) {
        var d = findOwnedDestination(userId, destinationId);
        var p = new Place(d);
        apply(p, req);
        d.getPlaces().add(p);
        return PlaceResponse.from(places.save(p));
    }

    public PlaceResponse updatePlace(UUID userId, UUID placeId, PlaceRequest req) {
        var p = findOwnedPlace(userId, placeId);
        apply(p, req);
        return PlaceResponse.from(p);
    }

    public void deletePlace(UUID userId, UUID placeId) {
        var p = findOwnedPlace(userId, placeId);
        p.getDestination().getPlaces().remove(p);
    }

    private Destination findDestination(UUID id) {
        return destinations.findWithPlacesById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Destination not found"));
    }

    private Destination findOwnedDestination(UUID userId, UUID id) {
        var d = findDestination(id);
        requireOwner(userId, d);
        return d;
    }

    private Place findOwnedPlace(UUID userId, UUID placeId) {
        var p = places.findById(placeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Place not found"));
        requireOwner(userId, p.getDestination());
        return p;
    }

    private static void requireOwner(UUID userId, Destination d) {
        if (!d.getOwnerId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the author of this chapter can edit it");
        }
    }

    private static void apply(Destination d, DestinationRequest req) {
        if (req.startDate() != null && req.endDate() != null && req.endDate().isBefore(req.startDate())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "End date is before start date");
        }
        d.setTitle(req.title().trim());
        d.setCountry(blankToNull(req.country()));
        d.setSummary(blankToNull(req.summary()));
        d.setCoverImageUrl(blankToNull(req.coverImageUrl()));
        d.setStartDate(req.startDate());
        d.setEndDate(req.endDate());
    }

    private static void apply(Place p, PlaceRequest req) {
        p.setName(req.name().trim());
        p.setNote(blankToNull(req.note()));
        p.setLatitude(req.latitude());
        p.setLongitude(req.longitude());
        p.setVisitedOn(req.visitedOn());
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
