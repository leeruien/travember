package com.travember.destination;

import com.travember.destination.Dtos.DestinationRequest;
import com.travember.destination.Dtos.DestinationResponse;
import com.travember.destination.Dtos.PlaceRequest;
import com.travember.destination.Dtos.PlaceResponse;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class DestinationController {

    private final DestinationService service;

    public DestinationController(DestinationService service) {
        this.service = service;
    }

    @GetMapping("/destinations")
    public List<DestinationResponse> list() {
        return service.list();
    }

    @GetMapping("/destinations/{id}")
    public DestinationResponse get(@PathVariable UUID id) {
        return service.get(id);
    }

    @PostMapping("/destinations")
    @ResponseStatus(HttpStatus.CREATED)
    public DestinationResponse create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody DestinationRequest req) {
        return service.create(userId(jwt), req);
    }

    @PutMapping("/destinations/{id}")
    public DestinationResponse update(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                      @Valid @RequestBody DestinationRequest req) {
        return service.update(userId(jwt), id, req);
    }

    @DeleteMapping("/destinations/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        service.delete(userId(jwt), id);
    }

    @PostMapping("/destinations/{id}/places")
    @ResponseStatus(HttpStatus.CREATED)
    public PlaceResponse addPlace(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                  @Valid @RequestBody PlaceRequest req) {
        return service.addPlace(userId(jwt), id, req);
    }

    @PutMapping("/places/{id}")
    public PlaceResponse updatePlace(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                     @Valid @RequestBody PlaceRequest req) {
        return service.updatePlace(userId(jwt), id, req);
    }

    @DeleteMapping("/places/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deletePlace(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        service.deletePlace(userId(jwt), id);
    }

    /** Supabase puts the auth.users id in the `sub` claim. */
    private static UUID userId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }
}
