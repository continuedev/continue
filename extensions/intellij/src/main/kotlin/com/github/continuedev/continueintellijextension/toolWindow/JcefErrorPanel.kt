package com.github.continuedev.continueintellijextension.toolWindow

import com.intellij.openapi.ui.DialogPanel
import com.intellij.ui.dsl.builder.panel
import com.intellij.util.ui.JBUI
import org.intellij.lang.annotations.Language

object JcefErrorPanel {

    fun create(): DialogPanel =
        panel {
            row {
                text(HTML)
            }
        }.withBorder(JBUI.Borders.empty(10))

    @Language("HTML")
    private const val HTML = """
        <!--suppress ALL-->
        <html>
        <h2>
          <center>Continue Chat is Unable to Load</center>
        </h2>
        <p>Continue Chat requires a JRE that supports the Java Chromium Embedded Framework (JCEF) to render our webview. You can
          still use Autocomplete and Edit.</p>
        <h3>How to Fix It?</h3>
        <p>You can manually switch to a JRE that supports JCEF:</p>
        <ol>
          <li>In the main menu, go to <b>Help&nbsp|&nbsp;Find&nbsp;Action</b> or press
            <b>Ctrl&nbsp;+&nbsp;Shift&nbsp;+&nbsp;A</b>.
          </li>
          <li>Find and select the <b>Choose&nbsp;Boot&nbsp;Java&nbsp;Runtime&nbsp;for&nbsp;the&nbsp;IDE</b> action.</li>
          <li>Select the runtime that comes with JCEF support and click <b>OK</b>.</li>
          <li>Restart with the new runtime.</li>
        </ol>
        <p>Runtimes that support JCEF are usually called <b>JetBrains&nbsp;Runtime</b> and have the <code>-jcef</code> suffix,
          for example <code>21.0.3+13-509.11-jcef</code>.</p>
        <br>
        <small>You can find more information in the <a href="https://www.jetbrains.com/help/idea/switching-boot-jdk.html">JetBrains documentation</a>.</small>
        </html>
    """

}