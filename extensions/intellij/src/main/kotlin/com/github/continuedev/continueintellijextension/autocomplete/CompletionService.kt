package com.github.continuedev.continueintellijextension.autocomplete


interface CompletionService {

    suspend fun getAutocomplete(uuid: String, url: String, line: Int, column: Int, fileContents: String? = null): String?

    fun acceptAutocomplete(uuid: String?)

}