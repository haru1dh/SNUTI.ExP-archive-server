package com.snuti.exparchiveserver.lecture.service

import com.snuti.exparchiveserver.lecture.dto.TagCreateRequest
import com.snuti.exparchiveserver.lecture.dto.TagResponse
import com.snuti.exparchiveserver.lecture.entity.Tag
import com.snuti.exparchiveserver.lecture.repository.TagRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class TagService(
    private val tagRepository: TagRepository
) {
    @Transactional
    fun createTag(request: TagCreateRequest): TagResponse {
        val name = request.name.trim()

        if (name.isBlank()) {
            throw IllegalArgumentException("Tag name must not be blank")
        }

        val tag = tagRepository.findByName(name)
            ?: tagRepository.save(Tag(name = name))

        return toTagResponse(tag)
    }

    @Transactional(readOnly = true)
    fun getTags(): List<TagResponse> {
        return tagRepository.findAllByOrderByNameAsc()
            .map { tag -> toTagResponse(tag) }
    }

    private fun toTagResponse(tag: Tag): TagResponse {
        return TagResponse(
            id = tag.id!!,
            name = tag.name
        )
    }
}
