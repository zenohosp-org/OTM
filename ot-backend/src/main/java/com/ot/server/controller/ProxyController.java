package com.ot.server.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import com.ot.server.entity.OtBooking;
import com.ot.server.entity.OtBookingStatus;
import com.ot.server.repository.OtBookingRepository;
import com.ot.server.security.JwtUtil;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.Period;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/proxy")
@RequiredArgsConstructor
@Slf4j
public class ProxyController {

    @Value("${hms.api.url:https://api-hms.zenohosp.com}")
    private String hmsApiUrl;

    @Value("${inventory.api.url:https://api-inventory.zenohosp.com}")
    private String inventoryApiUrl;

    @Value("${directory.api.url:https://api-directory.zenohosp.com}")
    private String directoryApiUrl;

    @Value("${billing.api.url:https://api-hms.zenohosp.com}")
    private String billingApiUrl;

    private final RestTemplate restTemplate;
    private final JwtUtil jwtUtil;
    private final OtBookingRepository bookingRepository;
    private final com.ot.server.service.OtRoomTypeResolver otRoomTypeResolver;

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private UUID getHospitalId(Authentication auth) {
        if (auth == null) throw new RuntimeException("Authentication required");
        String token = (String) auth.getCredentials();
        if (token == null || token.isBlank()) throw new RuntimeException("No token in credentials");
        UUID id = jwtUtil.getHospitalId(token);
        if (id == null) throw new RuntimeException("Missing hospitalId in token");
        return id;
    }

    private HttpEntity<Void> authEntity(Authentication auth) {
        HttpHeaders headers = new HttpHeaders();
        if (auth != null) {
            String token = (String) auth.getCredentials();
            if (token != null && !token.isBlank()) headers.setBearerAuth(token);
        }
        return new HttpEntity<>(headers);
    }

    private Map<String, Object> normalizePatient(Map<String, Object> p) {
        Map<String, Object> m = new HashMap<>(p);
        String fn = p.getOrDefault("firstName", "").toString();
        String ln = p.getOrDefault("lastName", "").toString();
        m.put("name", (fn + " " + ln).trim());
        if (p.get("dob") != null) {
            try {
                LocalDate dob = LocalDate.parse(p.get("dob").toString());
                m.put("age", Period.between(dob, LocalDate.now()).getYears());
            } catch (Exception ignored) {}
        }
        return m;
    }

    private Map<String, Object> normalizeDoctor(Map<String, Object> d) {
        Map<String, Object> m = new HashMap<>(d);
        String fn = d.getOrDefault("firstName", "").toString();
        String ln = d.getOrDefault("lastName", "").toString();
        m.put("name", (fn + " " + ln).trim());
        return m;
    }

    /**
     * Builds a predicate that decides which HMS rooms/admissions belong to the
     * OT category for the current hospital.
     *
     * Primary path: ask HMS for this hospital's RoomTypeConfig entries and
     * match Room.roomType against the codes whose category="OT". This is the
     * canonical source — handles custom codes like "OT_MINOR" out of the box.
     *
     * Fallback path (used when the configs endpoint is unreachable or returns
     * no OT-category entries): heuristic substring match on "ot"/"operat"/"theat",
     * excluding any "post*" prefix so POST_OT recovery rooms aren't pulled in.
     */
    private java.util.function.Predicate<Map<String, Object>> buildOtRoomTypePredicate(
            UUID hospitalId, Authentication auth) {
        String token = auth != null ? (String) auth.getCredentials() : null;
        Set<String> codes = otRoomTypeResolver.getOtCodes(hospitalId, token);
        return roomOrAdmission -> {
            Object t = roomOrAdmission.get("roomType");
            if (t == null) return false;
            String type = t.toString();
            if (!codes.isEmpty()) return codes.contains(type);
            String lower = type.toLowerCase();
            if (lower.startsWith("post")) return false;
            return lower.equals("ot") || lower.contains("operat") || lower.contains("theat");
        };
    }

    // ─── HMS: Rooms ───────────────────────────────────────────────────────────

    @GetMapping("/hms/rooms")
    public ResponseEntity<?> getHmsRooms(Authentication auth) {
        UUID hospitalId = getHospitalId(auth);
        try {
            String url = UriComponentsBuilder.fromUriString(hmsApiUrl)
                    .path("/api/rooms")
                    .queryParam("hospitalId", hospitalId)
                    .toUriString();

            ResponseEntity<List<Map<String, Object>>> response = restTemplate.exchange(
                    url, HttpMethod.GET, authEntity(auth), new ParameterizedTypeReference<>() {});

            java.util.function.Predicate<Map<String, Object>> isOt = buildOtRoomTypePredicate(hospitalId, auth);
            List<Map<String, Object>> otRooms = response.getBody() == null ? List.of()
                    : response.getBody().stream()
                            .filter(isOt)
                            .collect(Collectors.toList());

            return ResponseEntity.ok(otRooms);
        } catch (HttpClientErrorException.Forbidden e) {
            log.error("HMS denied room access: {}", e.getMessage());
            return ResponseEntity.status(403).body(Map.of("error", "Access denied by HMS"));
        } catch (Exception e) {
            log.error("Error fetching HMS rooms: {}", e.getMessage());
            return ResponseEntity.status(502).body(Map.of("error", "Could not fetch rooms from HMS"));
        }
    }

    // ─── HMS: Available Rooms ─────────────────────────────────────────────────

    @GetMapping("/hms/rooms/available")
    public ResponseEntity<?> getAvailableRooms(
            @RequestParam(required = false) String start,
            @RequestParam(required = false) String end,
            @RequestParam(required = false) UUID excludeBookingId,
            Authentication auth) {
        UUID hospitalId = getHospitalId(auth);
        try {
            // 1. Fetch all OT rooms from HMS
            String url = UriComponentsBuilder.fromUriString(hmsApiUrl)
                    .path("/api/rooms")
                    .queryParam("hospitalId", hospitalId)
                    .toUriString();

            ResponseEntity<List<Map<String, Object>>> response = restTemplate.exchange(
                    url, HttpMethod.GET, authEntity(auth), new ParameterizedTypeReference<>() {});

            java.util.function.Predicate<Map<String, Object>> isOt = buildOtRoomTypePredicate(hospitalId, auth);
            List<Map<String, Object>> otRooms = response.getBody() == null ? List.of()
                    : response.getBody().stream()
                            .filter(isOt)
                            .collect(Collectors.toList());

            // 2. Build blocked-room map from our DB
            // IN_PROGRESS and PENDING_SANITATION are always blocked (until sanitation completes)
            List<OtBooking> alwaysBlocked = bookingRepository.findByHospitalIdAndStatusIn(
                    hospitalId, List.of(OtBookingStatus.IN_PROGRESS, OtBookingStatus.PENDING_SANITATION));

            Map<Long, OtBooking> blockedRoomMap = new HashMap<>();
            for (OtBooking b : alwaysBlocked) {
                if (b.getRoomId() != null) blockedRoomMap.put(b.getRoomId(), b);
            }

            // Time-overlap blocked rooms (CONFIRMED / REQUESTED bookings)
            if (start != null && end != null) {
                String s = start.length() == 16 ? start + ":00" : start;
                String e = end.length() == 16 ? end + ":00" : end;
                LocalDateTime startDt = LocalDateTime.parse(s);
                LocalDateTime endWithBuffer = LocalDateTime.parse(e).plusMinutes(30);

                List<OtBooking> timeBlocked = bookingRepository
                        .findByHospitalIdAndStatusInAndScheduledStartLessThanAndScheduledEndGreaterThan(
                                hospitalId,
                                List.of(OtBookingStatus.CONFIRMED, OtBookingStatus.REQUESTED),
                                endWithBuffer, startDt);

                for (OtBooking b : timeBlocked) {
                    if (b.getRoomId() != null
                            && (excludeBookingId == null || !b.getId().equals(excludeBookingId))) {
                        blockedRoomMap.putIfAbsent(b.getRoomId(), b);
                    }
                }
            }

            // 3. Annotate rooms with availability
            List<Map<String, Object>> annotated = otRooms.stream().map(room -> {
                Map<String, Object> out = new HashMap<>(room);
                Object rawId = room.get("id");
                Long roomId = rawId != null ? Long.parseLong(rawId.toString()) : null;

                OtBooking blocking = roomId != null ? blockedRoomMap.get(roomId) : null;
                boolean hmsOccupied = "OCCUPIED".equalsIgnoreCase(
                        room.getOrDefault("status", "").toString());

                if (blocking != null) {
                    // Our OT booking system has this room blocked
                    out.put("available", false);
                    out.put("occupiedBy", blocking.getProcedureName());
                    out.put("occupiedStatus", blocking.getStatus().name());
                    out.put("surgeonName", blocking.getSurgeonName());
                    if (blocking.getStatus() == OtBookingStatus.IN_PROGRESS
                            && blocking.getScheduledEnd() != null) {
                        out.put("freeAt", blocking.getScheduledEnd().plusMinutes(30).toString());
                    } else if (blocking.getStatus() == OtBookingStatus.PENDING_SANITATION) {
                        out.put("freeAt", "After sanitation");
                    } else if (blocking.getScheduledEnd() != null) {
                        out.put("freeAt", blocking.getScheduledEnd().plusMinutes(30).toString());
                    }
                } else if (hmsOccupied) {
                    // HMS itself reports this room as occupied (patient admitted, not via our booking)
                    out.put("available", false);
                    out.put("occupiedBy", "Room currently in use");
                    out.put("occupiedStatus", "HMS_OCCUPIED");
                } else {
                    out.put("available", true);
                }
                return out;
            }).collect(Collectors.toList());

            return ResponseEntity.ok(annotated);
        } catch (HttpClientErrorException.Forbidden e) {
            log.error("HMS denied room access: {}", e.getMessage());
            return ResponseEntity.status(403).body(Map.of("error", "Access denied by HMS"));
        } catch (Exception e) {
            log.error("Error fetching available rooms: {}", e.getMessage());
            return ResponseEntity.status(502).body(Map.of("error", "Could not fetch available rooms from HMS"));
        }
    }

    // ─── HMS: Patients ────────────────────────────────────────────────────────

    /**
     * HMS patient search uses `q` param on /api/patients/search.
     * Listing all patients uses /api/patients?hospitalId=...
     * Response is normalized to include computed `name` and `age` fields.
     */
    @GetMapping("/hms/patients")
    public ResponseEntity<?> getHmsPatients(
            @RequestParam(required = false) String search,
            Authentication auth) {
        UUID hospitalId = getHospitalId(auth);
        try {
            UriComponentsBuilder builder = UriComponentsBuilder.fromUriString(hmsApiUrl)
                    .queryParam("hospitalId", hospitalId);

            if (search != null && !search.isBlank()) {
                // HMS search endpoint accepts ?q=<term>
                builder.path("/api/patients/search").queryParam("q", search);
            } else {
                builder.path("/api/patients");
            }

            ResponseEntity<List<Map<String, Object>>> response = restTemplate.exchange(
                    builder.toUriString(), HttpMethod.GET, authEntity(auth),
                    new ParameterizedTypeReference<>() {});

            List<Map<String, Object>> patients = response.getBody() == null ? List.of()
                    : response.getBody().stream()
                            .map(this::normalizePatient)
                            .collect(Collectors.toList());

            return ResponseEntity.ok(patients);
        } catch (HttpClientErrorException e) {
            log.error("HMS patient fetch error {}: {}", e.getStatusCode(), e.getResponseBodyAsString());
            return ResponseEntity.status(e.getStatusCode()).body(Map.of("error", "HMS error fetching patients"));
        } catch (Exception e) {
            log.error("Error fetching HMS patients: {}", e.getMessage());
            return ResponseEntity.status(502).body(Map.of("error", "Could not fetch patients from HMS"));
        }
    }

    // ─── HMS: Doctors ─────────────────────────────────────────────────────────

    /**
     * HMS doctor endpoints:
     *   GET /api/doctors?hospitalId=...             → list all
     *   GET /api/doctors/search?hospitalId=...&specialization=... → filter by specialization
     *
     * HMS has NO name-based search endpoint.
     * Name filtering is applied in-proxy after fetching from HMS.
     */
    @GetMapping("/hms/doctors")
    public ResponseEntity<?> getHmsDoctors(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String specialization,
            Authentication auth) {
        UUID hospitalId = getHospitalId(auth);
        try {
            UriComponentsBuilder builder = UriComponentsBuilder.fromUriString(hmsApiUrl)
                    .queryParam("hospitalId", hospitalId);

            if (specialization != null && !specialization.isBlank()) {
                builder.path("/api/doctors/search").queryParam("specialization", specialization);
            } else {
                builder.path("/api/doctors");
            }

            ResponseEntity<List<Map<String, Object>>> response = restTemplate.exchange(
                    builder.toUriString(), HttpMethod.GET, authEntity(auth),
                    new ParameterizedTypeReference<>() {});

            List<Map<String, Object>> doctors = response.getBody() == null
                    ? new ArrayList<>() : new ArrayList<>(response.getBody());

            // Filter by name in-proxy (HMS provides no name-search endpoint)
            if (search != null && !search.isBlank()) {
                String q = search.toLowerCase();
                doctors = doctors.stream()
                        .filter(d -> {
                            String fn = d.getOrDefault("firstName", "").toString().toLowerCase();
                            String ln = d.getOrDefault("lastName", "").toString().toLowerCase();
                            String em = d.getOrDefault("email", "").toString().toLowerCase();
                            return fn.contains(q) || ln.contains(q)
                                    || (fn + " " + ln).contains(q) || em.contains(q);
                        })
                        .collect(Collectors.toList());
            }

            doctors = doctors.stream()
                    .map(this::normalizeDoctor)
                    .collect(Collectors.toList());

            return ResponseEntity.ok(doctors);
        } catch (HttpClientErrorException e) {
            log.error("HMS doctor fetch error {}: {}", e.getStatusCode(), e.getResponseBodyAsString());
            return ResponseEntity.status(e.getStatusCode()).body(Map.of("error", "HMS error fetching doctors"));
        } catch (Exception e) {
            log.error("Error fetching HMS doctors: {}", e.getMessage());
            return ResponseEntity.status(502).body(Map.of("error", "Could not fetch doctors from HMS"));
        }
    }

    // ─── HMS: Admissions ──────────────────────────────────────────────────────

    /**
     * All active admissions for the hospital — used in Cases page to show
     * every currently admitted patient who can be booked for OT.
     */
    @GetMapping("/hms/admissions")
    public ResponseEntity<?> getActiveAdmissions(Authentication auth) {
        UUID hospitalId = getHospitalId(auth);
        try {
            String url = UriComponentsBuilder.fromUriString(hmsApiUrl)
                    .path("/api/admissions")
                    .queryParam("hospitalId", hospitalId)
                    .queryParam("all", false)
                    .toUriString();

            ResponseEntity<Object> response = restTemplate.exchange(
                    url, HttpMethod.GET, authEntity(auth), Object.class);
            return ResponseEntity.ok(response.getBody());
        } catch (HttpClientErrorException.Forbidden e) {
            log.error("HMS denied admissions access: {}", e.getMessage());
            return ResponseEntity.status(403).body(Map.of("error", "Access denied by HMS"));
        } catch (Exception e) {
            log.error("Error fetching active admissions: {}", e.getMessage());
            return ResponseEntity.status(502).body(Map.of("error", "Could not fetch admissions from HMS"));
        }
    }

    /**
     * Active admissions already assigned to OT rooms — used for the OT board.
     */
    @GetMapping("/hms/ot-admissions")
    public ResponseEntity<?> getOtAdmissions(Authentication auth) {
        UUID hospitalId = getHospitalId(auth);
        try {
            String url = UriComponentsBuilder.fromUriString(hmsApiUrl)
                    .path("/api/admissions")
                    .queryParam("hospitalId", hospitalId)
                    .queryParam("all", false)
                    .toUriString();

            ResponseEntity<List<Map<String, Object>>> response = restTemplate.exchange(
                    url, HttpMethod.GET, authEntity(auth), new ParameterizedTypeReference<>() {});

            java.util.function.Predicate<Map<String, Object>> isOt = buildOtRoomTypePredicate(hospitalId, auth);
            List<Map<String, Object>> otAdmissions = response.getBody() == null ? List.of()
                    : response.getBody().stream()
                            .filter(isOt)
                            .collect(Collectors.toList());

            return ResponseEntity.ok(otAdmissions);
        } catch (HttpClientErrorException.Forbidden e) {
            log.error("HMS denied OT admissions access: {}", e.getMessage());
            return ResponseEntity.status(403).body(Map.of("error", "Access denied by HMS"));
        } catch (Exception e) {
            log.error("Error fetching OT admissions: {}", e.getMessage());
            return ResponseEntity.status(502).body(Map.of("error", "Could not fetch OT admissions from HMS"));
        }
    }

    /**
     * Move an admitted patient to an OT room via HMS.
     * Body: { roomId: Long, doctorId: UUID }
     */
    @PatchMapping("/hms/admissions/{id}/move-to-ot")
    public ResponseEntity<?> movePatientToOT(
            @PathVariable UUID id,
            @RequestBody Map<String, Object> body,
            Authentication auth) {
        if (auth == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthenticated"));
        try {
            String url = String.format("%s/api/admissions/%s/move-to-ot", hmsApiUrl, id);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, authEntity(auth).getHeaders());
            return restTemplate.exchange(url, HttpMethod.PATCH, entity, Object.class);
        } catch (HttpClientErrorException e) {
            log.error("HMS move-to-ot error {}: {}", e.getStatusCode(), e.getResponseBodyAsString());
            return ResponseEntity.status(e.getStatusCode()).body(Map.of("error", e.getResponseBodyAsString()));
        } catch (Exception e) {
            log.error("Error moving patient to OT: {}", e.getMessage());
            return ResponseEntity.status(502).body(Map.of("error", "Could not move patient to OT"));
        }
    }

    // ─── HMS: Invoices ────────────────────────────────────────────────────────

    @GetMapping("/hms/invoices")
    public ResponseEntity<?> getHospitalInvoices(Authentication auth) {
        UUID hospitalId = getHospitalId(auth);
        try {
            String url = String.format("%s/api/invoices/hospital/%s", billingApiUrl, hospitalId);
            ResponseEntity<Object> response = restTemplate.exchange(
                    url, HttpMethod.GET, authEntity(auth), Object.class);
            return response;
        } catch (Exception e) {
            log.error("Error fetching hospital invoices: {}", e.getMessage());
            return ResponseEntity.status(502).body(Map.of("error", "Could not fetch invoices"));
        }
    }

    // ─── Directory: Surgeons ──────────────────────────────────────────────────

    @GetMapping("/directory/surgeons")
    public ResponseEntity<?> getDirectorySurgeons(
            @RequestParam(required = false) String search,
            Authentication auth) {
        UUID hospitalId = getHospitalId(auth);
        try {
            UriComponentsBuilder builder = UriComponentsBuilder.fromUriString(directoryApiUrl)
                    .path("/api/users")
                    .queryParam("hospitalId", hospitalId)
                    .queryParam("role", "surgeon");

            if (search != null && !search.isBlank()) {
                builder.queryParam("search", search);
            }

            ResponseEntity<Object> response = restTemplate.exchange(
                    builder.toUriString(), HttpMethod.GET, authEntity(auth), Object.class);
            return response;
        } catch (Exception e) {
            log.error("Error fetching surgeons: {}", e.getMessage());
            return ResponseEntity.status(502).body(Map.of("error", "Could not fetch surgeons"));
        }
    }

    // ─── Inventory: Kits ─────────────────────────────────────────────────────

    @GetMapping("/inventory/kits")
    public ResponseEntity<?> getInventoryKits(Authentication auth) {
        if (auth == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthenticated"));
        try {
            String url = inventoryApiUrl + "/api/inventory/kits";
            log.info("[PROXY] GET {}", url);
            ResponseEntity<Object> response = restTemplate.exchange(
                    url, HttpMethod.GET, authEntity(auth), Object.class);
            return ResponseEntity.ok(response.getBody());
        } catch (HttpClientErrorException e) {
            log.error("[PROXY] Inventory error {}: {}", e.getStatusCode(), e.getResponseBodyAsString());
            return ResponseEntity.status(e.getStatusCode()).body(Map.of("error", e.getResponseBodyAsString()));
        } catch (org.springframework.web.client.ResourceAccessException e) {
            log.error("[PROXY] Inventory unreachable: {}", e.getMessage());
            return ResponseEntity.status(502).body(Map.of("error", "Inventory service unavailable"));
        } catch (Exception e) {
            log.error("[PROXY] Inventory unexpected error: {}", e.getMessage(), e);
            return ResponseEntity.status(502).body(Map.of("error", "Proxy error: " + e.getMessage()));
        }
    }

    @PostMapping("/inventory/kits")
    public ResponseEntity<?> createInventoryKit(@RequestBody Object kitData, Authentication auth) {
        if (auth == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthenticated"));
        try {
            String url = inventoryApiUrl + "/api/inventory/kits";
            HttpEntity<Object> entity = new HttpEntity<>(kitData, authEntity(auth).getHeaders());
            return restTemplate.exchange(url, HttpMethod.POST, entity, Object.class);
        } catch (HttpClientErrorException e) {
            return ResponseEntity.status(e.getStatusCode()).body(e.getResponseBodyAsString());
        } catch (Exception e) {
            log.error("[PROXY] Create kit error: {}", e.getMessage());
            return ResponseEntity.status(502).body(Map.of("error", "Failed to create kit"));
        }
    }

    @PutMapping("/inventory/kits/{id}")
    public ResponseEntity<?> updateInventoryKit(
            @PathVariable UUID id, @RequestBody Object kitData, Authentication auth) {
        if (auth == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthenticated"));
        try {
            String url = inventoryApiUrl + "/api/inventory/kits/" + id;
            HttpEntity<Object> entity = new HttpEntity<>(kitData, authEntity(auth).getHeaders());
            return restTemplate.exchange(url, HttpMethod.PUT, entity, Object.class);
        } catch (HttpClientErrorException e) {
            return ResponseEntity.status(e.getStatusCode()).body(e.getResponseBodyAsString());
        } catch (Exception e) {
            log.error("[PROXY] Update kit error: {}", e.getMessage());
            return ResponseEntity.status(502).body(Map.of("error", "Failed to update kit"));
        }
    }

    @DeleteMapping("/inventory/kits/{id}")
    public ResponseEntity<?> deleteInventoryKit(@PathVariable UUID id, Authentication auth) {
        if (auth == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthenticated"));
        try {
            String url = inventoryApiUrl + "/api/inventory/kits/" + id;
            return restTemplate.exchange(url, HttpMethod.DELETE, authEntity(auth), Object.class);
        } catch (HttpClientErrorException e) {
            return ResponseEntity.status(e.getStatusCode()).body(e.getResponseBodyAsString());
        } catch (Exception e) {
            log.error("[PROXY] Delete kit error: {}", e.getMessage());
            return ResponseEntity.status(502).body(Map.of("error", "Failed to delete kit"));
        }
    }

    @PostMapping("/inventory/kits/{id}/consume")
    public ResponseEntity<?> consumeInventoryKit(
            @PathVariable UUID id,
            @RequestBody(required = false) Object consumeData,
            Authentication auth) {
        if (auth == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthenticated"));
        try {
            String url = inventoryApiUrl + "/api/inventory/kits/" + id + "/consume";
            HttpEntity<Object> entity = new HttpEntity<>(consumeData, authEntity(auth).getHeaders());
            return restTemplate.exchange(url, HttpMethod.POST, entity, Object.class);
        } catch (HttpClientErrorException e) {
            return ResponseEntity.status(e.getStatusCode()).body(e.getResponseBodyAsString());
        } catch (Exception e) {
            log.error("[PROXY] Consume kit error: {}", e.getMessage());
            return ResponseEntity.status(502).body(Map.of("error", "Failed to consume kit"));
        }
    }

    @GetMapping("/inventory/kits/consumptions")
    public ResponseEntity<?> getInventoryKitConsumptions(Authentication auth) {
        if (auth == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthenticated"));
        try {
            String url = inventoryApiUrl + "/api/inventory/kits/consumptions";
            return restTemplate.exchange(url, HttpMethod.GET, authEntity(auth), Object.class);
        } catch (HttpClientErrorException e) {
            return ResponseEntity.status(e.getStatusCode()).body(e.getResponseBodyAsString());
        } catch (Exception e) {
            log.error("[PROXY] Get consumptions error: {}", e.getMessage());
            return ResponseEntity.status(502).body(Map.of("error", "Failed to fetch consumptions"));
        }
    }

    // ─── HMS: Hospital Services (procedures) ─────────────────────────────────

    @GetMapping("/hms/hospital-services")
    public ResponseEntity<?> getHospitalServices(Authentication auth) {
        UUID hospitalId = getHospitalId(auth);
        try {
            String url = UriComponentsBuilder.fromUriString(hmsApiUrl)
                    .path("/api/hospital-services")
                    .queryParam("hospitalId", hospitalId)
                    .toUriString();
            ResponseEntity<Object> response = restTemplate.exchange(url, HttpMethod.GET, authEntity(auth), Object.class);
            return ResponseEntity.ok(response.getBody());
        } catch (HttpClientErrorException e) {
            log.error("HMS hospital-services error {}: {}", e.getStatusCode(), e.getResponseBodyAsString());
            return ResponseEntity.status(e.getStatusCode()).body(Map.of("error", "HMS error fetching services"));
        } catch (Exception e) {
            log.error("Error fetching hospital services: {}", e.getMessage());
            return ResponseEntity.status(502).body(Map.of("error", "Could not fetch hospital services"));
        }
    }

    // ─── HMS: Create Patient (emergency) ─────────────────────────────────────

    @PostMapping("/hms/patients")
    public ResponseEntity<?> createHmsPatient(@RequestBody Map<String, Object> body, Authentication auth) {
        if (auth == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthenticated"));
        try {
            String url = hmsApiUrl + "/api/patients";
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, authEntity(auth).getHeaders());
            ResponseEntity<Object> response = restTemplate.exchange(url, HttpMethod.POST, entity, Object.class);
            return ResponseEntity.ok(response.getBody());
        } catch (HttpClientErrorException e) {
            log.error("HMS create patient error {}: {}", e.getStatusCode(), e.getResponseBodyAsString());
            return ResponseEntity.status(e.getStatusCode()).body(Map.of("error", e.getResponseBodyAsString()));
        } catch (Exception e) {
            log.error("Error creating HMS patient: {}", e.getMessage());
            return ResponseEntity.status(502).body(Map.of("error", "Could not create patient in HMS"));
        }
    }

    // ─── HMS: Create Admission (emergency IPD) ────────────────────────────────

    @PostMapping("/hms/admissions")
    public ResponseEntity<?> createHmsAdmission(@RequestBody Map<String, Object> body, Authentication auth) {
        if (auth == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthenticated"));
        try {
            String url = hmsApiUrl + "/api/admissions";
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, authEntity(auth).getHeaders());
            ResponseEntity<Object> response = restTemplate.exchange(url, HttpMethod.POST, entity, Object.class);
            return ResponseEntity.ok(response.getBody());
        } catch (HttpClientErrorException e) {
            log.error("HMS create admission error {}: {}", e.getStatusCode(), e.getResponseBodyAsString());
            return ResponseEntity.status(e.getStatusCode()).body(Map.of("error", e.getResponseBodyAsString()));
        } catch (Exception e) {
            log.error("Error creating HMS admission: {}", e.getMessage());
            return ResponseEntity.status(502).body(Map.of("error", "Could not create admission in HMS"));
        }
    }

    // ─── HMS: Admission by Patient ─────────────────────────────────────────────

    @GetMapping("/hms/admissions/patient/{patientId}")
    public ResponseEntity<?> getAdmissionsByPatient(@PathVariable Integer patientId, Authentication auth) {
        if (auth == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthenticated"));
        try {
            String url = hmsApiUrl + "/api/admissions/patient/" + patientId;
            ResponseEntity<Object> response = restTemplate.exchange(url, HttpMethod.GET, authEntity(auth), Object.class);
            return ResponseEntity.ok(response.getBody());
        } catch (HttpClientErrorException e) {
            return ResponseEntity.status(e.getStatusCode()).body(Map.of("error", e.getResponseBodyAsString()));
        } catch (Exception e) {
            log.error("Error fetching patient admissions: {}", e.getMessage());
            return ResponseEntity.status(502).body(Map.of("error", "Could not fetch patient admissions"));
        }
    }

    // ─── HMS: Return from OT ──────────────────────────────────────────────────

    @PatchMapping("/hms/admissions/{id}/return-from-ot")
    public ResponseEntity<?> returnPatientFromOT(
            @PathVariable UUID id,
            @RequestBody(required = false) Map<String, Object> body,
            Authentication auth) {
        if (auth == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthenticated"));
        try {
            String url = String.format("%s/api/admissions/%s/return-from-ot", hmsApiUrl, id);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body != null ? body : Map.of(), authEntity(auth).getHeaders());
            return restTemplate.exchange(url, HttpMethod.PATCH, entity, Object.class);
        } catch (HttpClientErrorException e) {
            log.error("HMS return-from-ot error {}: {}", e.getStatusCode(), e.getResponseBodyAsString());
            return ResponseEntity.status(e.getStatusCode()).body(Map.of("error", e.getResponseBodyAsString()));
        } catch (Exception e) {
            log.error("Error returning patient from OT: {}", e.getMessage());
            return ResponseEntity.status(502).body(Map.of("error", "Could not return patient from OT"));
        }
    }

    // ─── HMS: Post-OT Rooms ───────────────────────────────────────────────────

    @GetMapping("/hms/rooms/post-ot")
    public ResponseEntity<?> getPostOtRooms(Authentication auth) {
        UUID hospitalId = getHospitalId(auth);
        try {
            String url = UriComponentsBuilder.fromUriString(hmsApiUrl)
                    .path("/api/rooms")
                    .queryParam("hospitalId", hospitalId)
                    .toUriString();
            ResponseEntity<List<Map<String, Object>>> response = restTemplate.exchange(
                    url, HttpMethod.GET, authEntity(auth), new ParameterizedTypeReference<>() {});
            List<Map<String, Object>> postOtRooms = response.getBody() == null ? List.of()
                    : response.getBody().stream()
                            .filter(r -> "POST_OT".equals(r.get("roomType")) && "AVAILABLE".equalsIgnoreCase(r.getOrDefault("status", "").toString()))
                            .collect(Collectors.toList());
            return ResponseEntity.ok(postOtRooms);
        } catch (Exception e) {
            log.error("Error fetching post-OT rooms: {}", e.getMessage());
            return ResponseEntity.status(502).body(Map.of("error", "Could not fetch post-OT rooms"));
        }
    }
}
