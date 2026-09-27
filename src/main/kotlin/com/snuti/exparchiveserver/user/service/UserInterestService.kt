package com.snuti.exparchiveserver.user.service

import com.snuti.exparchiveserver.lecture.dto.TagResponse
import com.snuti.exparchiveserver.lecture.entity.Tag
import com.snuti.exparchiveserver.lecture.repository.TagRepository
import com.snuti.exparchiveserver.user.dto.ReplaceInterestTagsRequest
import com.snuti.exparchiveserver.user.entity.User
import com.snuti.exparchiveserver.user.entity.UserInterestTag
import com.snuti.exparchiveserver.user.repository.UserInterestTagRepository
import com.snuti.exparchiveserver.user.repository.UserRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class UserInterestService(
    private val userRepository: UserRepository,
    private val tagRepository: TagRepository,
    private val userInterestTagRepository: UserInterestTagRepository
) {
    @Transactional(readOnly = true)
    fun getInterestTags(currentUserEmail: String): List<TagResponse> {
        val userId = findUser(currentUserEmail).id!!

        return userInterestTagRepository
            .findAllByUser_IdOrderByTag_NameAsc(userId)
            .map { interest -> toTagResponse(interest.tag) }
    }

    @Transactional
    fun replaceInterestTags(
        currentUserEmail: String,
        request: ReplaceInterestTagsRequest
    ): List<TagResponse> {
        val user = findUser(currentUserEmail)
        val tagIds = request.tagIds.distinct()
        val tagsById = tagRepository.findAllById(tagIds)
            .associateBy { tag -> tag.id!! }

        val missingTagIds = tagIds.filter { tagId -> tagId !in tagsById }
        if (missingTagIds.isNotEmpty()) {
            throw IllegalArgumentException(
                "Unknown tag IDs: " + missingTagIds.joinToString(", ")
            )
        }

        userInterestTagRepository.deleteAllByUser_Id(user.id!!)
        userInterestTagRepository.flush()

        val savedInterests = userInterestTagRepository.saveAll(
            tagIds.map { tagId ->
                UserInterestTag(
                    user = user,
                    tag = tagsById.getValue(tagId)
                )
            }
        )

        return savedInterests.map { interest -> toTagResponse(interest.tag) }
    }

    private fun findUser(email: String): User {
        return userRepository.findByEmail(email)
            ?: throw IllegalArgumentException("User not found: " + email)
    }

    private fun toTagResponse(tag: Tag): TagResponse {
        return TagResponse(
            id = tag.id!!,
            name = tag.name
        )
    }
}
