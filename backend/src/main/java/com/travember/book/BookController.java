package com.travember.book;

import com.travember.book.Dtos.BookDetail;
import com.travember.book.Dtos.BookRequest;
import com.travember.book.Dtos.BookSummary;
import com.travember.config.CurrentUser;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/books")
public class BookController {

    private final BookService service;

    public BookController(BookService service) {
        this.service = service;
    }

    @GetMapping
    public List<BookSummary> search(@AuthenticationPrincipal Jwt jwt,
                                    @RequestParam(required = false) String q,
                                    @RequestParam(required = false) UUID ownerId,
                                    @RequestParam(required = false) UUID excludeOwnerId) {
        return service.search(q, ownerId, excludeOwnerId, CurrentUser.idOrNull(jwt));
    }

    @GetMapping("/{id}")
    public BookDetail get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return service.get(id, CurrentUser.idOrNull(jwt));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public BookSummary create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody BookRequest req) {
        return service.create(CurrentUser.id(jwt), CurrentUser.displayName(jwt), req);
    }

    @PutMapping("/{id}")
    public BookSummary update(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody BookRequest req) {
        return service.update(CurrentUser.id(jwt), CurrentUser.displayName(jwt), id, req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        service.delete(CurrentUser.id(jwt), id);
    }
}
