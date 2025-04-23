/*
 * Copyright © 2017 jjYBdx4IL (https://github.com/jjYBdx4IL)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package com.github.continuedev.continueintellijextension.utils

import org.apache.commons.lang3.SystemUtils
import org.slf4j.LoggerFactory
import java.io.File
import java.io.IOException
import java.net.URI

object Desktop {
    private val LOG = LoggerFactory.getLogger(Desktop::class.java)

    fun browse(uri: URI): Boolean {
        if (browseDESKTOP(uri)) {
            return true
        }

        if (openSystemSpecific(uri.toString())) {
            return true
        }

        LOG.warn("failed to browse {}", uri)
        return false
    }

    fun open(file: File): Boolean {
        if (openDESKTOP(file)) {
            return true
        }

        if (openSystemSpecific(file.path)) {
            return true
        }

        LOG.warn("failed to open {}", file.absolutePath)
        return false
    }

    fun edit(file: File): Boolean {
        if (editDESKTOP(file)) {
            return true
        }

        if (openSystemSpecific(file.path)) {
            return true
        }

        LOG.warn("failed to edit {}", file.absolutePath)
        return false
    }

    private fun openSystemSpecific(what: String): Boolean {
        if (SystemUtils.IS_OS_LINUX) {
            if (isXDG() && runCommand("xdg-open", "%s", what)) {
                return true
            }
            if (isKDE() && runCommand("kde-open", "%s", what)) {
                return true
            }
            if (isGNOME() && runCommand("gnome-open", "%s", what)) {
                return true
            }
            if (runCommand("kde-open", "%s", what)) {
                return true
            }
            if (runCommand("gnome-open", "%s", what)) {
                return true
            }
        }

        if (SystemUtils.IS_OS_MAC && runCommand("open", "%s", what)) {
            return true
        }

        if (SystemUtils.IS_OS_WINDOWS && runCommand("explorer", "%s", what)) {
            return true
        }

        return false
    }

    private fun browseDESKTOP(uri: URI): Boolean {
        return try {
            if (!java.awt.Desktop.isDesktopSupported()) {
                LOG.debug("Platform is not supported.")
                return false
            }

            if (!java.awt.Desktop.getDesktop().isSupported(java.awt.Desktop.Action.BROWSE)) {
                LOG.debug("BROWSE is not supported.")
                return false
            }

            LOG.info("Trying to use Desktop.getDesktop().browse() with {}", uri.toString())
            java.awt.Desktop.getDesktop().browse(uri)
            true
        } catch (t: Throwable) {
            LOG.error("Error using desktop browse.", t)
            false
        }
    }

    private fun openDESKTOP(file: File): Boolean {
        return try {
            if (!java.awt.Desktop.isDesktopSupported()) {
                LOG.debug("Platform is not supported.")
                return false
            }

            if (!java.awt.Desktop.getDesktop().isSupported(java.awt.Desktop.Action.OPEN)) {
                LOG.debug("OPEN is not supported.")
                return false
            }

            LOG.info("Trying to use Desktop.getDesktop().open() with {}", file.toString())
            java.awt.Desktop.getDesktop().open(file)
            true
        } catch (t: Throwable) {
            LOG.error("Error using desktop open.", t)
            false
        }
    }

    private fun editDESKTOP(file: File): Boolean {
        return try {
            if (!java.awt.Desktop.isDesktopSupported()) {
                LOG.debug("Platform is not supported.")
                return false
            }

            if (!java.awt.Desktop.getDesktop().isSupported(java.awt.Desktop.Action.EDIT)) {
                LOG.debug("EDIT is not supported.")
                return false
            }

            LOG.info("Trying to use Desktop.getDesktop().edit() with {}", file)
            java.awt.Desktop.getDesktop().edit(file)
            true
        } catch (t: Throwable) {
            LOG.error("Error using desktop edit.", t)
            false
        }
    }

    private fun runCommand(command: String, args: String, file: String): Boolean {
        LOG.info("Trying to exec:\n   cmd = {}\n   args = {}\n   %s = {}", command, args, file)

        val parts = prepareCommand(command, args, file)

        return try {
            val p = Runtime.getRuntime().exec(parts)
            if (p == null) {
                false
            } else {
                try {
                    val retval = p.exitValue()
                    if (retval == 0) {
                        LOG.error("Process ended immediately.")
                        false
                    } else {
                        LOG.error("Process crashed.")
                        false
                    }
                } catch (itse: IllegalThreadStateException) {
                    LOG.error("Process is running.")
                    true
                }
            }
        } catch (e: IOException) {
            LOG.error("Error running command.", e)
            false
        }
    }

    private fun prepareCommand(command: String, args: String?, file: String): Array<String> {
        val parts = mutableListOf<String>()
        parts.add(command)

        args?.split(" ")?.forEach { s ->
            parts.add(String.format(s, file).trim())
        }

        return parts.toTypedArray()
    }

    private fun isXDG(): Boolean {
        val xdgSessionId = System.getenv("XDG_SESSION_ID")
        return !xdgSessionId.isNullOrEmpty()
    }

    private fun isGNOME(): Boolean {
        val gdmSession = System.getenv("GDMSESSION")
        return gdmSession?.lowercase()?.contains("gnome") == true
    }

    private fun isKDE(): Boolean {
        val gdmSession = System.getenv("GDMSESSION")
        return gdmSession?.lowercase()?.contains("kde") == true
    }
}