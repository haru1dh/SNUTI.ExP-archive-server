package com.snuti.exparchiveserver.user.repository

import com.snuti.exparchiveserver.user.entity.UserInterestTag
import org.springframework.data.jpa.repository.JpaRepository

interface UserInterestTagRepository : JpaRepository<UserInterestTag, Long> {
    fun findAllByUser_IdOrderByTag_NameAsc(userId: Long): List<UserInterestTag>

    fun deleteAllByUser_Id(userId: Long)
}
