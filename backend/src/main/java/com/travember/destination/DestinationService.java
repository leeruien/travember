package com.travember.destination;

import com.travember.config.MediaStorage;
import com.travember.destination.Dtos.DestinationRequest;
import com.travember.destination.Dtos.DestinationResponse;
import com.travember.destination.Dtos.MediaItem;
import com.travember.destination.Dtos.PlaceRequest;
import com.travember.destination.Dtos.PlaceResponse;
import com.travember.social.Dtos.PageStats;
import com.travember.social.SocialService;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional
public class DestinationService {

    private final DestinationRepository destinations;
    private final PlaceRepository places;
    private final SocialService social;
    private final MediaStorage media;
    private final JdbcClient jdbc;

    public DestinationService(DestinationRepository destinations, PlaceRepository places, SocialService social,
                              MediaStorage media, JdbcClient jdbc) {
        this.destinations = destinations;
        this.places = places;
        this.social = social;
        this.media = media;
        this.jdbc = jdbc;
    }

    /**
     * Every chapter the viewer may see, or only one author's when `ownerId` is given. `viewerId` is null for
     * guests; it decides which drafts and private books' chapters are left out, and `likedByMe`.
     */
    @Transactional(readOnly = true)
    public List<DestinationResponse> list(UUID ownerId, UUID viewerId) {
        var all = ownerId == null
                ? destinations.findAllByOrderByStartDateAscCreatedAtAsc()
                : destinations.findAllByOwnerIdOrderByStartDateAscCreatedAtAsc(ownerId);
        var hidden = hiddenBookIds(viewerId);
        return respond(all.stream().filter(d -> visible(d, viewerId, hidden)).toList(), viewerId);
    }

    /** A book's chapters, in book order. The caller has already checked the viewer may see the book. */
    @Transactional(readOnly = true)
    public List<DestinationResponse> listByBook(UUID bookId, UUID viewerId) {
        return respond(destinations.findAllByBookIdOrderByStartDateAscCreatedAtAsc(bookId), viewerId);
    }

    @Transactional(readOnly = true)
    public DestinationResponse get(UUID id, UUID viewerId) {
        var d = findDestination(id);
        if (!visible(d, viewerId, hiddenBookIds(viewerId))) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Destination not found");
        }
        return respond(d, viewerId);
    }

    /** Without a `bookId` the chapter is a draft, in no book yet. */
    public DestinationResponse create(UUID userId, DestinationRequest req) {
        if (req.bookId() != null) {
            requireBookOwner(userId, req.bookId());
        }
        var d = new Destination(userId, req.bookId());
        apply(d, req);
        return DestinationResponse.from(destinations.save(d), Map.of());
    }

    /** A `bookId` moves the chapter into that book (a draft into its first book, or between books). */
    public DestinationResponse update(UUID userId, UUID id, DestinationRequest req) {
        var d = findOwnedDestination(userId, id);
        if (req.bookId() != null && !req.bookId().equals(d.getBookId())) {
            requireBookOwner(userId, req.bookId());
            d.setBookId(req.bookId());
        }
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

    private List<DestinationResponse> respond(List<Destination> ds, UUID viewerId) {
        var stats = social.stats(ds.stream().flatMap(d -> d.getPlaces().stream()).map(Place::getId).toList(), viewerId);
        return ds.stream().map(d -> DestinationResponse.from(d, stats)).toList();
    }

    /** Drafts are their author's alone; a book's chapters are hidden when the book is someone else's private one. */
    private static boolean visible(Destination d, UUID viewerId, Set<UUID> hiddenBooks) {
        return d.getBookId() == null ? d.getOwnerId().equals(viewerId) : !hiddenBooks.contains(d.getBookId());
    }

    /** Private books that aren't the viewer's: their chapters are "not found" for this viewer. */
    private Set<UUID> hiddenBookIds(UUID viewerId) {
        var sql = "select id from books where is_private" + (viewerId == null ? "" : " and owner_id <> :viewerId");
        var query = jdbc.sql(sql);
        if (viewerId != null) query = query.param("viewerId", viewerId);
        return new HashSet<>(query.query(UUID.class).list());
    }

    /** Books live in their own package, which depends on this one, so look the owner up directly. */
    private void requireBookOwner(UUID userId, UUID bookId) {
        var owner = jdbc.sql("select owner_id from books where id = :id")
                .param("id", bookId)
                .query(UUID.class)
                .optional()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Book not found"));
        if (!owner.equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only add chapters to your own books");
        }
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
        var items = req.media() == null ? List.<MediaItem>of() : req.media();
        for (var m : items) {
            if (!media.isOwnUpload(ownerId, m.url())) {
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
        items.forEach(m -> p.getMedia().add(new Media(m.kind(), m.url())));
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
