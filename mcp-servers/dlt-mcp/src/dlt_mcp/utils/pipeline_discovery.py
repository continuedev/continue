"""Pipeline discovery utilities for locating local dlt pipelines."""

import os
from pathlib import Path
from typing import List, Optional
from dlt.pipeline import Pipeline

from ..types import PipelineInfo


def discover_pipelines(working_dir: Optional[str] = None) -> List[PipelineInfo]:
    """
    Discover all dlt pipelines in the given directory.

    Args:
        working_dir: Directory to search for pipelines. Defaults to current working directory.

    Returns:
        List of PipelineInfo objects for discovered pipelines.
    """
    if working_dir is None:
        working_dir = os.getcwd()

    working_path = Path(working_dir).resolve()
    pipelines: List[PipelineInfo] = []

    # Check if there's a .dlt directory in the working directory
    dlt_dir = working_path / ".dlt"
    if dlt_dir.exists() and dlt_dir.is_dir():
        # Look for pipeline state files
        pipelines_dir = dlt_dir / "pipelines"
        if pipelines_dir.exists():
            for pipeline_name_dir in pipelines_dir.iterdir():
                if pipeline_name_dir.is_dir():
                    pipeline_name = pipeline_name_dir.name
                    try:
                        # Try to load the pipeline to get more info
                        pipeline = Pipeline(pipeline_name, pipelines_dir=str(pipelines_dir))
                        pipelines.append(
                            PipelineInfo(
                                name=pipeline_name,
                                pipeline_dir=str(working_path),
                                destination=pipeline.destination.destination_name if hasattr(pipeline, 'destination') else None,
                                dataset_name=pipeline.dataset_name if hasattr(pipeline, 'dataset_name') else None,
                            )
                        )
                    except Exception:
                        # If we can't load it, still include basic info
                        pipelines.append(
                            PipelineInfo(
                                name=pipeline_name,
                                pipeline_dir=str(working_path),
                            )
                        )

    # Also check for pipelines in the user's home directory .dlt folder
    # This is where dlt stores pipelines by default when not in a project directory
    try:
        home_dlt_dir = Path.home() / ".dlt" / "pipelines"
        if home_dlt_dir.exists():
            for pipeline_name_dir in home_dlt_dir.iterdir():
                if pipeline_name_dir.is_dir():
                    pipeline_name = pipeline_name_dir.name
                    # Check if we already found this pipeline
                    if not any(p.name == pipeline_name for p in pipelines):
                        try:
                            pipeline = Pipeline(pipeline_name)
                            pipelines.append(
                                PipelineInfo(
                                    name=pipeline_name,
                                    pipeline_dir=str(pipeline_name_dir),
                                    destination=pipeline.destination.destination_name if hasattr(pipeline, 'destination') else None,
                                    dataset_name=pipeline.dataset_name if hasattr(pipeline, 'dataset_name') else None,
                                )
                            )
                        except Exception:
                            pipelines.append(
                                PipelineInfo(
                                    name=pipeline_name,
                                    pipeline_dir=str(pipeline_name_dir),
                                )
                            )
    except Exception:
        # If we can't access the home dlt dir, continue
        pass

    return pipelines


def find_pipeline(pipeline_name: Optional[str] = None, working_dir: Optional[str] = None) -> Optional[Pipeline]:
    """
    Find and load a specific dlt pipeline.

    Args:
        pipeline_name: Name of the pipeline to find. If None, tries to find the first available pipeline.
        working_dir: Directory to search for pipelines.

    Returns:
        Pipeline object if found, None otherwise.
    """
    if working_dir is None:
        working_dir = os.getcwd()

    working_path = Path(working_dir).resolve()

    # First try in the working directory
    dlt_dir = working_path / ".dlt" / "pipelines"
    if dlt_dir.exists():
        if pipeline_name:
            pipeline_dir = dlt_dir / pipeline_name
            if pipeline_dir.exists():
                try:
                    return Pipeline(pipeline_name, pipelines_dir=str(dlt_dir))
                except Exception:
                    pass
        else:
            # Try to find any pipeline in this directory
            for pipeline_name_dir in dlt_dir.iterdir():
                if pipeline_name_dir.is_dir():
                    try:
                        return Pipeline(pipeline_name_dir.name, pipelines_dir=str(dlt_dir))
                    except Exception:
                        continue

    # Try in the user's home directory .dlt folder
    try:
        home_dlt_dir = Path.home() / ".dlt" / "pipelines"
        if home_dlt_dir.exists():
            if pipeline_name:
                try:
                    return Pipeline(pipeline_name)
                except Exception:
                    pass
            else:
                # Try to find any pipeline
                for pipeline_name_dir in home_dlt_dir.iterdir():
                    if pipeline_name_dir.is_dir():
                        try:
                            return Pipeline(pipeline_name_dir.name)
                        except Exception:
                            continue
    except Exception:
        pass

    return None

