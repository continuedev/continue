from .ggml import GGML


class LMStudio(GGML):
    """LMStudio provides a professional and well-designed GUI for exploring, configuring, and serving LLMs. It is available on both Mac and Windows. To get started:\n1. Download from [lmstudio.ai](https://lmstudio.ai/) and open the application\n2. Search for and download the desired model from the home screen of LMStudio.\n3. In the left-bar, click the '<->' icon to open the Local Inference Server and press 'Start Server'.\n4. Once your model is loaded and the server has started, you can begin using Continue."""

    api_base: str = "http://localhost:1234"
