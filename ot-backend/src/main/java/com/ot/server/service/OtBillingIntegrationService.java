package com.ot.server.service;

import com.ot.server.entity.OtBooking;
import com.ot.server.entity.OtConsumptionItem;
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

        String url = billingApiUrl + "/api/invoices";
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(payload, headers);

        try {
            ResponseEntity<Object> response = restTemplate.exchange(url, HttpMethod.POST, entity, Object.class);
            log.info("Created HMS invoice {} for booking {}: status={}", invoiceNumber, booking.getId(), response.getStatusCode());
        } catch (Exception e) {
            log.error("Failed to create HMS invoice for booking {}: {}", booking.getId(), e.getMessage());
            throw e;
        }
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
