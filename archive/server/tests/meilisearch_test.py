# import os

# import pytest
# from continuedev.libs.util.paths import getServerFolderPath
# from continuedev.server.meilisearch_server import (
#     check_meilisearch_running,
#     download_meilisearch,
#     ensure_meilisearch_installed,
#     kill_proc,
#     poll_meilisearch_running,
#     start_meilisearch,
# )

# @pytest.mark.asyncio
# async def test_meilisearch():
#     meilisearch_path = os.path.join(getServerFolderPath(), "meilisearch")
#     if os.path.exists(meilisearch_path):
#         os.remove(meilisearch_path)
#     kill_proc(7700)

#     await download_meilisearch()
#     await ensure_meilisearch_installed()
#     await check_meilisearch_running()
#     await poll_meilisearch_running()
#     await start_meilisearch()
#     kill_proc(7700)
