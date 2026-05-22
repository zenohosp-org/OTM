package com.ot.server.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Entity
@Table(name = "hospitals")
@Getter
@NoArgsConstructor
public class Hospital {

    @Id
    private UUID id;

    @Column(name = "numeric_code", length = 4)
    private String numericCode;
}
