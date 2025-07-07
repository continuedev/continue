#!/bin/bash

# Fix model provider titles and remove duplicate headings

declare -A title_map=(
    ["groq.mdx"]="Groq"
    ["together.mdx"]="Together AI"
    ["lmstudio.mdx"]="LM Studio"
    ["llamacpp.mdx"]="Llama.cpp"
    ["openrouter.mdx"]="OpenRouter"
    ["huggingfaceinferenceapi.mdx"]="HuggingFace Inference Endpoints"
    ["cohere.mdx"]="Cohere"
    ["nvidia.mdx"]="NVIDIA"
    ["cloudflare.mdx"]="Cloudflare"
    ["deepinfra.mdx"]="DeepInfra"
    ["SambaNova.mdx"]="SambaNova"
    ["novita.mdx"]="Novita"
    ["llamafile.mdx"]="Llamafile"
    ["function-network.mdx"]="Function Network"
    ["asksage.mdx"]="AskSage"
    ["flowise.mdx"]="Flowise"
    ["morph.mdx"]="Morph"
    ["ncompass.mdx"]="NCompass"
    ["relace.mdx"]="Relace"
    ["textgenwebui.mdx"]="Text Generation WebUI"
    ["watsonx.mdx"]="IBM WatsonX"
    ["moonshot.mdx"]="Moonshot AI"
    ["cerebras.mdx"]="Cerebras"
    ["vllm.mdx"]="vLLM"
    ["replicatellm.mdx"]="Replicate"
    ["kindo.mdx"]="Kindo"
    ["scaleway.mdx"]="Scaleway"
    ["ovhcloud.mdx"]="OVHcloud"
    ["openvino_model_server.mdx"]="OpenVINO Model Server"
    ["nebius.mdx"]="Nebius"
    ["ipex_llm.mdx"]="Intel Extension for PyTorch"
    ["siliconflow.mdx"]="SiliconFlow"
    ["msty.mdx"]="Msty"
    ["sagemaker.mdx"]="Amazon SageMaker"
)

# Process "more" providers
for file in ./customize/model-providers/more/*.mdx; do
    filename=$(basename "$file")
    
    if [[ -n "${title_map[$filename]}" ]]; then
        title="${title_map[$filename]}"
        echo "Processing: $file with title: $title"
        
        # Create temp file with frontmatter
        {
            echo "---"
            echo "title: \"$title\""
            echo "---"
            echo ""
            # Skip the first heading line and add rest of content
            tail -n +2 "$file" | sed '/^# .*/d'
        } > "$file.tmp"
        
        # Replace original file
        mv "$file.tmp" "$file"
    fi
done

# Also fix the venice.md file
if [[ -f "./customize/model-providers/more/venice.md" ]]; then
    echo "Processing: venice.md"
    {
        echo "---"
        echo "title: \"Venice AI\""
        echo "---"
        echo ""
        tail -n +2 "./customize/model-providers/more/venice.md" | sed '/^# .*/d'
    } > "./customize/model-providers/more/venice.md.tmp"
    mv "./customize/model-providers/more/venice.md.tmp" "./customize/model-providers/more/venice.md"
fi

echo "Fixed all model provider titles and removed duplicate headings"