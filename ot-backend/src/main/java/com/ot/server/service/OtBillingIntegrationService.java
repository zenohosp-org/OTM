package com.ot.server.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ot.server.entity.OtBooking;
import com.ot.server.entity.OtBookingStatus;
import com.ot.server.entity.OtConsumptionItem;
import com.ot.server.entity.OtInvoice;
import com.ot.server.repository.OtBookingRepository;
import com.ot.server.repository.OtConsumptionItemRepository;
import com.ot.server.repository.OtInvoiceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class OtBillingIntegrationService {

    @Value("${billing.api.url:https://api-hms.zenohosp.com}")
    private String billingApiUrl;

    private final RestTemplate restTemplate;
    private final OtHmsIntegrationService hmsIntegrationService;
    private final OtInvoiceRepository otInvoiceRepository;
    private final OtBookingRepository otBookingRepository;
    private final OtConsumptionItemRepository otConsumptionItemRepository;
    private final ObjectMapper objectMapper;

    public void createInvoiceForBooking(OtBooking booking,
                                        UUID hospitalId,
                                        List<OtConsumptionItem> consumptionItems,
                                        String bearerToken) {

        if (booking.getPatientId() == null) {
            throw new IllegalArgumentException("Missing patientId");
        }

        HttpHeaders headers = new HttpHeaders();
        if (bearerToken != null && !bearerToken.isBlank()) {
            headers.setBearerAuth(bearerToken);
        }

        Integer hmsPatientId = resolveHmsPatientId(booking, hospitalId, bearerToken);

        List<Map<String, Object>> invoiceItems = new ArrayList<>();
        BigDecimal subtotal = BigDecimal.ZERO;

        if (booking.getProcedureCharge() != null && booking.getProcedureCharge().compareTo(BigDecimal.ZERO) > 0) {
            invoiceItems.add(Map.of(
                    "itemType", "CUSTOM",
                    "description", "OT Procedure: " + (booking.getProcedureName() != null ? booking.getProcedureName() : "Procedure"),
                    "quantity", 1,
                    "unitPrice", booking.getProcedureCharge(),
                    "totalPrice", booking.getProcedureCharge()
            ));
            subtotal = subtotal.add(booking.getProcedureCharge());
        }

        if (consumptionItems != null) {
            for (OtConsumptionItem item : consumptionItems) {
                if (Boolean.FALSE.equals(item.getBillable())) continue;
                Integer qty = item.getQuantity() != null ? item.getQuantity() : 0;
                BigDecimal unitPrice = item.getUnitPrice() != null ? BigDecimal.valueOf(item.getUnitPrice()) : BigDecimal.ZERO;
                BigDecimal lineTotal = unitPrice.multiply(BigDecimal.valueOf(qty));

                Map<String, Object> invoiceItem = new HashMap<>();
                invoiceItem.put("itemType", "CUSTOM");
                invoiceItem.put("description", (item.getItemType() != null ? item.getItemType().name() : "Item") + ": " + item.getItemName());
                invoiceItem.put("quantity", qty);
                invoiceItem.put("unitPrice", unitPrice);
                invoiceItem.put("totalPrice", lineTotal);
                invoiceItems.add(invoiceItem);
                subtotal = subtotal.add(lineTotal);
            }
        }

        String invoiceNumber = "OT-" + LocalDate.now().getYear() + "-" + booking.getId().toString().substring(0, 8).toUpperCase();

        Map<String, Object> payload = new HashMap<>();
        payload.put("invoiceNumber", invoiceNumber);
        payload.put("hospitalId", hospitalId);
        payload.put("patientId", hmsPatientId);
        payload.put("subtotal", subtotal);
        payload.put("tax", BigDecimal.ZERO);
        payload.put("discount", BigDecimal.ZERO);
        payload.put("total", subtotal);
        payload.put("notes", "OT booking " + booking.getId() + (booking.getProcedureName() != null ? " — " + booking.getProcedureName() : ""));
        payload.put("items", invoiceItems);
        if (booking.getAdmissionId() != null) {
            payload.put("admissionId", booking.getAdmissionId());
        }

        if (booking.getAdmissionId() == null) {
            // Walk-in / non-admitted patient — push to HMS immediately as before
            String url = billingApiUrl + "/api/invoices";
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(payload, headers);
            try {
                ResponseEntity<Object> response = restTemplate.exchange(url, HttpMethod.POST, entity, Object.class);
                log.info("Created HMS invoice {} for booking {}: status={}", invoiceNumber, booking.getId(), response.getStatusCode());
            } catch (Exception e) {
                log.error("Failed to create HMS invoice for booking {}: {}", booking.getId(), e.getMessage());
                throw e;
            }
        } else {
            // IPD-admitted patient — OT charges will be consolidated into the discharge bill.
            // HMS reads them via GET /api/ot/invoices?admissionId= at billing time.
            log.info("Skipping HMS push for booking {} — admissionId {} present, charges held for discharge consolidation",
                    booking.getId(), booking.getAdmissionId());
        }

        // Persist local copy — failure must never affect the HMS push above
        try {
            String itemsJson = objectMapper.writeValueAsString(invoiceItems);
            OtInvoice local = OtInvoice.builder()
                    .invoiceNumber(invoiceNumber)
                    .hospitalId(hospitalId)
                    .patientId(booking.getPatientId())
                    .patientName(booking.getPatientName())
                    .admissionId(booking.getAdmissionId())
                    .bookingId(booking.getId())
                    .status("UNPAID")
                    .totalAmount(subtotal)
                    .itemsJson(itemsJson)
                    .build();
            otInvoiceRepository.save(local);
            log.info("Saved local OtInvoice {} for booking {}", invoiceNumber, booking.getId());
        } catch (Exception e) {
            log.warn("Failed to save local OtInvoice for booking {} — HMS invoice was created successfully: {}", booking.getId(), e.getMessage());
        }
    }

    public Map<String, Object> backfillLocalInvoices(UUID hospitalId) {
        List<OtBooking> completed = otBookingRepository.findByHospitalIdAndStatus(hospitalId, OtBookingStatus.COMPLETED);
        int skipped = 0, created = 0, failed = 0;

        for (OtBooking booking : completed) {
            if (otInvoiceRepository.findByBookingId(booking.getId()).isPresent()) {
                skipped++;
                continue;
            }
            try {
                List<OtConsumptionItem> items = otConsumptionItemRepository.findByBookingIdAndHospitalId(booking.getId(), hospitalId);
                List<Map<String, Object>> invoiceItems = new ArrayList<>();
                BigDecimal subtotal = BigDecimal.ZERO;

                if (booking.getProcedureCharge() != null && booking.getProcedureCharge().compareTo(BigDecimal.ZERO) > 0) {
                    invoiceItems.add(Map.of(
                            "itemType", "CUSTOM",
                            "description", "OT Procedure: " + (booking.getProcedureName() != null ? booking.getProcedureName() : "Procedure"),
                            "quantity", 1,
                            "unitPrice", booking.getProcedureCharge(),
                            "totalPrice", booking.getProcedureCharge()
                    ));
                    subtotal = subtotal.add(booking.getProcedureCharge());
                }

                for (OtConsumptionItem item : items) {
                    if (Boolean.FALSE.equals(item.getBillable())) continue;
                    Integer qty = item.getQuantity() != null ? item.getQuantity() : 0;
                    BigDecimal unitPrice = item.getUnitPrice() != null ? BigDecimal.valueOf(item.getUnitPrice()) : BigDecimal.ZERO;
                    BigDecimal lineTotal = unitPrice.multiply(BigDecimal.valueOf(qty));
                    Map<String, Object> invoiceItem = new HashMap<>();
                    invoiceItem.put("itemType", "CUSTOM");
                    invoiceItem.put("description", (item.getItemType() != null ? item.getItemType().name() : "Item") + ": " + item.getItemName());
                    invoiceItem.put("quantity", qty);
                    invoiceItem.put("unitPrice", unitPrice);
                    invoiceItem.put("totalPrice", lineTotal);
                    invoiceItems.add(invoiceItem);
                    subtotal = subtotal.add(lineTotal);
                }

                String invoiceNumber = "OT-" + (booking.getActualEnd() != null ? booking.getActualEnd().getYear() : LocalDate.now().getYear())
                        + "-" + booking.getId().toString().substring(0, 8).toUpperCase();
                String itemsJson = objectMapper.writeValueAsString(invoiceItems);

                OtInvoice local = OtInvoice.builder()
                        .invoiceNumber(invoiceNumber)
                        .hospitalId(hospitalId)
                        .patientId(booking.getPatientId())
                        .patientName(booking.getPatientName())
                        .admissionId(booking.getAdmissionId())
                        .bookingId(booking.getId())
                        .status("UNPAID")
                        .totalAmount(subtotal)
                        .itemsJson(itemsJson)
                        .build();
                otInvoiceRepository.save(local);
                created++;
                log.info("Backfilled OtInvoice {} for booking {}", invoiceNumber, booking.getId());
            } catch (Exception e) {
                failed++;
                log.warn("Backfill failed for booking {}: {}", booking.getId(), e.getMessage());
            }
        }

        return Map.of("total", completed.size(), "processed", created, "skipped", skipped, "failed", failed);
    }

    private Integer resolveHmsPatientId(OtBooking booking, UUID hospitalId, String bearerToken) {
        if (booking.getHmsPatientId() != null) {
            return booking.getHmsPatientId();
        }
        Integer resolved = hmsIntegrationService.resolveHmsPatientId(booking.getPatientMrn(), hospitalId, bearerToken);
        if (resolved == null) {
            throw new IllegalStateException("Cannot resolve HMS patientId for booking " + booking.getId()
                    + " — MRN lookup returned no result. Invoice must be created manually.");
        }
        return resolved;
    }
}
