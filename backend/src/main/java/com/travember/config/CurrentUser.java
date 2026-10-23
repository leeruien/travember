package com.travember.config;

import java.util.Map;
import java.util.UUID;
import org.springframework.security.oauth2.jwt.Jwt;

/** Reads who is calling from the Supabase access token. */
public final class CurrentUser {

    private CurrentUser() {
    }

    /** Supabase puts the auth.users id in the `sub` claim. */
    public static UUID id(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }

    /** Public reads accept a token when there is one, so this is null for guests. */
    public static UUID idOrNull(Jwt jwt) {
        return jwt == null ? null : id(jwt);
    }

    /**
     * The name shown next to things this user writes: a name from their Supabase profile if they set one,
     * otherwise the part of their email before the @, so the full address is never published.
     */
    public static String displayName(Jwt jwt) {
        Map<String, Object> meta = jwt.getClaimAsMap("user_metadata");
        if (meta != null) {
            for (String key : new String[] {"display_name", "full_name", "name"}) {
                if (meta.get(key) instanceof String s && !s.isBlank()) return truncate(s.trim());
            }
        }
        String email = jwt.getClaimAsString("email");
        if (email != null && email.indexOf('@') > 0) return truncate(email.substring(0, email.indexOf('@')));
        return "Traveller";
    }

    private static String truncate(String s) {
        return s.length() <= 80 ? s : s.substring(0, 80);
    }
}
