package com.github.continuedev.continueintellijextension.unit

import com.github.continuedev.continueintellijextension.FimResult
import com.github.continuedev.continueintellijextension.`continue`.UriUtils
import com.github.continuedev.continueintellijextension.utils.checkFim
import org.junit.jupiter.api.Disabled
import org.junit.jupiter.api.Test
import java.io.File
import kotlin.test.assertEquals

class CheckFimTest {
    @Test
    fun testFim() {
        val oldEditRange = "hello world"
        val newEditRange = "hello this world"
        val cursorPosition = Pair(0, 6)
        assertEquals(checkFim(oldEditRange, newEditRange, cursorPosition), FimResult.FimEdit("this "))
    }

    @Test
    fun testMultilineFim() {
        val oldEditRange = "hello {\n  world\n}"
        val newEditRange = "hello {\n  print()\n  world\n}"
        val cursorPosition = Pair(1, 2)
        assertEquals(checkFim(oldEditRange, newEditRange, cursorPosition), FimResult.FimEdit("print()\n  "))
    }

    @Test
    fun testNotFim() {
        val oldEditRange = "hello world"
        val newEditRange = "hello this world"
        val cursorPosition = Pair(0, 8)
        assertEquals(checkFim(oldEditRange, newEditRange, cursorPosition), FimResult.NotFimEdit)
    }

    @Test
    fun testMultilineNotFim() {
        val oldEditRange = "hello {\n  world\n}"
        val newEditRange = "hello {\n  world\n}\nprint()"
        val cursorPosition = Pair(1, 2)
        assertEquals(checkFim(oldEditRange, newEditRange, cursorPosition), FimResult.NotFimEdit)
    }

    @Test
    fun testFimEdge() {
        val oldEditRange = ""
        val newEditRange = ""
        val cursorPosition = Pair(0, 0)
        assertEquals(checkFim(oldEditRange, newEditRange, cursorPosition), FimResult.FimEdit(""))
    }
}
