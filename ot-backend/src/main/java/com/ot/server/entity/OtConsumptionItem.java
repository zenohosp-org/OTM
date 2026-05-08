package com.ot.server.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.Builder.Default;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "ot_consumption_items")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OtConsumptionItem {
    @Id
    @Default
    private UUID id = UUID.randomUUID();

    @Column(nullable = false)
    private UUID bookingId;

    @Column(nullable = false)
    private UUID hospitalId;

    @Column(nullable = false)
    private String itemName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private OtItemType itemType;

    @Column(nullable = false)
    private Integer quantity;

    @Column(nullable = false)
    private Double unitPrice;

    private UUID inventoryItemId;

    @Column(nullable = false)
    @Default
    private Boolean billable = true;

    @Column(nullable = false)
    private LocalDateTime addedAt;

    @PrePersist
    protected void onCreate() {
        if (addedAt == null) {
            addedAt = LocalDateTime.now();
        }
        if (id == null) {
            id = UUID.randomUUID();
        }
    }
}
