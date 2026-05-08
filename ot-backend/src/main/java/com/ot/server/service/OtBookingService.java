package com.ot.server.service;

import com.ot.server.entity.OtBooking;
import com.ot.server.entity.OtBookingStatus;
import com.ot.server.repository.OtBookingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class OtBookingService {
    private final OtBookingRepository bookingRepository;

    public boolean checkConflict(UUID hospitalId, Long roomId, UUID surgeonId,
                                 LocalDateTime scheduledStart, LocalDateTime scheduledEnd,
                                 Integer bufferMinutes, UUID excludeBookingId) {
        LocalDateTime bufferStart = scheduledStart;
        LocalDateTime bufferEnd = scheduledEnd.plusMinutes(bufferMinutes != null ? bufferMinutes : 30);

        List<OtBookingStatus> excludedStatuses = List.of(OtBookingStatus.CANCELLED, OtBookingStatus.COMPLETED, OtBookingStatus.PENDING_SANITATION);

        List<OtBooking> roomConflicts = bookingRepository.findByHospitalIdAndRoomIdAndStatusNotInAndScheduledStartLessThanAndScheduledEndGreaterThan(
                hospitalId, roomId, excludedStatuses, bufferEnd, bufferStart);

        if (!roomConflicts.isEmpty()) {
            if (excludeBookingId != null) {
                roomConflicts.removeIf(b -> b.getId().equals(excludeBookingId));
            }
            if (!roomConflicts.isEmpty()) {
                return true;
            }
        }

        if (surgeonId != null) {
            List<OtBooking> surgeonConflicts = bookingRepository.findByHospitalIdAndSurgeonIdAndStatusNotInAndScheduledStartLessThanAndScheduledEndGreaterThan(
                    hospitalId, surgeonId, excludedStatuses, bufferEnd, bufferStart);

            if (!surgeonConflicts.isEmpty()) {
                if (excludeBookingId != null) {
                    surgeonConflicts.removeIf(b -> b.getId().equals(excludeBookingId));
                }
                if (!surgeonConflicts.isEmpty()) {
                    return true;
                }
            }
        }

        return false;
    }

    @Transactional
    public OtBooking createBooking(OtBooking booking, UUID hospitalId) {
        booking.setHospitalId(hospitalId);
        booking.setStatus(OtBookingStatus.REQUESTED);
        if (booking.getBufferMinutes() == null) {
            booking.setBufferMinutes(30);
        }
        return bookingRepository.save(booking);
    }

    @Transactional
    public OtBooking updateBooking(UUID bookingId, OtBooking updates, UUID hospitalId) {
        OtBooking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException("Booking not found"));

        if (!booking.getHospitalId().equals(hospitalId)) {
            throw new RuntimeException("Unauthorized");
        }

        if (updates.getPatientId() != null) booking.setPatientId(updates.getPatientId());
        if (updates.getPatientName() != null) booking.setPatientName(updates.getPatientName());
        if (updates.getPatientMrn() != null) booking.setPatientMrn(updates.getPatientMrn());
        if (updates.getProcedureName() != null) booking.setProcedureName(updates.getProcedureName());
        if (updates.getProcedureCharge() != null) booking.setProcedureCharge(updates.getProcedureCharge());
        if (updates.getRoomId() != null) booking.setRoomId(updates.getRoomId());
        if (updates.getRoomName() != null) booking.setRoomName(updates.getRoomName());
        if (updates.getSurgeonId() != null) booking.setSurgeonId(updates.getSurgeonId());
        if (updates.getSurgeonName() != null) booking.setSurgeonName(updates.getSurgeonName());
        if (updates.getScheduledStart() != null) booking.setScheduledStart(updates.getScheduledStart());
        if (updates.getScheduledEnd() != null) booking.setScheduledEnd(updates.getScheduledEnd());
        if (updates.getNotes() != null) booking.setNotes(updates.getNotes());
        if (updates.getBufferMinutes() != null) booking.setBufferMinutes(updates.getBufferMinutes());

        return bookingRepository.save(booking);
    }

    public OtBooking confirmBooking(UUID bookingId, UUID hospitalId) {
        OtBooking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException("Booking not found"));

        if (!booking.getHospitalId().equals(hospitalId)) {
            throw new RuntimeException("Unauthorized");
        }

        if (!booking.getStatus().equals(OtBookingStatus.REQUESTED)) {
            throw new RuntimeException("Can only confirm REQUESTED bookings");
        }

        booking.setStatus(OtBookingStatus.CONFIRMED);
        return bookingRepository.save(booking);
    }

    public OtBooking startBooking(UUID bookingId, UUID hospitalId) {
        OtBooking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException("Booking not found"));

        if (!booking.getHospitalId().equals(hospitalId)) {
            throw new RuntimeException("Unauthorized");
        }

        if (!booking.getStatus().equals(OtBookingStatus.CONFIRMED)) {
            throw new RuntimeException("Can only start CONFIRMED bookings");
        }

        booking.setActualStart(LocalDateTime.now());
        booking.setStatus(OtBookingStatus.IN_PROGRESS);
        return bookingRepository.save(booking);
    }

    public OtBooking endBooking(UUID bookingId, UUID hospitalId) {
        OtBooking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException("Booking not found"));

        if (!booking.getHospitalId().equals(hospitalId)) {
            throw new RuntimeException("Unauthorized");
        }

        if (!booking.getStatus().equals(OtBookingStatus.IN_PROGRESS)) {
            throw new RuntimeException("Can only end IN_PROGRESS bookings");
        }

        booking.setActualEnd(LocalDateTime.now());
        booking.setStatus(OtBookingStatus.PENDING_SANITATION);
        return bookingRepository.save(booking);
    }

    public OtBooking sanitizeBooking(UUID bookingId, UUID hospitalId) {
        OtBooking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException("Booking not found"));

        if (!booking.getHospitalId().equals(hospitalId)) {
            throw new RuntimeException("Unauthorized");
        }

        if (!booking.getStatus().equals(OtBookingStatus.PENDING_SANITATION)) {
            throw new RuntimeException("Can only sanitize PENDING_SANITATION bookings");
        }

        booking.setSanitizationDone(true);
        booking.setSanitizedAt(LocalDateTime.now());
        booking.setStatus(OtBookingStatus.COMPLETED);
        return bookingRepository.save(booking);
    }

    public OtBooking cancelBooking(UUID bookingId, UUID hospitalId) {
        OtBooking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException("Booking not found"));

        if (!booking.getHospitalId().equals(hospitalId)) {
            throw new RuntimeException("Unauthorized");
        }

        if (booking.getStatus().equals(OtBookingStatus.CANCELLED) ||
            booking.getStatus().equals(OtBookingStatus.COMPLETED)) {
            throw new RuntimeException("Cannot cancel " + booking.getStatus() + " bookings");
        }

        booking.setStatus(OtBookingStatus.CANCELLED);
        return bookingRepository.save(booking);
    }

    public OtBooking getBooking(UUID bookingId, UUID hospitalId) {
        OtBooking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException("Booking not found"));

        if (!booking.getHospitalId().equals(hospitalId)) {
            throw new RuntimeException("Unauthorized");
        }

        return booking;
    }

    @Transactional
    public void saveAdmissionId(UUID bookingId, UUID admissionId, UUID hospitalId) {
        OtBooking booking = getBooking(bookingId, hospitalId);
        booking.setAdmissionId(admissionId);
        bookingRepository.save(booking);
    }

    public List<OtBooking> listBookings(UUID hospitalId) {
        return bookingRepository.findByHospitalId(hospitalId);
    }
}
