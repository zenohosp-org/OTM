package com.ot.server.config;

import com.ot.server.security.JwtFilter;
import com.ot.server.security.JwtOAuth2UserService;
import com.ot.server.security.OAuth2SsoSuccessHandler;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

import java.util.List;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
@Slf4j
public class SecurityConfig {

        private final JwtFilter jwtFilter;
        private final OAuth2SsoSuccessHandler ssoSuccessHandler;
        private final JwtOAuth2UserService jwtOAuth2UserService;

        @org.springframework.beans.factory.annotation.Value("${app.frontend.url}")
        private String frontendUrl;

        @Bean
        public SecurityFilterChain securityFilterChain(HttpSecurity http, CorsFilter corsFilter) throws Exception {
                http
                                .addFilterBefore(corsFilter, UsernamePasswordAuthenticationFilter.class)
                                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                                .csrf(csrf -> csrf.disable())

                                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))

                                .authorizeHttpRequests(auth -> auth
                                                // OAuth2 login flow endpoints — handled by Spring Security
                                                .requestMatchers("/oauth2/**", "/login/oauth2/**").permitAll()
                                                .requestMatchers("/api/auth/logout", "/api/auth/dev-login").permitAll()
                                                // All other API endpoints require a valid JWT
                                                .requestMatchers("/api/**").authenticated()
                                                // Everything else (static, actuator, etc.)
                                                .anyRequest().permitAll())

                                // Spring Security OAuth2 Client — handles the redirect dance
                                .oauth2Login(oauth2 -> oauth2
                                                .userInfoEndpoint(userInfo -> userInfo
                                                                .userService(jwtOAuth2UserService))
                                                .successHandler(ssoSuccessHandler)
                                                .failureHandler((request, response, exception) -> {
                                                        log.error("SSO Login Failure: {}", exception.getMessage(),
                                                                        exception);
                                                        response.sendRedirect(frontendUrl + "/login?error=sso_failed");
                                                }))

                                // JWT Bearer filter runs BEFORE the default auth filter
                                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)

                                // Explicitly handle unauthorized access with custom messages
                                .exceptionHandling(ex -> ex
                                                .authenticationEntryPoint((request, response, authException) -> {
                                                        if (request.getRequestURI().startsWith("/api/")) {
                                                                response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                                                                response.setContentType("application/json");
                                                                response.getWriter().write(
                                                                                "{\"error\": \"Unauthorized\", \"message\": \"Authentication required\"}");
                                                        } else {
                                                                response.sendRedirect("/oauth2/authorization/directory");
                                                        }
                                                })
                                                .accessDeniedHandler((request, response, accessDeniedException) -> {
                                                        log.error("Access denied to {}: {}", request.getRequestURI(),
                                                                        accessDeniedException.getMessage());
                                                        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                                                        response.setContentType("application/json");
                                                        response.getWriter().write(
                                                                        "{\"error\": \"Forbidden\", \"message\": \"You do not have permission to access this resource\"}");
                                                }));

                return http.build();
        }

        @Bean
        public CorsConfigurationSource corsConfigurationSource() {
                CorsConfiguration configuration = new CorsConfiguration();
                // Allow local dev ports and production URLs
                configuration.setAllowedOrigins(
                                List.of(
                                        // Development
                                        "http://localhost:3000", "http://localhost:3001", "http://localhost:3002",
                                        "http://localhost:3003", "http://localhost:5173", "http://localhost:5174",
                                        "http://127.0.0.1:3000", "http://127.0.0.1:3002", "http://127.0.0.1:3003",
                                        // Production
                                        "https://ot.zenohosp.com",
                                        "https://inventory.zenohosp.com",
                                        "https://asset.zenohosp.com",
                                        "https://directory.zenohosp.com",
                                        "https://finance.zenohosp.com",
                                        "https://hms.zenohosp.com"
                ));
                configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
                configuration.setAllowedHeaders(List.of("Authorization", "Content-Type", "Accept", "X-Requested-With"));
                configuration.setAllowCredentials(true);
                configuration.setExposedHeaders(List.of("Authorization"));
                configuration.setMaxAge(3600L);

                UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
                source.registerCorsConfiguration("/**", configuration);
                return source;
        }

        @Bean
        public CorsFilter corsFilter() {
                return new CorsFilter(corsConfigurationSource());
        }
}
