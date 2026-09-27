package com.snuti.exparchiveserver.lecture.service

import com.snuti.exparchiveserver.common.storage.ImageStorageService
import com.snuti.exparchiveserver.lecture.dto.ArticleMapper
import com.snuti.exparchiveserver.lecture.dto.LectureDetailResponse
import com.snuti.exparchiveserver.lecture.dto.LectureListItemResponse
import com.snuti.exparchiveserver.lecture.dto.TagResponse
import com.snuti.exparchiveserver.lecture.dto.VideoResponse
import com.snuti.exparchiveserver.lecture.entity.Lecture
import com.snuti.exparchiveserver.lecture.entity.LectureStatus
import com.snuti.exparchiveserver.lecture.repository.LectureRepository
import com.snuti.exparchiveserver.user.repository.UserInterestTagRepository
import com.snuti.exparchiveserver.user.repository.UserRepository
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Pageable
import org.springframework.data.domain.Sort
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class LectureQueryService(
    private val lectureRepository: LectureRepository,
    private val imageStorageService: ImageStorageService,
    private val userRepository: UserRepository,
    private val userInterestTagRepository: UserInterestTagRepository
) {

    @Transactional(readOnly = true)
    fun getLectures(
        pageable: Pageable
    ): Page<LectureListItemResponse> {
        val sortedPageable = createSortedPageable(pageable)

        return lectureRepository
            .findAllByStatus(
                LectureStatus.PUBLISHED,
                sortedPageable
            )
            .map { lecture -> toListItemResponse(lecture) }
    }

    @Transactional(readOnly = true)
    fun searchLectures(
        keyword: String,
        pageable: Pageable
    ): Page<LectureListItemResponse> {
        val sortedPageable = createSortedPageable(pageable)

        return lectureRepository
            .findByStatusAndTitleContaining(
                LectureStatus.PUBLISHED,
                keyword,
                sortedPageable
            )
            .map { lecture -> toListItemResponse(lecture) }
    }

    /**
     * Returns published lectures that share at least one tag with the caller's
     * saved interest keywords. No interests is a valid empty recommendation set.
     */
    @Transactional(readOnly = true)
    fun getRecommendedLectures(
        currentUserEmail: String,
        pageable: Pageable
    ): Page<LectureListItemResponse> {
        val user = userRepository.findByEmail(currentUserEmail)
            ?: throw IllegalArgumentException(
                "User not found: " + currentUserEmail
            )
        val sortedPageable = createSortedPageable(pageable)
        val interestTagIds = userInterestTagRepository
            .findAllByUser_IdOrderByTag_NameAsc(user.id!!)
            .map { interest -> interest.tag.id!! }

        if (interestTagIds.isEmpty()) {
            return Page.empty(sortedPageable)
        }

        return lectureRepository
            .findPublishedByTagIds(
                status = LectureStatus.PUBLISHED,
                tagIds = interestTagIds,
                pageable = sortedPageable
            )
            .map { lecture -> toListItemResponse(lecture) }
    }

    @Transactional(readOnly = true)
    fun getLectureDetail(
        id: Long
    ): LectureDetailResponse {
        val lecture = lectureRepository.findById(id)
            .orElseThrow {
                IllegalArgumentException(
                    "Lecture not found: " + id
                )
            }

        return LectureDetailResponse(
            id = lecture.id!!,
            title = lecture.title,
            lectureDate = lecture.lectureDate,
            location = lecture.location,
            lectureSummary = lecture.lectureSummary,
            lecturerName = lecture.lecturerName,
            topic = lecture.topic,
            status = lecture.status,
            articles = lecture.articles
                .sortedBy { it.createdAt }
                .map { article ->
                    ArticleMapper.toResponse(
                        article,
                        imageStorageService
                    )
                },
            videos = lecture.videos
                .sortedBy { it.createdAt }
                .map { video ->
                    VideoResponse(
                        id = video.id!!,
                        lectureId = video.lecture.id!!,
                        videoUrl = video.videoUrl,
                        caption = video.caption,
                        createdAt = video.createdAt
                    )
                },
            tags = toTagResponses(lecture)
        )
    }

    private fun createSortedPageable(
        pageable: Pageable
    ): Pageable {
        return PageRequest.of(
            pageable.pageNumber,
            pageable.pageSize,
            Sort.by(
                Sort.Order.desc("createdAt"),
                Sort.Order.desc("id")
            )
        )
    }

    private fun toListItemResponse(
        lecture: Lecture
    ): LectureListItemResponse {
        return LectureListItemResponse(
            id = lecture.id!!,
            title = lecture.title,
            lectureDate = lecture.lectureDate,
            location = lecture.location,
            lectureSummary = lecture.lectureSummary,
            lecturerName = lecture.lecturerName,
            topic = lecture.topic,
            tags = toTagResponses(lecture)
        )
    }

    private fun toTagResponses(
        lecture: Lecture
    ): List<TagResponse> {
        return lecture.lectureTags
            .sortedBy { it.createdAt }
            .map { lectureTag ->
                TagResponse(
                    id = lectureTag.tag.id!!,
                    name = lectureTag.tag.name
                )
            }
    }
}
