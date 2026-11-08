package com.github.continuedev.continueintellijextension.secrets

import com.intellij.credentialStore.CredentialAttributes
import com.intellij.credentialStore.generateServiceName
import com.intellij.ide.passwordSafe.PasswordSafe

/**
 * Where the IDE keeps secrets for core, such as API keys saved by the provider
 * setup flow. Core probes this by writing a marker and reading it back, and
 * falls back to ~/.continue/.env when it does not round-trip.
 */
interface SecretStore {
    fun get(key: String): String?

    /** An empty [value] removes the entry. */
    fun set(key: String, value: String)
}

/** Backed by the IDE's Password Safe (the system keychain when one is available). */
class PasswordSafeSecretStore : SecretStore {

    private fun attributes(key: String) = CredentialAttributes(generateServiceName(SUBSYSTEM, key))

    override fun get(key: String): String? =
        PasswordSafe.instance.getPassword(attributes(key))

    override fun set(key: String, value: String) =
        PasswordSafe.instance.setPassword(attributes(key), value.ifEmpty { null })

    private companion object {
        const val SUBSYSTEM = "Continuous"
    }
}

/** Implements core's `readSecrets` / `writeSecrets` on top of a [SecretStore]. Never logs values. */
object Secrets {

    /** The entries that have a value; names without one are left out. */
    fun read(store: SecretStore, keys: List<String>): Map<String, String> =
        keys.mapNotNull { key ->
            store.get(key)?.takeIf { it.isNotEmpty() }?.let { key to it }
        }.toMap()

    fun write(store: SecretStore, secrets: Map<String, String>) {
        for ((key, value) in secrets) {
            store.set(key, value)
        }
    }
}
