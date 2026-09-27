package com.snuti.exparchiveserver.lecture.repository

import com.snuti.exparchiveserver.lecture.entity.Tag
import org.springframework.data.jpa.repository.JpaRepository

interface TagRepository : JpaRepository<Tag, Long> {
    fun findByName(name: String): Tag?

    fun existsByName(name: String): Boolean

    fun findAllByOrderByNameAsc(): List<Tag>
}
