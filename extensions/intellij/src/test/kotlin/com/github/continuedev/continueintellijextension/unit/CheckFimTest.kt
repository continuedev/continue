package com.github.continuedev.continueintellijextension.unit

import com.github.continuedev.continueintellijextension.FimResult
import com.github.continuedev.continueintellijextension.nextEdit.NextEditUtils.checkFim
import junit.framework.TestCase

class CheckFimTest : TestCase() {
    fun `test FIM`() {
        val oldEditRange = "hello world"
        val newEditRange = "hello this world"
        val cursorPosition = Pair(0, 6)
        assertEquals(checkFim(oldEditRange, newEditRange, cursorPosition), FimResult.FimEdit("this "))
    }

    fun `test multiline FIM`() {
        val oldEditRange = "hello {\n  world\n}"
        val newEditRange = "hello {\n  print()\n  world\n}"
        val cursorPosition = Pair(1, 2)
        assertEquals(checkFim(oldEditRange, newEditRange, cursorPosition), FimResult.FimEdit("print()\n  "))
    }

    fun `test not FIM`() {
        val oldEditRange = "hello world"
        val newEditRange = "hello this world"
        val cursorPosition = Pair(0, 8)
        assertEquals(checkFim(oldEditRange, newEditRange, cursorPosition), FimResult.NotFimEdit)
    }

    fun `test multiline not FIM`() {
        val oldEditRange = "hello {\n  world\n}"
        val newEditRange = "hello {\n  world\n}\nprint()"
        val cursorPosition = Pair(1, 2)
        assertEquals(checkFim(oldEditRange, newEditRange, cursorPosition), FimResult.NotFimEdit)
    }

    fun `test FIM edge`() {
        val oldEditRange = ""
        val newEditRange = ""
        val cursorPosition = Pair(0, 0)
        assertEquals(checkFim(oldEditRange, newEditRange, cursorPosition), FimResult.FimEdit(""))
    }
}
