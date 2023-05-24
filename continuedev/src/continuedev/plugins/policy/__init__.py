import pluggy

hookimpl = pluggy.HookimplMarker("continue.policy")
"""Marker to be imported and used in plugins (and for own implementations)"""