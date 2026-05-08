package com.ot.server.service;

import com.ot.server.entity.OtBooking;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class OtHmsIntegrationService {

    @Value("${hms.api.url:https://api-hms.zenohosp.com}")
    private String hmsApiUrl;

    private final RestTemplate restTemplate;

    /**
     * Finds the active (ADMITTED) HMS admission for the patient identified by MRN.
     * Returns the full admission map or null if not found or HMS is unreachable.
     */
    public Map<String, Object> findActiveAdmission(OtBooking booking, UUID hospitalId, String bearerToken) {
        try {
            // Use cached HMS patient ID, fall back to patientId field, then MRN search
            Integer hmsPatientId = booking.getHmsPatientId();
            if (hmsPatientId == null && booking.getPatientId() != null) {
                hmsPatientId = booking.getPatientId().intValue();
            }
            if (hmsPatientId == null) {
                if (booking.getPatientMrn() == null || booking.getPatientMrn().isBlank()) return null;
                hmsPatientId = resolveHmsPatientId(booking.getPatientMrn(), hospitalId, bearerToken);
                if (hmsPatientId == null) return null;
            }

            String url = hmsApiUrl + "/api/admissions/patient/" + hmsPatientId;
            HttpHeaders headers = authHeaders(bearerToken);

            var resp = restTemplate.exchange(url, HttpMethod.GET, new HttpEntity<>(headers),
                    new ParameterizedTypeReference<List<Map<String, Object>>>() {});

            if (resp.getBody() == null) return null;
            return resp.getBody().stream()
                    .filter(a -> "ADMITTED".equals(a.get("status")))
                    .findFirst()
                    .orElse(null);
        } catch (Exception e) {
            log.warn("Could not fetch HMS admission for patient MRN={}: {}", booking.getPatientMrn(), e.getMessage());
            return null;
        }
    }

    /**
     * Moves an admitted HMS patient to the OT room.
     * Returns the updated admission or null on failure.
     */
    public Map<String, Object> moveToOT(UUID admissionId, Long roomId, UUID surgeonId, UUID otBookingId, String bearerToken) {
        try {
            String url = String.format("%s/api/admissions/%s/move-to-ot", hmsApiUrl, admissionId);
            Map<String, Object> body = new java.util.HashMap<>();
            body.put("roomId", roomId);
            if (surgeonId != null) body.put("doctorId", surgeonId);
            if (otBookingId != null) body.put("otBookingId", otBookingId);

            var resp = restTemplate.exchange(url, HttpMethod.PATCH,
                    new HttpEntity<>(body, authHeaders(bearerToken)),
                    new ParameterizedTypeReference<Map<String, Object>>() {});
            log.info("Moved admission {} to OT room {}", admissionId, roomId);
            return resp.getBody();
        } catch (Exception e) {
            log.warn("Failed to move admission {} to OT room {}: {}", admissionId, roomId, e.getMessage());
            return null;
        }
    }

    /**
     * Returns a patient from OT, optionally to a post-OT recovery room.
     */
    public void returnFromOT(UUID admissionId, Long postOtRoomId, String bearerToken) {
        try {
            String url = String.format("%s/api/admissions/%s/return-from-ot", hmsApiUrl, admissionId);
            Map<String, Object> body = new java.util.HashMap<>();
            if (postOtRoomId != null) body.put("postOtRoomId", postOtRoomId);

            restTemplate.exchange(url, HttpMethod.PATCH,
                    new HttpEntity<>(body, authHeaders(bearerToken)), Object.class);
            log.info("Returned admission {} from OT (postOtRoom={})", admissionId, postOtRoomId);
        } catch (Exception e) {
            log.warn("Failed to return admission {} from OT: {}", admissionId, e.getMessage());
        }
    }

    public Integer resolveHmsPatientId(String mrn, UUID hospitalId, String bearerToken) {
        if (mrn == null || mrn.isBlank()) return null;
        try {
            String url = UriComponentsBuilder.fromUriString(hmsApiUrl)
                    .path("/api/patients/search")
                    .queryParam("hospitalId", hospitalId)
                    .queryParam("q", mrn)
                    .toUriString();
            var resp = restTemplate.exchange(url, HttpMethod.GET,
                    new HttpEntity<>(authHeaders(bearerToken)),
                    new ParameterizedTypeReference<List<Map<String, Object>>>() {});
            if (resp.getBody() != null && !resp.getBody().isEmpty()) {
                Object id = resp.getBody().get(0).get("id");
                if (id != null) return Integer.parseInt(id.toString());
            }
        } catch (Exception e) {
            log.warn("Could not resolve HMS patientId for MRN={}: {}", mrn, e.getMessage());
        }
        return null;
    }

    private HttpHeaders authHeaders(String bearerToken) {
        HttpHeaders headers = new HttpHeaders();
        if (bearerToken != null && !bearerToken.isBlank()) {
            headers.setBearerAuth(bearerToken);
        }
        return headers;
    }
}
