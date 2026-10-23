package com.travember.destination;

import com.travember.config.AppProperties;
import com.travember.destination.Dtos.DestinationRequest;
import com.travember.destination.Dtos.DestinationResponse;
import com.travember.destination.Dtos.MediaItem;
import com.travember.destination.Dtos.PlaceRequest;
import com.travember.destination.Dtos.PlaceResponse;
import com.travember.social.Dtos.PageStats;
import com.travember.social.SocialService;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional
public class DestinationService {

    /** Must match the bucket created in supabase/schema.sql. */
    private static final String MEDIA_BUCKET = "page-media";

    private final DestinationRepository destinations;
    private final PlaceRepository places;
    private final SocialService social;
    private final String mediaUrlPrefix;

    public DestinationService(DestinationRepository destinations, PlaceRepository places, SocialService social,
                              AppProperties props) {
        this.destinations = destinations;
        this.places = places;
        this.social = social;
        this.mediaUrlPrefix = props.supabaseUrl().replaceAll("/+$", "")
                + "/storage/v1/object/public/" + MEDIA_BUCKET + "/";
    }

    /** `viewerId` is null for guests; it only decides `likedByMe`. */
    @Transactional(readOnly = true)
    public List<DestinationResponse> list(UUID viewerId) {
        var all = destinations.findAllByOrderByStartDateAscCreatedAtAsc();
        var stats = social.stats(all.stream().flatMap(d -> d.getPlaces().stream()).map(Place::getId).toList(), viewerId);
        return all.stream().map(d -> DestinationResponse.from(d, stats)).toList();
    }

    @Transactional(readOnly = true)
    public DestinationResponse get(UUID id, UUID viewerId) {
        return respond(findDestination(id), viewerId);
    }

    public DestinationResponse create(UUID userId, DestinationRequest req) {
        var d = new Destination(userId);
        apply(d, req);
        return DestinationResponse.from(destinations.save(d), Map.of());
    }

    public DestinationResponse update(UUID userId, UUID id, DestinationRequest req) {
        var d = findOwnedDestination(userId, id);
        apply(d, req);
        return respond(d, userId);
    }

    public void delete(UUID userId, UUID id) {
        destinations.delete(findOwnedDestination(userId, id));
    }

    public PlaceResponse addPlace(UUID userId, UUID destinationId, PlaceRequest req) {
        var d = findOwnedDestination(userId, destinationId);
        var p = new Place(d);
        apply(p, req, userId);
        d.getPlaces().add(p);
        return PlaceResponse.from(places.save(p), PageStats.NONE);
    }

    public PlaceResponse updatePlace(UUID userId, UUID placeId, PlaceRequest req) {
        var p = findOwnedPlace(userId, placeId);
        apply(p, req, userId);
        return PlaceResponse.from(p, social.stats(List.of(p.getId()), userId).get(p.getId()));
    }

    public void deletePlace(UUID userId, UUID placeId) {
        var p = findOwnedPlace(userId, placeId);
        p.getDestination().getPlaces().remove(p);
    }

    private DestinationResponse respond(Destination d, UUID viewerId) {
        return DestinationResponse.from(d, social.stats(d.getPlaces().stream().map(Place::getId).toList(), viewerId));
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

    private void apply(Place p, PlaceRequest req, UUID ownerId) {
        var media = req.media() == null ? List.<MediaItem>of() : req.media();
        // Only files the author uploaded to their own Storage folder, so a page can't hotlink arbitrary URLs.
        var folder = mediaUrlPrefix + ownerId + "/";
        for (var m : media) {
            if (!m.url().startsWith(folder) || m.url().contains("..")) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Photos and videos must be uploaded from the page editor");
            }
        }
        p.setName(req.name().trim());
        p.setNote(blankToNull(req.note()));
        p.setLatitude(req.latitude());
        p.setLongitude(req.longitude());
        p.setVisitedOn(req.visitedOn());
        p.getMedia().clear();
        media.forEach(m -> p.getMedia().add(new Media(m.kind(), m.url())));
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
