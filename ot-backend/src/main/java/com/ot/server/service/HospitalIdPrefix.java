package com.ot.server.service;

import com.ot.server.entity.Hospital;

public final class HospitalIdPrefix {

    private HospitalIdPrefix() {}

    public static String of(Hospital hospital) {
        if (hospital == null) return "";
        String code = hospital.getNumericCode();
        return (code != null && !code.isBlank()) ? code + "-" : "";
    }

    public static String of(String numericCode) {
        return (numericCode != null && !numericCode.isBlank()) ? numericCode + "-" : "";
    }

    public static String stripHospitalPrefix(String id) {
        if (id == null || id.length() < 5) return id;
        if (Character.isDigit(id.charAt(0))
                && Character.isDigit(id.charAt(1))
                && Character.isDigit(id.charAt(2))
                && Character.isDigit(id.charAt(3))
                && id.charAt(4) == '-') {
            return id.substring(5);
        }
        return id;
    }
}
