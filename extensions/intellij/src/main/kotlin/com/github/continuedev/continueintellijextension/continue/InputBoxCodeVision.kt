package com.github.continuedev.continueintellijextension.`continue`

import com.intellij.codeInsight.codeVision.*
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.util.TextRange

class InputBoxCodeVision : CodeVisionProvider<Unit> {
    companion object {
        const val id: String = "continue.code.vision"
    }

    override val name: String
        get() = "Hello World!"
    override val relativeOrderings: List<CodeVisionRelativeOrdering>
        get() = emptyList()

    override val defaultAnchor: CodeVisionAnchorKind
        get() = CodeVisionAnchorKind.Default
    override val id: String
        get() = Companion.id

    override fun precomputeOnUiThread(editor: Editor) {}

    override fun computeCodeVision(editor: Editor, uiData: Unit): CodeVisionState {
        val lenses: List<Pair<TextRange, CodeVisionEntry>> = emptyList()
//        val range = TextRange(0, 1)
//        lenses.add(range to )
        return CodeVisionState.Ready(lenses)
    }
}