package com.ot.server.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.Builder.Default;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "ot_bookings")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OtBooking {
    @Id
    @Default
    private UUID id = UUID.randomUUID();

    @Column(nullable = false)
    private UUID hospitalId;

    @Column(nullable = false)
    private Long patientId;

    @Column(nullable = false)
    private String patientName;

    @Column(nullable = false)
    private String patientMrn;

    @Column(nullable = false)
    private String procedureName;

    private BigDecimal procedureCharge;

    @Column(nullable = false)
    private Long roomId;

    @Column(nullable = false)
    private String roomName;

    @Column(nullable = false)
    private UUID surgeonId;

    @Column(nullable = false)
    private String surgeonName;

    @Column(nullable = false)
    private LocalDateTime scheduledStart;

    @Column(nullable = false)
    private LocalDateTime scheduledEnd;

    private LocalDateTime actualStart;

    private LocalDateTime actualEnd;

    @Column(nullable = false)
    @Default
    private Boolean sanitizationDone = false;

    private LocalDateTime sanitizedAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Default
    private OtBookingStatus status = OtBookingStatus.REQUESTED;

    private UUID admissionId;

    private Integer hmsPatientId;

    private UUID hmsServiceId;

    @Column(length = 1000)
    private String notes;

    @Column(nullable = false)
    @Default
    private Integer bufferMinutes = 30;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        if (id == null) {
            id = UUID.randomUUID();
        }
    }
}
