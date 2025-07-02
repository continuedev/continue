package com.github.continuedev.continueintellijextension

import com.intellij.openapi.util.IconLoader
import com.intellij.ui.AnimatedIcon

/**
 * @author lk
 */
object ContinueIcons {

    val CONTINUE = icon("/icons/continue.svg")

    val CLOSE = icon("/icons/close.svg")

    val SPINNING = AnimatedIcon.Default()

    private fun icon(path: String) = IconLoader.getIcon(path, ContinueIcons::class.java)
}