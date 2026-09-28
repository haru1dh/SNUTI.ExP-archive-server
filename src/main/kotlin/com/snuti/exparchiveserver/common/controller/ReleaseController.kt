package com.snuti.exparchiveserver.common.controller

import org.springframework.beans.factory.annotation.Value
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/**
 * Deliberately small public deployment marker for the GitHub Pages mobile app.
 *
 * This endpoint returns a commit identifier only. It must never include
 * environment variables, health dependency details, credentials, or config.
 */
@RestController
@RequestMapping("/public")
class ReleaseController(
    @Value("\${app.release.revision:local}") private val revision: String
) {
    @GetMapping("/release")
    fun getRelease(): ReleaseResponse {
        return ReleaseResponse(
            revision = revision
                .filter { it.isLetterOrDigit() || it == '-' || it == '_' || it == '.' }
                .take(64)
                .ifBlank { "unknown" }
        )
    }
}

data class ReleaseResponse(
    val revision: String
)
