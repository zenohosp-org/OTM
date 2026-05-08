package com.ot.server.controller;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import com.ot.server.security.JwtUtil;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@Slf4j
public class AuthController {

    private final JwtUtil jwtUtil;

    @Value("${sso.cookie.name:sso_token}")
    private String cookieName;

    @Value("${sso.cookie.domain:zenohosp.com}")
    private String cookieDomain;

    @GetMapping("/user/me")
    public ResponseEntity<?> getCurrentUser(Authentication auth) {
        if (auth == null || !auth.isAuthenticated()) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }

        String token = (String) auth.getCredentials();
        UUID hospitalId = jwtUtil.getHospitalId(token);
        if (hospitalId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Missing hospitalId in token"));
        }

        return ResponseEntity.ok(Map.of(
                "hospitalId", hospitalId,
                "modules", List.of("ot")
        ));
    }

    /**
     * Local development only — generates a signed JWT and sets the sso_token cookie
     * so the frontend can call backend APIs without going through SSO.
     * Only active when Spring profile is "local".
     */
    @Profile("local")
    @PostMapping("/auth/dev-login")
    public ResponseEntity<?> devLogin(
            @RequestParam(defaultValue = "e1b924ba-3cac-426d-a775-3c978fd95490") String hospitalId,
            HttpServletResponse response) {
        UUID mockUserId = UUID.fromString("00000000-0000-0000-0000-000000000001");
        UUID mockHospitalId = UUID.fromString(hospitalId);
        String token = jwtUtil.generateToken(mockUserId, mockHospitalId, "hospital_admin");

        Cookie cookie = new Cookie(cookieName, token);
        cookie.setPath("/");
        cookie.setDomain(cookieDomain);
        cookie.setHttpOnly(true);
        cookie.setMaxAge(86400);
        response.addCookie(cookie);

        log.info("[DEV] Dev login issued for hospitalId={}", mockHospitalId);
        return ResponseEntity.ok(Map.of("message", "Dev login successful", "hospitalId", mockHospitalId));
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpServletResponse response) {
        response.addHeader("Set-Cookie", String.format(
                "%s=; Path=/; Domain=%s; Max-Age=0; SameSite=Lax",
                cookieName, cookieDomain
        ));
        return ResponseEntity.ok(Map.of("message", "Logged out successfully"));
    }
}
