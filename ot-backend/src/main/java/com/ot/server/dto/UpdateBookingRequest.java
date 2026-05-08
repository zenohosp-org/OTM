package com.ot.server.dto;

import java.time.LocalDateTime;
import java.math.BigDecimal;
import java.util.UUID;

public record UpdateBookingRequest(
        Long patientId,
        String patientName,
        String patientMrn,
        String procedureName,
        BigDecimal procedureCharge,
        Long roomId,
        String roomName,
        UUID surgeonId,
        String surgeonName,
        LocalDateTime scheduledStart,
        LocalDateTime scheduledEnd,
        String notes,
        Integer bufferMinutes
) {}
