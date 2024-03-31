package com.github.continuedev.continueintellijextension.editor

import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.google.gson.Gson
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.application.runWriteAction
import com.intellij.openapi.command.WriteCommandAction
import com.intellij.openapi.components.ServiceManager
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.editor.colors.TextAttributesKey
import com.intellij.openapi.editor.markup.HighlighterLayer
import com.intellij.openapi.editor.markup.RangeHighlighter
import com.intellij.openapi.editor.markup.TextAttributes
import com.intellij.openapi.fileEditor.FileDocumentManager
import com.intellij.openapi.project.Project
import com.intellij.ui.JBColor

enum class DiffLineType {
    SAME, NEW, OLD
}

class DiffStreamHandler(private val project: Project, private val editor: Editor, private val startLine: Int, private val endLine: Int) {
    private var currentLine = startLine

    private val greenKey = run {
        val attributes = TextAttributes().apply {
            backgroundColor = JBColor(0x4000FF00.toInt(), 0x4000FF00.toInt())
        }
        val key = TextAttributesKey.createTextAttributesKey("CONTINUE_DIFF_NEW_LINE")
        key.let { editor.colorsScheme.setAttributes(it, attributes) }
        key
    }

    private val currentLineKey = run {
        val attributes = TextAttributes().apply {
            backgroundColor = JBColor(0x20888888.toInt(), 0x20888888.toInt())
        }
        val key = TextAttributesKey.createTextAttributesKey("CONTINUE_DIFF_CURRENT_LINE")
        key.let { editor.colorsScheme.setAttributes(it, attributes) }
        key
    }

    private val unfinishedKey = run {
        val attributes = TextAttributes().apply {
            backgroundColor = JBColor(0x10888888.toInt(), 0x10888888.toInt())
        }
        val key = TextAttributesKey.createTextAttributesKey("CONTINUE_DIFF_UNFINISHED_LINE")
        key.let { editor.colorsScheme.setAttributes(it, attributes) }
        key
    }

    private var currentLineHighlighter: RangeHighlighter? = null
    private val unfinishedHighlighters: MutableList<RangeHighlighter> = mutableListOf()

    private fun handleDiffLine(type: DiffLineType, line: String) {
        when (type) {
            DiffLineType.SAME -> {
                currentLine++
            }
            DiffLineType.NEW -> {
                // Insert new line
                val offset = editor.document.getLineStartOffset(currentLine)
                editor.document.insertString(offset, line + "\n")

                // Highlight the new line green
                editor.markupModel.addLineHighlighter(greenKey, currentLine, HighlighterLayer.LAST)

                currentLine++
            }
            DiffLineType.OLD -> {
                // Remove old line
                val startOffset = editor.document.getLineStartOffset(currentLine)
                val endOffset = editor.document.getLineEndOffset(currentLine) + 1
                editor.document.deleteString(startOffset, endOffset)
            }
        }

        // Highlight the current line
        if (currentLineHighlighter != null) {
            editor.markupModel.removeHighlighter(currentLineHighlighter!!)
        }
        currentLineHighlighter = editor.markupModel.addLineHighlighter(currentLineKey, currentLine, HighlighterLayer.LAST)

        // Remove the unfinished highlighter top line
        if (type != DiffLineType.OLD) {
            if (unfinishedHighlighters.isNotEmpty()) {
                editor.markupModel.removeHighlighter(unfinishedHighlighters.removeAt(0))
            }
        }
    }

    fun run(input : String, prefix : String, highlighted : String, suffix : String) {
        // Highlight the range with unfinished color
        for (i in startLine..endLine) {
            val highlighter = editor.markupModel.addLineHighlighter(unfinishedKey, i, HighlighterLayer.FIRST)
            unfinishedHighlighters.add(highlighter)
        }

        // Request diff stream from core
        val continuePluginService = ServiceManager.getService(
                this.project,
                ContinuePluginService::class.java
        )
        val virtualFile = FileDocumentManager.getInstance().getFile(editor.document)
        continuePluginService.coreMessenger?.request("streamDiffLines", mapOf(
                "input" to input,
                "prefix" to prefix,
                "highlighted" to highlighted,
                "suffix" to suffix,
                "language" to virtualFile?.fileType?.name,
        ), null) { response ->
            val parsed = Gson().fromJson(response, Map::class.java)
            val done = parsed["done"] as? Boolean
            if (done == true) {
                ApplicationManager.getApplication().invokeLater {
                    editor.markupModel.removeAllHighlighters()
                }
                return@request
            }
            val data = parsed["content"] as Map<*, *>
            val type = data["type"] as String
            val diffLineType = when (type) {
                "same" -> DiffLineType.SAME
                "new" -> DiffLineType.NEW
                "old" -> DiffLineType.OLD
                else -> throw Exception("Unknown diff line type: $type")
            }

            WriteCommandAction.runWriteCommandAction(project) {
                handleDiffLine(diffLineType, data["line"] as String)
            }
        }
    }
}