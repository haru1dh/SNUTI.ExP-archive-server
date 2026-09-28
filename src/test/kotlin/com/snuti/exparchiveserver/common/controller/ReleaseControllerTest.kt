package com.snuti.exparchiveserver.common.controller

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class ReleaseControllerTest {
    @Test
    fun `returns only a safe short revision value`() {
        val response = ReleaseController("9baab23-hello_world.1<>").getRelease()

        assertThat(response.revision).isEqualTo("9baab23-hello_world.1")
    }

    @Test
    fun `uses unknown for a revision with no safe characters`() {
        val response = ReleaseController("<>").getRelease()

        assertThat(response.revision).isEqualTo("unknown")
    }
}
