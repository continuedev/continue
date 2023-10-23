import os
from typing import Any, Dict, List, Optional

from pydantic import BaseModel

from ...core.context import (
    ContextItem,
    ContextItemDescription,
    ContextItemId,
    ContextProvider,
)
from ...core.main import ChatMessage
from ...models.filesystem import RangeInFile, RangeInFileWithContents
from ...models.main import Range


class HighlightedRangeContextItem(BaseModel):
    rif: RangeInFileWithContents
    item: ContextItem


class HighlightedCodeContextProvider(ContextProvider):
    """
    The ContextProvider class is a plugin that lets you provide new information to the LLM by typing '@'.
    When you type '@', the context provider will be asked to populate a list of options.
    These options will be updated on each keystroke.
    When you hit enter on an option, the context provider will add that item to the autopilot's list of context (which is all stored in the ContextManager object).
    """

    title = "code"
    display_title = "Highlighted Code"
    description = "Highlight code"
    dynamic = True

    ide: Any  # IdeProtocolServer

    highlighted_ranges: List[HighlightedRangeContextItem] = []
    adding_highlighted_code: bool = True
    # Controls whether you can have more than one highlighted range. Now always True.

    should_get_fallback_context_item: bool = True
    last_added_fallback: bool = False

    async def _get_fallback_context_item(self) -> HighlightedRangeContextItem:
        # Used to automatically include the currently open file. Disabled for now.
        return None

        if not self.should_get_fallback_context_item:
            return None

        visible_files = await self.ide.getVisibleFiles()
        if len(visible_files) > 0:
            content = await self.ide.readFile(visible_files[0])
            rif = RangeInFileWithContents.from_entire_file(visible_files[0], content)

            item = self._rif_to_context_item(rif, 0, True)
            item.description.name = self._rif_to_name(rif, show_line_nums=False)

            self.last_added_fallback = True
            return HighlightedRangeContextItem(rif=rif, item=item)

        return None

    async def get_selected_items(self) -> List[ContextItem]:
        items = [hr.item for hr in self.highlighted_ranges]

        if len(items) == 0 and (
            fallback_item := await self._get_fallback_context_item()
        ):
            items = [fallback_item.item]

        return items

    async def get_chat_messages(self) -> List[ContextItem]:
        ranges = self.highlighted_ranges
        if len(ranges) == 0 and (
            fallback_item := await self._get_fallback_context_item()
        ):
            ranges = [fallback_item]

        return [
            ChatMessage(
                role="user",
                content=f"Code in this file is highlighted ({r.rif.filepath}):\n```\n{r.rif.contents}\n```",
                summary=f"Code in this file is highlighted: {r.rif.filepath}",
            )
            for r in ranges
        ]

    def _make_sure_is_editing_range(self):
        """If none of the highlighted ranges are currently being edited, the first should be selected"""
        if len(self.highlighted_ranges) == 0:
            return
        if not any(map(lambda x: x.item.editing, self.highlighted_ranges)):
            self.highlighted_ranges[0].item.editing = True

    def _disambiguate_highlighted_ranges(self):
        """If any files have the same name, also display their folder name"""
        name_status: Dict[
            str, set
        ] = {}  # basename -> set of full paths with that basename
        for hr in self.highlighted_ranges:
            basename = os.path.basename(hr.rif.filepath)
            if basename in name_status:
                name_status[basename].add(hr.rif.filepath)
            else:
                name_status[basename] = {hr.rif.filepath}

        for hr in self.highlighted_ranges:
            basename = os.path.basename(hr.rif.filepath)
            if len(name_status[basename]) > 1:
                hr.item.description.name = self._rif_to_name(
                    hr.rif,
                    display_filename=os.path.join(
                        os.path.basename(os.path.dirname(hr.rif.filepath)), basename
                    ),
                )
            else:
                hr.item.description.name = self._rif_to_name(
                    hr.rif, display_filename=basename
                )

    async def provide_context_items(self, workspace_dir: str) -> List[ContextItem]:
        return []

    async def get_item(self, id: ContextItemId, query: str) -> ContextItem:
        raise NotImplementedError()

    async def clear_context(self):
        self.highlighted_ranges = []
        self.adding_highlighted_code = False
        self.should_get_fallback_context_item = True
        self.last_added_fallback = False

    async def delete_context_with_ids(
        self, ids: List[ContextItemId]
    ) -> List[ContextItem]:
        ids_to_delete = [id.item_id for id in ids]

        kept_ranges = []
        for hr in self.highlighted_ranges:
            if hr.item.description.id.item_id not in ids_to_delete:
                kept_ranges.append(hr)
        self.highlighted_ranges = kept_ranges

        self._make_sure_is_editing_range()

        if len(self.highlighted_ranges) == 0 and self.last_added_fallback:
            self.should_get_fallback_context_item = False

        return [hr.item for hr in self.highlighted_ranges]

    def _rif_to_name(
        self,
        rif: RangeInFileWithContents,
        display_filename: str = None,
        show_line_nums: bool = True,
    ) -> str:
        line_nums = (
            f" ({rif.range.start.line + 1}-{rif.range.end.line + 1})"
            if show_line_nums
            else ""
        )
        return f"{display_filename or os.path.basename(rif.filepath)}{line_nums}"

    def _rif_to_context_item(
        self, rif: RangeInFileWithContents, idx: int, editing: bool
    ) -> ContextItem:
        return ContextItem(
            description=ContextItemDescription(
                name=self._rif_to_name(rif),
                description=rif.filepath,
                id=ContextItemId(provider_title=self.title, item_id=str(idx)),
            ),
            content=rif.contents,
            editing=editing if editing is not None else False,
            editable=True,
        )

    async def handle_highlighted_code(
        self,
        range_in_files: List[RangeInFileWithContents],
        edit: Optional[bool] = False,
    ):
        self.should_get_fallback_context_item = True
        self.last_added_fallback = False

        # Filter out rifs from ~/.continue/diffs folder
        range_in_files = [
            rif
            for rif in range_in_files
            if not os.path.dirname(rif.filepath)
            == os.path.expanduser("~/.continue/diffs")
        ]

        # If not adding highlighted code
        if not self.adding_highlighted_code:
            if (
                len(self.highlighted_ranges) == 1
                and len(range_in_files) <= 1
                and (
                    len(range_in_files) == 0
                    or range_in_files[0].range.start == range_in_files[0].range.end
                )
            ):
                # If un-highlighting the range to edit, then remove the range
                self.highlighted_ranges = []
            elif len(range_in_files) > 0:
                # Otherwise, replace the current range with the new one
                # This is the first range to be highlighted
                self.highlighted_ranges = [
                    HighlightedRangeContextItem(
                        rif=range_in_files[0],
                        item=self._rif_to_context_item(range_in_files[0], 0, edit),
                    )
                ]

            return

        # If editing, make sure none of the other ranges are editing
        if edit:
            for hr in self.highlighted_ranges:
                hr.item.editing = False

        # If new range overlaps with any existing, keep the existing but merged
        new_ranges = []
        for i, new_hr in enumerate(range_in_files):
            found_overlap_with = None
            for existing_rif in self.highlighted_ranges:
                if (
                    new_hr.filepath == existing_rif.rif.filepath
                    and new_hr.range.overlaps_with(existing_rif.rif.range)
                ):
                    existing_rif.rif.range = existing_rif.rif.range.merge_with(
                        new_hr.range
                    )
                    found_overlap_with = existing_rif
                    break

            if found_overlap_with is None:
                new_ranges.append(
                    HighlightedRangeContextItem(
                        rif=new_hr,
                        item=self._rif_to_context_item(
                            new_hr, len(self.highlighted_ranges) + i, edit
                        ),
                    )
                )
            elif edit:
                # Want to update the range so it's only the newly selected portion
                found_overlap_with.rif.range = new_hr.range
                found_overlap_with.item.editing = True

        self.highlighted_ranges = self.highlighted_ranges + new_ranges

        self._make_sure_is_editing_range()
        self._disambiguate_highlighted_ranges()

    async def set_editing_at_ids(self, ids: List[str]):
        # Don't do anything if there are no valid ids here
        count = 0
        for hr in self.highlighted_ranges:
            if hr.item.description.id.item_id in ids:
                count += 1

        if count == 0:
            return

        for hr in self.highlighted_ranges:
            hr.item.editing = hr.item.description.id.item_id in ids

    async def add_context_item(
        self, id: ContextItemId, query: str, prev: List[ContextItem] = None
    ) -> List[ContextItem]:
        raise NotImplementedError()

    async def manually_add_context_item(self, context_item: ContextItem):
        full_file_content = await self.ide.readFile(
            context_item.description.description
        )
        self.highlighted_ranges.append(
            HighlightedRangeContextItem(
                rif=RangeInFileWithContents(
                    filepath=context_item.description.description,
                    range=Range.from_lines_snippet_in_file(
                        content=full_file_content,
                        snippet=context_item.content,
                    ),
                    contents=context_item.content,
                ),
                item=context_item,
            )
        )

    async def preview_contents(self, id: ContextItemId):
        if item := next(
            filter(lambda x: x.item.description.id == id, self.highlighted_ranges), None
        ):
            filepath = os.path.join(
                self.sdk.ide.workspace_directory, item.item.description.description
            )
            await self.sdk.ide.setFileOpen(
                filepath,
                True,
            )
            line_nums_string = item.item.description.name.split(" ")[-1]
            line_nums = line_nums_string[1:-1].split("-")
            await self.sdk.ide.highlightCode(
                RangeInFile(
                    filepath=filepath,
                    range=Range.from_shorthand(
                        int(line_nums[0]) - 1, 0, int(line_nums[1]), 0
                    ),
                )
            )
