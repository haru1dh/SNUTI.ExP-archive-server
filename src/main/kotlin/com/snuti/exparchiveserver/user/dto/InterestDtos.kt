package com.snuti.exparchiveserver.user.dto

import jakarta.validation.constraints.Size

/**
 * Replaces the caller's complete interest-keyword selection.
 *
 * An empty list deliberately means "clear all of my interests".
 */
data class ReplaceInterestTagsRequest(
    @field:Size(
        max = 30,
        message = "You can select up to 30 interest keywords."
    )
    val tagIds: List<Long>
)
