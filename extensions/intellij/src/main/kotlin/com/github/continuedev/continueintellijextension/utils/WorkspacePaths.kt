package com.github.continuedev.continueintellijextension.utils

import com.intellij.openapi.application.runReadAction
import com.intellij.openapi.module.ModuleManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.project.guessProjectDir
import com.intellij.openapi.roots.ModuleRootManager

/**
 * Helpers for resolving the set of workspace directories that Continue exposes to the
 * core (file references, @-context providers, indexing, git diff, ...).
 *
 * A JetBrains project can hold several modules — and several *attached* projects living side
 * by side in the same Project view, without necessarily sharing a common parent directory.
 * Each module contributes one or more content-root URIs. We only want to keep the "top-level"
 * roots, dropping any root that is physically nested inside another one (a module whose content
 * root lives under another module's content root).
 *
 * IMPORTANT: containment MUST be computed on URI *path segments*, never on a raw string prefix.
 * Two sibling roots can share a textual prefix without one being nested in the other, e.g.
 * "file:///ws/service" and "file:///ws/service-api". Using [String.startsWith] would wrongly
 * treat "service-api" as nested in "service" and silently drop it, so the second project's
 * files would never reach the core and every path under it would look broken.
 *
 * This mirrors the core's own resolution logic — see `core/util/uri.ts` `findUriInDirs`:
 * "Can't just use startsWith because e.g. file:///folder/file is not within file:///fold".
 */
object WorkspacePaths {

    /**
     * Returns the top-level content-root URIs out of [moduleRootUris], i.e. every root that is
     * not nested inside another root.
     *
     * - Duplicates are removed and the input order of the surviving roots is preserved.
     * - Trailing slashes are ignored when comparing, and blank entries are discarded.
     */
    fun topLevelWorkspacePaths(moduleRootUris: List<String>): List<String> {
        val roots = moduleRootUris
            .map { trimTrailingSlash(it) }
            .filter { it.isNotEmpty() }
            .distinct()

        return roots.filter { candidate ->
            roots.none { other -> other != candidate && isNestedUnder(candidate, other) }
        }
    }

    /**
     * True when [childUri] lives strictly under [parentUri], comparing on "/"-delimited URI
     * segments so that textual siblings (e.g. ".../api" vs ".../api-v2") are never mistaken for
     * a parent/child relationship. A root is never considered nested under itself.
     */
    fun isNestedUnder(childUri: String, parentUri: String): Boolean {
        val child = childUri.removeSuffix("/").split("/")
        val parent = parentUri.removeSuffix("/").split("/")
        // The child must be strictly deeper than the parent (equal or shallower can't be nested).
        if (child.size <= parent.size) return false
        for (i in parent.indices) {
            if (parent[i] != child[i]) return false
        }
        return true
    }

    /**
     * Removes a single trailing "/" so that ".../proj" and ".../proj/" compare equal, but leaves a
     * root URI intact: we must never turn "file:///" into the malformed "file://", nor a bare drive
     * root "file:///C:/" into "file:///C:".
     */
    private fun trimTrailingSlash(uri: String): String {
        if (!uri.endsWith("/")) return uri
        val trimmed = uri.dropLast(1)
        val lastSegment = trimmed.substringAfter("://", trimmed).substringAfterLast('/')
        return if (lastSegment.isEmpty() || lastSegment.endsWith(":")) uri else trimmed
    }
}

/**
 * Resolves the de-nested, de-duplicated top-level workspace directory URIs for [project] by
 * scanning every module's content roots.
 *
 * This is the single source of truth used by all workspace-path writers — the startup activity,
 * every [com.intellij.openapi.project.ModuleListener] callback (added / removed / renamed), and the
 * runtime fallback in `IntelliJIDE.workspaceDirectories()`. Routing them all through here guarantees
 * that a JetBrains window holding several modules / attached projects always exposes the same set of
 * roots, and that removing a module re-derives top-level status (e.g. promoting a formerly-nested
 * child once its parent module is gone) instead of leaving a stale array.
 *
 * Wrapped in a read action so it is safe to call from any thread.
 */
fun resolveWorkspacePaths(project: Project): Array<String> = runReadAction {
    val moduleRootUris = ModuleManager.getInstance(project).modules
        .flatMap { module -> ModuleRootManager.getInstance(module).contentRoots.mapNotNull { it.toUriOrNull() } }
    WorkspacePaths.topLevelWorkspacePaths(moduleRootUris).toTypedArray()
}

/**
 * Resolves the workspace directory URIs to expose to the core, with a robust three-step fallback:
 *
 *  1. [storedPaths] — the array maintained by the startup activity and the ModuleListener
 *     callbacks (the normal, steady-state path);
 *  2. a fresh [resolveWorkspacePaths] scan of the project's modules — so a window holding several
 *     modules / attached projects still gets *every* top-level root even when the core queries
 *     before the listener has populated the cache (transient window right after open);
 *  3. the single guessed project dir, as a last resort when no module exposes a content root.
 *
 * Both `IntelliJIDE.workspaceDirectories()` and `GitService.workspaceDirectories()` route through
 * this, so the two consumers can never drift apart and the multi-project case is handled identically
 * for @-references, indexing and git diff alike.
 *
 * Note on performance: step 2 only runs while [storedPaths] is empty (a brief window before the
 * listener fires); once the cache is populated every call returns in step 1, so the module scan is
 * not on the steady-state hot path.
 */
fun resolveWorkspacePathsOrGuess(project: Project, storedPaths: Array<String>?): Array<String> {
    if (storedPaths?.isNotEmpty() == true) {
        return storedPaths
    }

    val scanned = resolveWorkspacePaths(project)
    if (scanned.isNotEmpty()) {
        return scanned
    }

    return runReadAction { listOfNotNull(project.guessProjectDir()?.toUriOrNull()).toTypedArray() }
}
