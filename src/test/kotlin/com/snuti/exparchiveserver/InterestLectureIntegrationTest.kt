package com.snuti.exparchiveserver

import com.snuti.exparchiveserver.lecture.entity.Article
import com.snuti.exparchiveserver.lecture.entity.Lecture
import com.snuti.exparchiveserver.lecture.entity.LectureStatus
import com.snuti.exparchiveserver.lecture.entity.LectureTag
import com.snuti.exparchiveserver.lecture.entity.Tag
import com.snuti.exparchiveserver.lecture.entity.Video
import com.snuti.exparchiveserver.lecture.repository.ArticleRepository
import com.snuti.exparchiveserver.lecture.repository.LectureRepository
import com.snuti.exparchiveserver.lecture.repository.LectureTagRepository
import com.snuti.exparchiveserver.lecture.repository.TagRepository
import com.snuti.exparchiveserver.lecture.repository.VideoRepository
import com.snuti.exparchiveserver.support.TestImageStorageConfig
import com.snuti.exparchiveserver.user.entity.Role
import com.snuti.exparchiveserver.user.entity.User
import com.snuti.exparchiveserver.user.repository.UserInterestTagRepository
import com.snuti.exparchiveserver.user.repository.UserRepository
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.context.annotation.Import
import org.springframework.http.MediaType
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import tools.jackson.databind.ObjectMapper
import java.time.LocalDateTime

@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc
@Import(TestImageStorageConfig::class)
class InterestLectureIntegrationTest
@Autowired
constructor(
    private val mvc: MockMvc,
    private val mapper: ObjectMapper,
    private val userRepository: UserRepository,
    private val userInterestTagRepository: UserInterestTagRepository,
    private val lectureRepository: LectureRepository,
    private val lectureTagRepository: LectureTagRepository,
    private val tagRepository: TagRepository,
    private val articleRepository: ArticleRepository,
    private val videoRepository: VideoRepository,
    private val passwordEncoder: PasswordEncoder
) {
    private lateinit var user: User
    private lateinit var userToken: String

    @BeforeEach
    fun setup() {
        userInterestTagRepository.deleteAll()
        lectureTagRepository.deleteAll()
        videoRepository.deleteAll()
        articleRepository.deleteAll()
        lectureRepository.deleteAll()
        tagRepository.deleteAll()
        userRepository.deleteAll()

        user = userRepository.save(
            User(
                email = "interest-user@snu.ac.kr",
                passwordHash = passwordEncoder.encode("password1234")!!,
                role = Role.USER
            )
        )
        userToken = login(user.email, "password1234")
    }

    @Test
    fun `should save interest tags and recommend only matching published lectures`() {
        val drugDiscovery = tagRepository.save(Tag(name = "신약개발"))
        val artificialIntelligence = tagRepository.save(Tag(name = "인공지능"))

        val matchingLecture = lectureRepository.save(
            createLecture(
                title = "신약개발 최신 동향",
                status = LectureStatus.PUBLISHED
            )
        )
        val nonMatchingLecture = lectureRepository.save(
            createLecture(
                title = "인공지능 세미나",
                status = LectureStatus.PUBLISHED
            )
        )
        val draftMatchingLecture = lectureRepository.save(
            createLecture(
                title = "신약개발 내부 검토",
                status = LectureStatus.DRAFT
            )
        )

        lectureTagRepository.saveAll(
            listOf(
                LectureTag(matchingLecture, drugDiscovery),
                LectureTag(nonMatchingLecture, artificialIntelligence),
                LectureTag(draftMatchingLecture, drugDiscovery)
            )
        )

        mvc.perform(
            put("/users/me/interests")
                .header("Authorization", "Bearer " + userToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(mapOf("tagIds" to listOf(drugDiscovery.id))))
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$[0].name").value("신약개발"))

        mvc.perform(
            get("/lectures/recommended")
                .header("Authorization", "Bearer " + userToken)
                .param("page", "0")
                .param("size", "12")
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.totalElements").value(1))
            .andExpect(jsonPath("$.content[0].id").value(matchingLecture.id))
            .andExpect(jsonPath("$.content[0].title").value("신약개발 최신 동향"))

        mvc.perform(
            get("/users/me/interests")
                .header("Authorization", "Bearer " + userToken)
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$[0].id").value(drugDiscovery.id))
    }

    @Test
    fun `should return an empty recommendation page when no interests are selected`() {
        mvc.perform(
            get("/lectures/recommended")
                .header("Authorization", "Bearer " + userToken)
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.totalElements").value(0))
            .andExpect(jsonPath("$.content").isEmpty)
    }

    @Test
    fun `should expose sorted selectable tags and reject unknown interest tags`() {
        tagRepository.save(Tag(name = "신약개발"))
        tagRepository.save(Tag(name = "인공지능"))

        mvc.perform(
            get("/tags")
                .header("Authorization", "Bearer " + userToken)
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$[0].name").value("신약개발"))

        mvc.perform(
            put("/users/me/interests")
                .header("Authorization", "Bearer " + userToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(mapOf("tagIds" to listOf(999999L))))
        )
            .andExpect(status().isBadRequest)
    }

    private fun createLecture(
        title: String,
        status: LectureStatus
    ): Lecture {
        return Lecture(
            title = title,
            lectureDate = LocalDateTime.of(2026, 9, 1, 10, 0),
            location = "Engineering Hall",
            lectureSummary = "Interest recommendation test",
            lecturerName = "Professor Kim",
            topic = "Test",
            status = status,
            createdBy = user
        )
    }

    private fun login(email: String, password: String): String {
        val result = mvc.perform(
            post("/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    mapper.writeValueAsString(
                        mapOf(
                            "email" to email,
                            "password" to password
                        )
                    )
                )
        )
            .andExpect(status().isOk)
            .andReturn()

        return mapper.readTree(result.response.contentAsString)["accessToken"].asText()
    }
}
