package com.ot.server.controller;

import com.ot.server.entity.OtInvoice;
import com.ot.server.repository.OtInvoiceRepository;
import com.ot.server.security.JwtUtil;
import com.ot.server.service.OtBillingIntegrationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/ot")
@RequiredArgsConstructor
public class OtInvoiceController {

    private final OtInvoiceRepository otInvoiceRepository;
    private final OtBillingIntegrationService otBillingIntegrationService;
    private final JwtUtil jwtUtil;

    private UUID getHospitalId(Authentication auth) {
        String token = (String) auth.getCredentials();
        return jwtUtil.getHospitalId(token);
    }

    @GetMapping("/invoices")
    public ResponseEntity<List<OtInvoice>> getInvoices(
            @RequestParam(required = false) Long patientId,
            @RequestParam(required = false) UUID admissionId,
            Authentication auth) {

        UUID hospitalId = getHospitalId(auth);

        List<OtInvoice> result;
        if (admissionId != null) {
            result = otInvoiceRepository.findByHospitalIdAndAdmissionId(hospitalId, admissionId);
        } else if (patientId != null) {
            result = otInvoiceRepository.findByHospitalIdAndPatientId(hospitalId, patientId);
        } else {
            result = otInvoiceRepository.findByHospitalId(hospitalId);
        }

        return ResponseEntity.ok(result);
    }

    @PostMapping("/invoices/backfill")
    public ResponseEntity<Map<String, Object>> backfill(Authentication auth) {
        UUID hospitalId = getHospitalId(auth);
        Map<String, Object> result = otBillingIntegrationService.backfillLocalInvoices(hospitalId);
        return ResponseEntity.ok(result);
    }
}
