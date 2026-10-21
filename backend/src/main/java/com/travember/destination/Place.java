package com.travember.destination;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/** A pin on the map: somewhere you went during a trip. */
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
}
