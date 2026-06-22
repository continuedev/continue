package com.github.continuedev.continueintellijextension.auth

import com.intellij.util.messages.Topic

interface AuthListener {
    fun startAuthFlow()

<<<<<<< HEAD
    fun handleUpdatedSessionInfo(sessionInfo: ControlPlaneSessionInfo?)

    companion object {
        val TOPIC = Topic.create("StartAuthFlow", AuthListener::class.java)
    }
}
=======
    companion object {
        val TOPIC = Topic.create("StartAuthFlow", AuthListener::class.java)
    }
}
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
