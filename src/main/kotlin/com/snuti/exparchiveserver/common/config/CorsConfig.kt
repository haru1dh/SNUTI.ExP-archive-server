package com.snuti.exparchiveserver.common.config

import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.web.cors.CorsConfiguration
import org.springframework.web.cors.CorsConfigurationSource
import org.springframework.web.cors.UrlBasedCorsConfigurationSource

/**
 * Allows the GitHub Pages dashboard and local development servers to call the API.
 *
 * The allowed origins are deliberately explicit because this API uses Bearer tokens.
 * Do not replace this with a wildcard in production.
 */
@Configuration
class CorsConfig(
    @Value("\${app.cors.allowed-origins}") private val configuredAllowedOrigins: String
) {
    @Bean
    fun corsConfigurationSource(): CorsConfigurationSource {
        val configuration = CorsConfiguration().apply {
            allowedOrigins = configuredAllowedOrigins
                .split(',')
                .map(String::trim)
                .filter(String::isNotBlank)
                .toMutableList()
            allowedMethods = mutableListOf("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
            allowedHeaders = mutableListOf("Authorization", "Content-Type")
            exposedHeaders = mutableListOf("Authorization")
            maxAge = 3_600L
        }

        return UrlBasedCorsConfigurationSource().apply {
            registerCorsConfiguration("/**", configuration)
        }
    }
}
