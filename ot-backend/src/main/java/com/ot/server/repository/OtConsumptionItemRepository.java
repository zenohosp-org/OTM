package com.ot.server.repository;

import com.ot.server.entity.OtConsumptionItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface OtConsumptionItemRepository extends JpaRepository<OtConsumptionItem, UUID> {
    List<OtConsumptionItem> findByBookingId(UUID bookingId);

    List<OtConsumptionItem> findByBookingIdAndHospitalId(UUID bookingId, UUID hospitalId);

    Optional<OtConsumptionItem> findByIdAndHospitalId(UUID id, UUID hospitalId);
}
