package com.ot.server.controller;

import com.ot.server.dto.CreateBookingRequest;
import com.ot.server.dto.UpdateBookingRequest;
import com.ot.server.entity.OtBooking;
import com.ot.server.entity.OtBookingStatus;
import com.ot.server.repository.OtConsumptionItemRepository;
import com.ot.server.repository.OtBookingRepository;
import com.ot.server.security.JwtUtil;
import com.ot.server.service.OtBillingIntegrationService;
import com.ot.server.service.OtBookingService;
import com.ot.server.service.OtHmsIntegrationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/ot/bookings")
@RequiredArgsConstructor
@Slf4j
public class OtBookingController {
    private final OtBookingService bookingService;
    private final OtBookingRepository bookingRepository;
    private final OtConsumptionItemRepository consumptionRepository;
    private final OtBillingIntegrationService billingIntegrationService;
    private final OtHmsIntegrationService hmsIntegrationService;
    private final JwtUtil jwtUtil;

    private UUID getHospitalId(Authentication auth) {
        String token = (String) auth.getCredentials();
        UUID hospitalId = jwtUtil.getHospitalId(token);
        if (hospitalId == null) {
            throw new RuntimeException("Missing hospitalId in token");
        }
        return hospitalId;
    }

    @PostMapping
    public ResponseEntity<?> createBooking(@Valid @RequestBody CreateBookingRequest request, Authentication auth) {
        UUID hospitalId = getHospitalId(auth);

        if (bookingService.checkConflict(hospitalId, request.roomId(), request.surgeonId(),
                request.scheduledStart(), request.scheduledEnd(), request.bufferMinutes(), null)) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "Conflict detected", "message", "Room or surgeon has overlapping booking"));
        }

        OtBooking booking = OtBooking.builder()
                .patientId(request.patientId())
                .patientName(request.patientName())
                .patientMrn(request.patientMrn())
                .hmsPatientId(request.patientId() != null ? request.patientId().intValue() : null)
                .admissionId(request.admissionId())
                .procedureName(request.procedureName())
                .procedureCharge(request.procedureCharge())
                .hmsServiceId(request.hmsServiceId())
                .roomId(request.roomId())
                .roomName(request.roomName())
                .surgeonId(request.surgeonId())
                .surgeonName(request.surgeonName())
                .scheduledStart(request.scheduledStart())
                .scheduledEnd(request.scheduledEnd())
                .notes(request.notes())
                .bufferMinutes(request.bufferMinutes() != null ? request.bufferMinutes() : 30)
                .build();

        OtBooking created = bookingService.createBooking(booking, hospitalId);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateBooking(@PathVariable UUID id, @Valid @RequestBody UpdateBookingRequest request, Authentication auth) {
        UUID hospitalId = getHospitalId(auth);

        OtBooking existing = bookingService.getBooking(id, hospitalId);

        if (bookingService.checkConflict(hospitalId, request.roomId(), request.surgeonId(),
                request.scheduledStart(), request.scheduledEnd(), request.bufferMinutes(), id)) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "Conflict detected", "message", "Room or surgeon has overlapping booking"));
        }

        OtBooking updates = OtBooking.builder()
                .patientId(request.patientId())
                .patientName(request.patientName())
                .patientMrn(request.patientMrn())
                .procedureName(request.procedureName())
                .procedureCharge(request.procedureCharge())
                .roomId(request.roomId())
                .roomName(request.roomName())
                .surgeonId(request.surgeonId())
                .surgeonName(request.surgeonName())
                .scheduledStart(request.scheduledStart())
                .scheduledEnd(request.scheduledEnd())
                .notes(request.notes())
                .bufferMinutes(request.bufferMinutes())
                .build();

        OtBooking updated = bookingService.updateBooking(id, updates, hospitalId);
        return ResponseEntity.ok(updated);
    }

    @GetMapping
    public ResponseEntity<List<OtBooking>> listBookings(
            @RequestParam(required = false) String date,
            @RequestParam(required = false) OtBookingStatus status,
            @RequestParam(required = false) Long roomId,
            Authentication auth) {
        UUID hospitalId = getHospitalId(auth);

        List<OtBooking> bookings = bookingService.listBookings(hospitalId);

        if (date != null && !date.isEmpty()) {
            LocalDate filterDate = LocalDate.parse(date);
            LocalDateTime startOfDay = filterDate.atStartOfDay();
            LocalDateTime endOfDay = filterDate.atTime(LocalTime.MAX);
            bookings = bookingRepository.findByHospitalIdAndScheduledStartGreaterThanEqualAndScheduledStartLessThan(
                    hospitalId, startOfDay, endOfDay);
        }

        if (status != null) {
            bookings = bookings.stream()
                    .filter(b -> b.getStatus().equals(status))
                    .toList();
        }

        if (roomId != null) {
            bookings = bookings.stream()
                    .filter(b -> b.getRoomId().equals(roomId))
                    .toList();
        }

        return ResponseEntity.ok(bookings);
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getBooking(@PathVariable UUID id, Authentication auth) {
        UUID hospitalId = getHospitalId(auth);
        try {
            OtBooking booking = bookingService.getBooking(id, hospitalId);
            return ResponseEntity.ok(booking);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "Not found", "message", e.getMessage()));
        }
    }

    @PatchMapping("/{id}/confirm")
    public ResponseEntity<?> confirmBooking(@PathVariable UUID id, Authentication auth) {
        UUID hospitalId = getHospitalId(auth);
        try {
            OtBooking booking = bookingService.confirmBooking(id, hospitalId);
            return ResponseEntity.ok(booking);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "Bad request", "message", e.getMessage()));
        }
    }

    @PatchMapping("/{id}/start")
    public ResponseEntity<?> startBooking(@PathVariable UUID id, Authentication auth) {
        UUID hospitalId = getHospitalId(auth);
        try {
            OtBooking booking = bookingService.startBooking(id, hospitalId);
            String token = (String) auth.getCredentials();

            // Move patient to OT in HMS — use admissionId stored at booking creation if available,
            // otherwise fall back to HMS lookup by patient ID / MRN
            UUID admissionId = booking.getAdmissionId();
            if (admissionId == null) {
                Map<String, Object> admission = hmsIntegrationService.findActiveAdmission(booking, hospitalId, token);
                if (admission != null) {
                    admissionId = UUID.fromString(admission.get("id").toString());
                    bookingService.saveAdmissionId(booking.getId(), admissionId, hospitalId);
                }
            }
            if (admissionId != null) {
                hmsIntegrationService.moveToOT(admissionId, booking.getRoomId(), booking.getSurgeonId(), booking.getId(), token);
                booking = bookingService.getBooking(id, hospitalId);
            }

            return ResponseEntity.ok(booking);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "Bad request", "message", e.getMessage()));
        }
    }

    @PatchMapping("/{id}/end")
    public ResponseEntity<?> endBooking(
            @PathVariable UUID id,
            @RequestBody(required = false) Map<String, Object> body,
            Authentication auth) {
        UUID hospitalId = getHospitalId(auth);
        try {
            OtBooking booking = bookingService.getBooking(id, hospitalId);

            if (booking.getPatientId() == null) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(Map.of("error", "Bad request", "message", "Missing patientId"));
            }

            // Transition booking first — HMS and billing must never block clinical workflow
            OtBooking ended = bookingService.endBooking(id, hospitalId);

            String token = (String) auth.getCredentials();

            // Return patient from OT in HMS (to recovery room if specified, else to ward)
            if (ended.getAdmissionId() != null) {
                Long postOtRoomId = null;
                if (body != null && body.get("postOtRoomId") != null) {
                    postOtRoomId = Long.parseLong(body.get("postOtRoomId").toString());
                }
                hmsIntegrationService.returnFromOT(ended.getAdmissionId(), postOtRoomId, token);
            }

            // Create HMS invoice — failure is non-blocking
            try {
                billingIntegrationService.createInvoiceForBooking(
                        booking,
                        hospitalId,
                        consumptionRepository.findByBookingIdAndHospitalId(id, hospitalId),
                        token
                );
            } catch (Exception billingEx) {
                log.warn("Billing failed for booking {} — invoice must be created manually: {}",
                        id, billingEx.getMessage());
            }

            return ResponseEntity.ok(ended);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "Bad request", "message", e.getMessage()));
        }
    }

    @PatchMapping("/{id}/sanitize")
    public ResponseEntity<?> sanitizeBooking(@PathVariable UUID id, Authentication auth) {
        UUID hospitalId = getHospitalId(auth);
        try {
            OtBooking booking = bookingService.sanitizeBooking(id, hospitalId);
            return ResponseEntity.ok(booking);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "Bad request", "message", e.getMessage()));
        }
    }

    @PatchMapping("/{id}/cancel")
    public ResponseEntity<?> cancelBooking(@PathVariable UUID id, Authentication auth) {
        UUID hospitalId = getHospitalId(auth);
        try {
            OtBooking booking = bookingService.cancelBooking(id, hospitalId);
            return ResponseEntity.ok(booking);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "Bad request", "message", e.getMessage()));
        }
    }
}
