package com.snuti.exparchiveserver.lecture.controller

import com.snuti.exparchiveserver.lecture.dto.TagResponse
import com.snuti.exparchiveserver.lecture.service.TagService
import io.swagger.v3.oas.annotations.Operation
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/tags")
class TagController(
    private val tagService: TagService
) {
    @Operation(summary = "관심 키워드 선택용 태그 목록 조회")
    @GetMapping
    fun getTags(): List<TagResponse> {
        return tagService.getTags()
    }
}
