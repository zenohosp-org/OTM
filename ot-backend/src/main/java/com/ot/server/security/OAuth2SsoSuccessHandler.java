package com.ot.server.security;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;

/**
 * After Spring Security completes the OAuth2 code → token exchange with
 * the Directory Backend, this handler redirects the browser to the Inventory
 * Frontend. Session is resolved from the shared SSO cookie set by Directory backend.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OAuth2SsoSuccessHandler implements AuthenticationSuccessHandler {

    @Value("${app.frontend.url}")
    private String frontendUrl;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request,
            HttpServletResponse response,
            Authentication authentication) throws IOException, ServletException {

        if (authentication instanceof OAuth2AuthenticationToken oauthToken) {
            log.info("SSO success for principal {}, redirecting to frontend", oauthToken.getName());
            response.sendRedirect(frontendUrl + "/sso/callback");
            return;
        }

        log.warn("SSO success handler invoked with unexpected authentication type");
        response.sendRedirect(frontendUrl + "/login?error=sso_failed");
    }
}

