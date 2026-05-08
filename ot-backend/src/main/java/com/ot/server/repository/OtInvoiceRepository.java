package com.ot.server.repository;

import com.ot.server.entity.OtInvoice;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OtInvoiceRepository extends JpaRepository<OtInvoice, UUID> {
    List<OtInvoice> findByHospitalId(UUID hospitalId);
    List<OtInvoice> findByHospitalIdAndPatientId(UUID hospitalId, Long patientId);
    List<OtInvoice> findByHospitalIdAndAdmissionId(UUID hospitalId, UUID admissionId);
    Optional<OtInvoice> findByBookingId(UUID bookingId);
}
