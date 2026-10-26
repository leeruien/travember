package com.travember.destination;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DestinationRepository extends JpaRepository<Destination, UUID> {

    /** Book order: earliest trip is chapter one; undated trips go at the end. */
    @EntityGraph(attributePaths = "places")
    List<Destination> findAllByOrderByStartDateAscCreatedAtAsc();

    @EntityGraph(attributePaths = "places")
    List<Destination> findAllByOwnerIdOrderByStartDateAscCreatedAtAsc(UUID ownerId);

    @EntityGraph(attributePaths = "places")
    List<Destination> findAllByBookIdOrderByStartDateAscCreatedAtAsc(UUID bookId);

    @EntityGraph(attributePaths = "places")
    Optional<Destination> findWithPlacesById(UUID id);
}
