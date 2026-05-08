package com.ot.server.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.*;
import lombok.*;
import lombok.Builder.Default;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "ot_invoices")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OtInvoice {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Id
    @Default
    private UUID id = UUID.randomUUID();

    @Column(unique = true, nullable = false)
    private String invoiceNumber;

    @Column(nullable = false)
    private UUID hospitalId;

    @Column(nullable = false)
    private Long patientId;

    private String patientName;

    private UUID admissionId;

    private UUID bookingId;

    @Column(columnDefinition = "VARCHAR(20) DEFAULT 'UNPAID'")
    @Default
    private String status = "UNPAID";

    private BigDecimal totalAmount;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @JsonIgnore
    @Column(columnDefinition = "TEXT")
    private String itemsJson;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (id == null) id = UUID.randomUUID();
    }

    @JsonProperty("items")
    @Transient
    public List<Map<String, Object>> getItems() {
        if (itemsJson == null || itemsJson.isBlank()) return Collections.emptyList();
        try {
            return MAPPER.readValue(itemsJson, new TypeReference<>() {});
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }
}
