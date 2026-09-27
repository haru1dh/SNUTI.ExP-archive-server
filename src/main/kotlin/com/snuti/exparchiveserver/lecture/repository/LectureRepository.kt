package com.snuti.exparchiveserver.lecture.repository

import com.snuti.exparchiveserver.lecture.entity.Lecture
import com.snuti.exparchiveserver.lecture.entity.LectureStatus
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface LectureRepository : JpaRepository<Lecture, Long> {

    fun findAllByStatus(status: LectureStatus, pageable: Pageable): Page<Lecture>

    fun findByStatusAndTitleContaining(
        status: LectureStatus,
        keyword: String,
        pageable: Pageable
    ): Page<Lecture>

    @Query(
        value = """
            select distinct lecture
            from Lecture lecture
            join lecture.lectureTags lectureTag
            where lecture.status = :status
              and lectureTag.tag.id in :tagIds
        """,
        countQuery = """
            select count(distinct lecture.id)
            from Lecture lecture
            join lecture.lectureTags lectureTag
            where lecture.status = :status
              and lectureTag.tag.id in :tagIds
        """
    )
    fun findPublishedByTagIds(
        @Param("status") status: LectureStatus,
        @Param("tagIds") tagIds: Collection<Long>,
        pageable: Pageable
    ): Page<Lecture>
}
