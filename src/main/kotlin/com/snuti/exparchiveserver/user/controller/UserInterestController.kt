package com.snuti.exparchiveserver.user.controller

import com.snuti.exparchiveserver.lecture.dto.TagResponse
import com.snuti.exparchiveserver.user.dto.ReplaceInterestTagsRequest
import com.snuti.exparchiveserver.user.service.UserInterestService
import io.swagger.v3.oas.annotations.Operation
import jakarta.validation.Valid
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/users/me/interests")
class UserInterestController(
    private val userInterestService: UserInterestService
) {
    @Operation(summary = "내 관심 키워드 조회")
    @GetMapping
    fun getInterestTags(
        @AuthenticationPrincipal email: String
    ): List<TagResponse> {
        return userInterestService.getInterestTags(email)
    }

    @Operation(summary = "내 관심 키워드 전체 교체")
    @PutMapping
    fun replaceInterestTags(
        @AuthenticationPrincipal email: String,
        @Valid @RequestBody request: ReplaceInterestTagsRequest
    ): List<TagResponse> {
        return userInterestService.replaceInterestTags(email, request)
    }
}
