#!/bin/bash

# Fix model provider titles and remove duplicate headings

# Process specific files individually
fix_file() {
    local file="$1"
    local title="$2"
    
    if [[ -f "$file" ]]; then
        echo "Processing: $file with title: $title"
        
        # Create temp file with frontmatter
        {
            echo "---"
            echo "title: \"$title\""
            echo "---"
            echo ""
            # Skip any lines that are headings and add rest of content
            grep -v '^# ' "$file"
        } > "$file.tmp"
        
        # Replace original file
        mv "$file.tmp" "$file"
    fi
}

# Fix specific files
fix_file "./customize/model-providers/more/groq.mdx" "Groq"
fix_file "./customize/model-providers/more/together.mdx" "Together AI"
fix_file "./customize/model-providers/more/lmstudio.mdx" "LM Studio"
fix_file "./customize/model-providers/more/llamacpp.mdx" "Llama.cpp"
fix_file "./customize/model-providers/more/openrouter.mdx" "OpenRouter"
fix_file "./customize/model-providers/more/huggingfaceinferenceapi.mdx" "HuggingFace Inference Endpoints"
fix_file "./customize/model-providers/more/cohere.mdx" "Cohere"
fix_file "./customize/model-providers/more/nvidia.mdx" "NVIDIA"
fix_file "./customize/model-providers/more/cloudflare.mdx" "Cloudflare"
fix_file "./customize/model-providers/more/deepinfra.mdx" "DeepInfra"
fix_file "./customize/model-providers/more/SambaNova.mdx" "SambaNova"
fix_file "./customize/model-providers/more/novita.mdx" "Novita"
fix_file "./customize/model-providers/more/llamafile.mdx" "Llamafile"
fix_file "./customize/model-providers/more/function-network.mdx" "Function Network"
fix_file "./customize/model-providers/more/asksage.mdx" "AskSage"
fix_file "./customize/model-providers/more/flowise.mdx" "Flowise"
fix_file "./customize/model-providers/more/morph.mdx" "Morph"
fix_file "./customize/model-providers/more/ncompass.mdx" "NCompass"
fix_file "./customize/model-providers/more/relace.mdx" "Relace"
fix_file "./customize/model-providers/more/textgenwebui.mdx" "Text Generation WebUI"
fix_file "./customize/model-providers/more/watsonx.mdx" "IBM WatsonX"
fix_file "./customize/model-providers/more/moonshot.mdx" "Moonshot AI"
fix_file "./customize/model-providers/more/cerebras.mdx" "Cerebras"
fix_file "./customize/model-providers/more/vllm.mdx" "vLLM"
fix_file "./customize/model-providers/more/replicatellm.mdx" "Replicate"
fix_file "./customize/model-providers/more/kindo.mdx" "Kindo"
fix_file "./customize/model-providers/more/scaleway.mdx" "Scaleway"
fix_file "./customize/model-providers/more/ovhcloud.mdx" "OVHcloud"
fix_file "./customize/model-providers/more/openvino_model_server.mdx" "OpenVINO Model Server"
fix_file "./customize/model-providers/more/nebius.mdx" "Nebius"
fix_file "./customize/model-providers/more/ipex_llm.mdx" "Intel Extension for PyTorch"
fix_file "./customize/model-providers/more/siliconflow.mdx" "SiliconFlow"
fix_file "./customize/model-providers/more/msty.mdx" "Msty"
fix_file "./customize/model-providers/more/sagemaker.mdx" "Amazon SageMaker"
fix_file "./customize/model-providers/more/venice.md" "Venice AI"

echo "Fixed all model provider titles and removed duplicate headings"