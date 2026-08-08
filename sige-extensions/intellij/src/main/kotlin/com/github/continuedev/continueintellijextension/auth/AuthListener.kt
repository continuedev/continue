package com.github.continuedev.continueintellijextension.auth

import com.intellij.util.messages.Topic

interface AuthListener {
    fun startAuthFlow()

    companion object {
        val TOPIC = Topic.create("StartAuthFlow", AuthListener::class.java)
    }
}
