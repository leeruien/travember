package com.travember.social;

import com.travember.config.CurrentUser;
import com.travember.social.Dtos.CommentRequest;
import com.travember.social.Dtos.CommentResponse;
import com.travember.social.Dtos.LikeState;
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
public class SocialController {

    private final SocialService service;

    public SocialController(SocialService service) {
        this.service = service;
    }

    @PutMapping("/places/{id}/like")
    public LikeState like(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return service.like(CurrentUser.id(jwt), id);
    }

    @DeleteMapping("/places/{id}/like")
    public LikeState unlike(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return service.unlike(CurrentUser.id(jwt), id);
    }

    @GetMapping("/places/{id}/comments")
    public List<CommentResponse> comments(@PathVariable UUID id) {
        return service.comments(id);
    }

    @PostMapping("/places/{id}/comments")
    @ResponseStatus(HttpStatus.CREATED)
    public CommentResponse addComment(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                      @Valid @RequestBody CommentRequest req) {
        return service.addComment(CurrentUser.id(jwt), CurrentUser.displayName(jwt), id, req.body());
    }

    @DeleteMapping("/comments/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteComment(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        service.deleteComment(CurrentUser.id(jwt), id);
    }
}
