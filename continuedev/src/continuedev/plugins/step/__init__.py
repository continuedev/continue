import pluggy

hookimpl = pluggy.HookimplMarker("continue.step")
"""Marker to be imported and used in plugins (and for own implementations)"""