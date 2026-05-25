package com.ot.server.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Resolves which HMS Room.roomType codes belong to the OT category for a given
 * hospital, by reading the hospital's RoomTypeConfig settings from HMS.
 *
 * HMS stores room types as free strings (codes) on Room.roomType, with the
 * code → label → category mapping kept in a separate RoomTypeConfig table.
 * System defaults seed code="OT"/category="OT", but a hospital can register
 * additional OT-category codes (e.g. "OT_MINOR", "OPERATING_ROOM_A"). The
 * only way to know which codes count as OT for a given hospital is to ask HMS.
 *
 * Cached per-hospital with a 5-minute TTL — RoomTypeConfig changes are rare,
 * so this avoids hitting HMS on every rooms fetch.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OtRoomTypeResolver {

    private static final long CACHE_TTL_MS = 5 * 60 * 1000L; // 5 minutes

    @Value("${hms.api.url:https://api-hms.zenohosp.com}")
    private String hmsApiUrl;

    private final RestTemplate restTemplate;

    private final ConcurrentHashMap<UUID, CachedCodes> cache = new ConcurrentHashMap<>();

    /**
     * Returns the set of Room.roomType codes that map to category="OT" for the
     * given hospital. Empty set means the config lookup failed or the hospital
     * has no OT-category types configured — callers should fall back to a
     * heuristic match in either case.
     */
    public Set<String> getOtCodes(UUID hospitalId, String bearerToken) {
        if (hospitalId == null) return Set.of();

        CachedCodes hit = cache.get(hospitalId);
        if (hit != null && hit.fresh()) return hit.codes;

        Set<String> fetched = fetchFromHms(hospitalId, bearerToken);
        if (fetched.isEmpty() && hit != null) {
            // Soft fallback to stale cache when HMS is momentarily unreachable.
            return hit.codes;
        }
        cache.put(hospitalId, new CachedCodes(fetched, System.currentTimeMillis()));
        return fetched;
    }

    private Set<String> fetchFromHms(UUID hospitalId, String bearerToken) {
        try {
            String url = UriComponentsBuilder.fromUriString(hmsApiUrl)
                    .path("/api/settings/room-types")
                    .queryParam("hospitalId", hospitalId)
                    .toUriString();

            HttpHeaders headers = new HttpHeaders();
            if (bearerToken != null && !bearerToken.isBlank()) headers.setBearerAuth(bearerToken);

            ResponseEntity<List<Map<String, Object>>> response = restTemplate.exchange(
                    url, HttpMethod.GET, new HttpEntity<>(headers),
                    new ParameterizedTypeReference<>() {});

            List<Map<String, Object>> configs = response.getBody();
            if (configs == null) return Set.of();

            Set<String> codes = new HashSet<>();
            for (Map<String, Object> cfg : configs) {
                Object category = cfg.get("category");
                Object code = cfg.get("code");
                if (category != null && code != null && "OT".equalsIgnoreCase(category.toString())) {
                    codes.add(code.toString());
                }
            }
            return codes;
        } catch (Exception e) {
            log.warn("Could not fetch RoomTypeConfig from HMS for hospital {}: {}", hospitalId, e.getMessage());
            return Set.of();
        }
    }

    private record CachedCodes(Set<String> codes, long timestamp) {
        boolean fresh() { return System.currentTimeMillis() - timestamp < CACHE_TTL_MS; }
    }
}
