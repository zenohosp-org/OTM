package com.ot.server.repository;

import com.ot.server.entity.OtBooking;
import com.ot.server.entity.OtBookingStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import jakarta.persistence.LockModeType;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface OtBookingRepository extends JpaRepository<OtBooking, UUID> {
    List<OtBooking> findByHospitalIdAndStatusNotIn(UUID hospitalId, List<OtBookingStatus> statuses);

    List<OtBooking> findByHospitalIdAndRoomIdAndStatusNotInAndScheduledStartLessThanAndScheduledEndGreaterThan(
            UUID hospitalId, Long roomId, List<OtBookingStatus> statuses,
            LocalDateTime scheduledEnd, LocalDateTime scheduledStart);

    List<OtBooking> findByHospitalIdAndSurgeonIdAndStatusNotInAndScheduledStartLessThanAndScheduledEndGreaterThan(
            UUID hospitalId, UUID surgeonId, List<OtBookingStatus> statuses,
            LocalDateTime scheduledEnd, LocalDateTime scheduledStart);

    List<OtBooking> findByHospitalId(UUID hospitalId);

    List<OtBooking> findByHospitalIdAndStatus(UUID hospitalId, OtBookingStatus status);

    List<OtBooking> findByHospitalIdAndScheduledStartGreaterThanEqualAndScheduledStartLessThan(
            UUID hospitalId, LocalDateTime startOfDay, LocalDateTime endOfDay);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT b FROM OtBooking b WHERE b.hospitalId = :hospitalId AND b.roomId = :roomId AND b.status NOT IN :statuses AND b.scheduledStart < :end AND b.scheduledEnd > :start")
    List<OtBooking> findConflictingRoomBookingsWithLock(
            @Param("hospitalId") UUID hospitalId,
            @Param("roomId") Long roomId,
            @Param("statuses") List<OtBookingStatus> statuses,
            @Param("end") LocalDateTime end,
            @Param("start") LocalDateTime start);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT b FROM OtBooking b WHERE b.hospitalId = :hospitalId AND b.surgeonId = :surgeonId AND b.status NOT IN :statuses AND b.scheduledStart < :end AND b.scheduledEnd > :start")
    List<OtBooking> findConflictingSurgeonBookingsWithLock(
            @Param("hospitalId") UUID hospitalId,
            @Param("surgeonId") UUID surgeonId,
            @Param("statuses") List<OtBookingStatus> statuses,
            @Param("end") LocalDateTime end,
            @Param("start") LocalDateTime start);

    List<OtBooking> findByHospitalIdAndStatusIn(UUID hospitalId, List<OtBookingStatus> statuses);

    List<OtBooking> findByHospitalIdAndStatusInAndScheduledStartLessThanAndScheduledEndGreaterThan(
            UUID hospitalId, List<OtBookingStatus> statuses,
            LocalDateTime scheduledEnd, LocalDateTime scheduledStart);
}
