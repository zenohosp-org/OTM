package com.ot.server.dto;

import com.ot.server.entity.OtItemType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.DecimalMin;
import java.util.UUID;

public record AddConsumptionItemRequest(
        @NotBlank
        @Size(max = 255)
        String itemName,
        @NotNull
        OtItemType itemType,
        @NotNull
        @Min(1)
        Integer quantity,
        @NotNull
        @DecimalMin("0.0")
        Double unitPrice,
        UUID inventoryItemId,
        Boolean billable
) {}
