"""Checks Supabase access tokens, the same way the Spring Boot API does, so only signed-in users can plan."""

import asyncio
import time
from collections import defaultdict, deque

import jwt


class SupabaseAuth:
    def __init__(self, supabase_url: str, jwt_secret: str | None = None):
        self.issuer = supabase_url.rstrip("/") + "/auth/v1"
        self.secret = jwt_secret or None
        # New projects sign tokens with asymmetric keys published at this URL; older ones use a shared secret.
        self.jwks = None if self.secret else jwt.PyJWKClient(f"{self.issuer}/.well-known/jwks.json", cache_keys=True)

    async def user_id(self, token: str) -> str:
        """The auth.users id the token belongs to. Raises jwt.InvalidTokenError if it isn't valid."""
        if self.secret:
            claims = jwt.decode(token, self.secret, algorithms=["HS256"], audience="authenticated", issuer=self.issuer)
        else:
            # PyJWKClient fetches over blocking HTTP (the keys are cached after the first time).
            key = await asyncio.to_thread(self.jwks.get_signing_key_from_jwt, token)
            claims = jwt.decode(token, key.key, algorithms=["ES256", "RS256"], audience="authenticated", issuer=self.issuer)
        return claims["sub"]


class RateLimiter:
    """At most `limit` plans per user per hour, since each one costs real API spend. In memory: one process only."""

    def __init__(self, limit: int, window_seconds: float = 3600):
        self.limit = limit
        self.window = window_seconds
        self.recent: dict[str, deque[float]] = defaultdict(deque)

    def allow(self, user_id: str) -> bool:
        now = time.monotonic()
        times = self.recent[user_id]
        while times and times[0] <= now - self.window:
            times.popleft()
        if len(times) >= self.limit:
            return False
        times.append(now)
        return True
