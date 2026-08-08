package com.github.continuedev.continueintellijextension.activities

import com.intellij.openapi.Disposable
import com.intellij.openapi.components.Service

/**
 * The service is a parent disposable that represents the entire plugin lifecycle
 * and is intended to be used instead of the project/application as a parent disposable,
 * ensures that disposables registered using it as parents will be processed when the plugin is unloaded to avoid memory leaks.
 *
 * @author lk
 */
@Service(Service.Level.APP, Service.Level.PROJECT)
class ContinuePluginDisposable : Disposable {

    override fun dispose() {
    }

}