package com.travember.destination;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.hibernate.annotations.BatchSize;

/**
 * A page of a chapter: somewhere you went during a trip, with its photos, videos and an optional write-up.
 * Each page is a pin on the map. (The table predates "pages", hence the name.)
 */
@Entity
@Table(name = "places")
public class Place {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "destination_id", nullable = false, updatable = false)
    private Destination destination;

    @Column(nullable = false)
    private String name;

    private String note;

    @Column(nullable = false)
    private double latitude;

    @Column(nullable = false)
    private double longitude;

    private LocalDate visitedOn;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    // Batched so listing the whole book loads media in a few queries rather than one per page.
    @ElementCollection
    @CollectionTable(name = "place_media", joinColumns = @JoinColumn(name = "place_id"))
    @OrderColumn(name = "position")
    @BatchSize(size = 100)
    private List<Media> media = new ArrayList<>();

    protected Place() {
    }

    public Place(Destination destination) {
        this.destination = destination;
    }

    public UUID getId() { return id; }
    public Destination getDestination() { return destination; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
    public double getLatitude() { return latitude; }
    public void setLatitude(double latitude) { this.latitude = latitude; }
    public double getLongitude() { return longitude; }
    public void setLongitude(double longitude) { this.longitude = longitude; }
    public LocalDate getVisitedOn() { return visitedOn; }
    public void setVisitedOn(LocalDate visitedOn) { this.visitedOn = visitedOn; }
    public Instant getCreatedAt() { return createdAt; }
    public List<Media> getMedia() { return media; }
}
