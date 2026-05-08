package com.ot.server.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.List;
import java.util.UUID;

/**
 * JWT utility for the Asset Manager.
 * Uses the same HMAC secret as the Directory Backend
 * so tokens issued by Directory are valid here.
 */
@Component
public class JwtUtil {

    private final SecretKey key;

    public JwtUtil(@Value("${jwt.secret}") String secret) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    public Claims parseToken(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public UUID getUserId(String token) {
        return UUID.fromString(parseToken(token).getSubject());
    }

    public UUID extractUserId(String token) {
        return getUserId(token);
    }

    public String getRole(String token) {
        return parseToken(token).get("role", String.class);
    }

    public String getSubscriptionPlan(String token) {
        return parseToken(token).get("subscriptionPlan", String.class);
    }

    public String getEmail(String token) {
        return parseToken(token).get("email", String.class);
    }

    public UUID getHospitalId(String token) {
        String hid = parseToken(token).get("hospitalId", String.class);
        return hid != null ? UUID.fromString(hid) : null;
    }

    public UUID extractHospitalId(String token) {
        return getHospitalId(token);
    }

    @SuppressWarnings("unchecked")
    public List<String> getModules(String token) {
        return parseToken(token).get("modules", List.class);
    }

    public boolean isValid(String token) {
        try {
            parseToken(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    public String generateToken(UUID userId, UUID hospitalId, String role) {
        return Jwts.builder()
                .subject(userId.toString())
                .claim("hospitalId", hospitalId.toString())
                .claim("role", role)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + 86_400_000L))
                .signWith(key)
                .compact();
    }
}
