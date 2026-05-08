package com.ot.server.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * Reads the JWT from the sso_token HttpOnly cookie (priority) or Authorization: Bearer header on every request.
 * If valid, populates the SecurityContext so Spring Security recognises the user.
 */
@Component
@RequiredArgsConstructor
public class JwtFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;

    @Value("${sso.cookie.name:sso_token}")
    private String cookieName;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {

        SecurityContextHolder.clearContext();

        String token = extractToken(request);

        if (token != null) {
            if (jwtUtil.isValid(token)) {
                try {
                    String userId = jwtUtil.getUserId(token).toString();
                    String role = jwtUtil.getRole(token);

                    if (role == null)
                        role = "USER"; // Fallback

                    var authorities = List.of(new SimpleGrantedAuthority("ROLE_" + role.toUpperCase()));
                    var auth = new UsernamePasswordAuthenticationToken(userId, token, authorities);
                    SecurityContextHolder.getContext().setAuthentication(auth);
                    logger.debug("Successfully authenticated user " + userId + " with role " + role);
                } catch (Exception e) {
                    logger.error("Failed to set security context from token", e);
                }
            } else {
                logger.warn("Invalid JWT token received for request to " + request.getRequestURI());
            }
        }

        filterChain.doFilter(request, response);
    }

    private String extractToken(HttpServletRequest request) {
        // Priority 1: Extract from HttpOnly cookie (sso_token)
        if (request.getCookies() != null) {
            for (Cookie cookie : request.getCookies()) {
                if (cookieName.equals(cookie.getName())) {
                    String token = cookie.getValue();
                    if (token != null && !token.isEmpty()) {
                        logger.debug("Token extracted from cookie: " + cookieName);
                        return token;
                    }
                }
            }
        }

        // Fallback: Extract from Authorization: Bearer header
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            logger.debug("Token extracted from Authorization header");
            return header.substring(7);
        }

        return null;
    }
}
