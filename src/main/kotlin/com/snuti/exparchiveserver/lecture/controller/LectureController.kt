package com.snuti.exparchiveserver.lecture.controller

import com.snuti.exparchiveserver.lecture.dto.LectureDetailResponse
import com.snuti.exparchiveserver.lecture.dto.LectureListItemResponse
import com.snuti.exparchiveserver.lecture.service.LectureQueryService
import io.swagger.v3.oas.annotations.Operation
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.web.PageableDefault
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/lectures")
class LectureController(
    private val lectureQueryService: LectureQueryService
) {

    @Operation(summary = "강연 목록 조회")
    @GetMapping
    fun getLectures(
        @PageableDefault(size = 20) pageable: Pageable
    ): Page<LectureListItemResponse> {
        return lectureQueryService.getLectures(pageable)
    }

    @Operation(summary = "관심 키워드 기반 강연 추천")
    @GetMapping("/recommended")
    fun getRecommendedLectures(
        @AuthenticationPrincipal email: String,
        @PageableDefault(size = 20) pageable: Pageable
    ): Page<LectureListItemResponse> {
        return lectureQueryService.getRecommendedLectures(email, pageable)
    }

    @Operation(summary = "키워드별 공개 강연 조회")
    @GetMapping("/by-tag")
    fun getLecturesByTag(
        @RequestParam tagId: Long,
        @PageableDefault(size = 20) pageable: Pageable
    ): Page<LectureListItemResponse> {
        return lectureQueryService.getLecturesByTag(tagId, pageable)
    }

    @GetMapping("/search")
    fun searchLectures(
        @RequestParam keyword: String,
        pageable: Pageable
    ): Page<LectureListItemResponse> {
        return lectureQueryService.searchLectures(keyword, pageable)
    }

    @Operation(summary = "강연 상세 조회")
    @GetMapping("/{id}")
    fun getLectureDetail(
        @PathVariable id: Long
    ): LectureDetailResponse {
        return lectureQueryService.getLectureDetail(id)
    }
}
