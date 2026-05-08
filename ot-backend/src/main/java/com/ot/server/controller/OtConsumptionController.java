package com.ot.server.controller;

import com.ot.server.dto.AddConsumptionItemRequest;
import com.ot.server.entity.OtConsumptionItem;
import com.ot.server.repository.OtConsumptionItemRepository;
import com.ot.server.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import lombok.extern.slf4j.Slf4j;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/ot/bookings")
@RequiredArgsConstructor
@Slf4j
public class OtConsumptionController {
    private final OtConsumptionItemRepository consumptionRepository;
    private final JwtUtil jwtUtil;
    private final RestTemplate restTemplate;

    @Value("${inventory.api.url:https://api-inventory.zenohosp.com}")
    private String inventoryApiUrl;

    private UUID getHospitalId(Authentication auth) {
        String token = (String) auth.getCredentials();
        UUID hospitalId = jwtUtil.getHospitalId(token);
        if (hospitalId == null) {
            throw new RuntimeException("Missing hospitalId in token");
        }
        return hospitalId;
    }

    @GetMapping("/{bookingId}/consumption")
    public ResponseEntity<List<OtConsumptionItem>> listConsumption(@PathVariable UUID bookingId, Authentication auth) {
        UUID hospitalId = getHospitalId(auth);
        List<OtConsumptionItem> items = consumptionRepository.findByBookingIdAndHospitalId(bookingId, hospitalId);
        return ResponseEntity.ok(items);
    }

    @PostMapping("/{bookingId}/consumption")
    public ResponseEntity<?> addConsumption(@PathVariable UUID bookingId, @RequestBody AddConsumptionItemRequest request, Authentication auth) {
        UUID hospitalId = getHospitalId(auth);

        com.ot.server.entity.OtItemType itemType = request.itemType();
        UUID inventoryItemId = request.inventoryItemId();

        // If it's a kit, try to consume it in the inventory service first
        if (itemType == com.ot.server.entity.OtItemType.KIT && inventoryItemId != null) {
            try {
                consumeInventoryKit(inventoryItemId, auth);
                log.info("Successfully consumed kit {} in inventory for booking {}", inventoryItemId, bookingId);
            } catch (Exception e) {
                log.error("Failed to consume kit {} in inventory: {}", inventoryItemId, e.getMessage());
                // We might want to decide if we should fail the whole request or just log it
                // For now, let's just log and continue, or we could return 424 Failed Dependency
            }
        }

        OtConsumptionItem item = OtConsumptionItem.builder()
                .bookingId(bookingId)
                .hospitalId(hospitalId)
                .itemName(request.itemName())
                .itemType(itemType)
                .quantity(request.quantity())
                .unitPrice(request.unitPrice())
                .inventoryItemId(inventoryItemId)
                .billable(request.billable() != null ? request.billable() : true)
                .build();

        OtConsumptionItem saved = consumptionRepository.save(item);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    private void consumeInventoryKit(UUID kitId, Authentication auth) {
        String url = String.format("%s/api/inventory/kits/%s/consume", inventoryApiUrl, kitId);
        
        String token = (String) auth.getCredentials();
        HttpHeaders headers = new HttpHeaders();
        if (token != null && !token.isBlank()) {
            headers.setBearerAuth(token);
        }
        
        HttpEntity<Void> entity = new HttpEntity<>(headers);
        restTemplate.exchange(url, HttpMethod.POST, entity, Object.class);
    }

    @DeleteMapping("/consumption/{itemId}")
    public ResponseEntity<?> deleteConsumption(@PathVariable UUID itemId, Authentication auth) {
        UUID hospitalId = getHospitalId(auth);

        OtConsumptionItem item = consumptionRepository.findById(itemId)
                .orElse(null);

        if (item == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "Not found", "message", "Item not found"));
        }

        if (!item.getHospitalId().equals(hospitalId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Forbidden", "message", "Unauthorized"));
        }

        consumptionRepository.delete(item);
        return ResponseEntity.noContent().build();
    }
}
