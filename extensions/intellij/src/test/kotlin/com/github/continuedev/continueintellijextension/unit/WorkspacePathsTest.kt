package com.github.continuedev.continueintellijextension.unit

import com.github.continuedev.continueintellijextension.utils.WorkspacePaths
import junit.framework.TestCase

/**
 * Unit tests for [WorkspacePaths.topLevelWorkspacePaths].
 *
 * These pin down the multi-project behaviour in the IntelliJ Project view (several modules /
 * attached projects, possibly without a common parent) and guard against the regression where
 * sibling roots sharing a textual prefix were dropped because containment was computed with a
 * naive [String.startsWith] instead of a path-segment comparison.
 */
class WorkspacePathsTest : TestCase() {

    fun `test empty input returns empty list`() {
        assertEquals(emptyList<String>(), WorkspacePaths.topLevelWorkspacePaths(emptyList()))
    }

    fun `test single root is kept`() {
        val roots = listOf("file:///home/user/project")
        assertEquals(roots, WorkspacePaths.topLevelWorkspacePaths(roots))
    }

    fun `test two unrelated projects under different parents are both kept`() {
        // Problem B: several projects in the same view, not under a common parent.
        val roots = listOf(
            "file:///home/user/frontend",
            "file:///var/lib/backend",
        )
        assertEquals(roots, WorkspacePaths.topLevelWorkspacePaths(roots))
    }

    fun `test two sibling projects sharing a textual prefix are both kept`() {
        // Regression: "service-api" must NOT be treated as nested inside "service".
        val roots = listOf(
            "file:///ws/service",
            "file:///ws/service-api",
        )
        val result = WorkspacePaths.topLevelWorkspacePaths(roots)
        assertTrue("service must be kept", result.contains("file:///ws/service"))
        assertTrue("service-api must be kept", result.contains("file:///ws/service-api"))
        assertEquals(2, result.size)
    }

    fun `test prefix sibling is kept regardless of declaration order`() {
        val roots = listOf(
            "file:///ws/service-api",
            "file:///ws/service",
        )
        assertEquals(2, WorkspacePaths.topLevelWorkspacePaths(roots).size)
    }

    fun `test genuinely nested module root is dropped`() {
        val roots = listOf(
            "file:///ws/app",
            "file:///ws/app/submodule",
        )
        assertEquals(listOf("file:///ws/app"), WorkspacePaths.topLevelWorkspacePaths(roots))
    }

    fun `test nested root is dropped even when listed before its parent`() {
        val roots = listOf(
            "file:///ws/app/submodule",
            "file:///ws/app",
        )
        assertEquals(listOf("file:///ws/app"), WorkspacePaths.topLevelWorkspacePaths(roots))
    }

    fun `test mixed nested and prefix siblings`() {
        val roots = listOf(
            "file:///ws/service",
            "file:///ws/service/core",     // nested -> dropped
            "file:///ws/service-api",      // sibling -> kept
            "file:///other/standalone",    // unrelated -> kept
        )
        val result = WorkspacePaths.topLevelWorkspacePaths(roots)
        assertEquals(
            listOf(
                "file:///ws/service",
                "file:///ws/service-api",
                "file:///other/standalone",
            ),
            result,
        )
    }

    fun `test duplicates are removed and order preserved`() {
        val roots = listOf(
            "file:///ws/a",
            "file:///ws/b",
            "file:///ws/a",
        )
        assertEquals(listOf("file:///ws/a", "file:///ws/b"), WorkspacePaths.topLevelWorkspacePaths(roots))
    }

    fun `test trailing slashes are normalized`() {
        val roots = listOf(
            "file:///ws/a/",
            "file:///ws/a",
        )
        assertEquals(listOf("file:///ws/a"), WorkspacePaths.topLevelWorkspacePaths(roots))
    }

    fun `test blank entries are discarded`() {
        val roots = listOf(
            "file:///ws/a",
            "",
            "/",
        )
        assertEquals(listOf("file:///ws/a"), WorkspacePaths.topLevelWorkspacePaths(roots))
    }

    fun `test remote WSL siblings sharing a prefix are both kept`() {
        // Problem A context (remote/WSL URIs) combined with Problem B (multiple projects).
        val roots = listOf(
            "file://wsl.localhost/Ubuntu/home/user/proj",
            "file://wsl.localhost/Ubuntu/home/user/proj-tests",
        )
        assertEquals(2, WorkspacePaths.topLevelWorkspacePaths(roots).size)
    }

    fun `test remote WSL nested root is dropped`() {
        val roots = listOf(
            "file://wsl.localhost/Ubuntu/home/user/proj",
            "file://wsl.localhost/Ubuntu/home/user/proj/module",
        )
        assertEquals(
            listOf("file://wsl.localhost/Ubuntu/home/user/proj"),
            WorkspacePaths.topLevelWorkspacePaths(roots),
        )
    }

    fun `test roots with different authorities are not nested`() {
        val roots = listOf(
            "file://hostA/ws/proj",
            "file://hostB/ws/proj/inner",
        )
        // Different authorities -> neither is nested under the other.
        assertEquals(2, WorkspacePaths.topLevelWorkspacePaths(roots).size)
    }

    fun `test windows drive siblings sharing a prefix are both kept`() {
        val roots = listOf(
            "file:///C:/dev/service",
            "file:///C:/dev/service-api",
        )
        assertEquals(2, WorkspacePaths.topLevelWorkspacePaths(roots).size)
    }

    fun `test removing a parent module promotes the previously nested child to top-level`() {
        // Models what moduleRemoved now does: recompute top-level roots from the REMAINING modules.
        // Before removal the child is (correctly) hidden under its parent...
        val beforeRemoval = listOf("file:///ws/app", "file:///ws/app/submodule")
        assertEquals(listOf("file:///ws/app"), WorkspacePaths.topLevelWorkspacePaths(beforeRemoval))
        // ...and once the parent module is gone, the child must surface as its own top-level root
        // (a plain exact-match subtraction from the stored array would never re-add it).
        val afterRemoval = listOf("file:///ws/app/submodule")
        assertEquals(listOf("file:///ws/app/submodule"), WorkspacePaths.topLevelWorkspacePaths(afterRemoval))
    }

    fun `test deeply nested chain collapses to the single shallowest root`() {
        val roots = listOf(
            "file:///ws/a/b/c",
            "file:///ws/a",
            "file:///ws/a/b",
        )
        assertEquals(listOf("file:///ws/a"), WorkspacePaths.topLevelWorkspacePaths(roots))
    }

    fun `test segment boundary - parent of parent is not confused with a same-prefixed sibling`() {
        val roots = listOf(
            "file:///ws/a",
            "file:///ws/ab/c",   // sibling tree sharing the 'a' textual prefix -> kept
        )
        assertEquals(2, WorkspacePaths.topLevelWorkspacePaths(roots).size)
    }

    fun `test filesystem root URI is preserved`() {
        // Regression: blindly trimming the trailing "/" would turn "file:///" into "file://".
        assertEquals(listOf("file:///"), WorkspacePaths.topLevelWorkspacePaths(listOf("file:///")))
    }

    fun `test windows drive root URI is preserved`() {
        // Regression: "file:///C:/" must not be trimmed to the rootless "file:///C:".
        assertEquals(listOf("file:///C:/"), WorkspacePaths.topLevelWorkspacePaths(listOf("file:///C:/")))
    }

    // --- isNestedUnder direct checks -------------------------------------------------------

    fun `test isNestedUnder true for real child`() {
        assertTrue(WorkspacePaths.isNestedUnder("file:///ws/app/sub", "file:///ws/app"))
    }

    fun `test isNestedUnder false for textual prefix sibling`() {
        assertFalse(WorkspacePaths.isNestedUnder("file:///ws/app-2", "file:///ws/app"))
    }

    fun `test isNestedUnder false for identical paths`() {
        assertFalse(WorkspacePaths.isNestedUnder("file:///ws/app", "file:///ws/app"))
    }

    fun `test isNestedUnder false when child is shallower`() {
        assertFalse(WorkspacePaths.isNestedUnder("file:///ws", "file:///ws/app"))
    }

    fun `test isNestedUnder ignores trailing slash`() {
        assertTrue(WorkspacePaths.isNestedUnder("file:///ws/app/sub/", "file:///ws/app/"))
    }
}
