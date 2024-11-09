"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useContext, useState, useEffect } from "react";
import { IdeMessengerContext } from "@/context/IdeMessenger";
import { getLogoPath } from "./ImportExtensions";

interface Tool {
    id: string;
    name: string;
    description: string;
    icon: JSX.Element | string;
    installCommand: () => Promise<void>;
    preInstalled: boolean;
}


export default function InstallTools({
    onNext,
}: {
    onNext: () => void;
}) {

    const handleVSCExtensionInstall = async (extensionId: string) => {
        ideMessenger.post("installVscodeExtension", { extensionId });
    };

    const handleAiderInstall = async () => {
        ideMessenger.post("installAider", undefined);
    };

    const tools: Tool[] = [
        {
            id: "aider",
            name: "PearAI Creator",
            description: "PearAI Creator is a no-code tool powered by Aider that let's you build complete features with just a prompt.",
            icon: "inventory-creator.svg",
            installCommand: handleAiderInstall,
            preInstalled: false
        },
        {
            id: "supermaven",
            name: "PearAI Predict",
            description: "PearAI Predict is an AI powered code-completion tool. It is currently recommended by PearAI as a standalone Supermaven extension.",
            icon: "autocomplete.svg",
            installCommand: () => handleVSCExtensionInstall("supermaven.supermaven"),
            preInstalled: false
        }
    ];

    const ideMessenger = useContext(IdeMessengerContext);
    const [isInstallingAll, setIsInstallingAll] = useState(false);
    const [attemptedInstalls, setAttemptedInstalls] = useState<string[]>(() => {
        const saved = localStorage.getItem('onboardingAttemptedInstalls');
        return saved ? JSON.parse(saved) : [];
    });

    const [checkedTools, setCheckedTools] = useState<Record<string, boolean>>(() => {
        const initialState: Record<string, boolean> = {};
        tools.forEach(tool => {
            initialState[tool.id] = true;
        });
        return initialState;
    });



    const handleInstallAll = async () => {
        setIsInstallingAll(true);

        const toolsToInstall = tools.filter(tool => !attemptedInstalls.includes(tool.id));
        toolsToInstall.forEach(tool => tool.installCommand());

        // Save to attempted installations
        const newAttemptedInstalls = [...new Set([...attemptedInstalls, ...toolsToInstall.map(t => t.id)])];
        localStorage.setItem('onboardingAttemptedInstalls', JSON.stringify(newAttemptedInstalls));
        setAttemptedInstalls(newAttemptedInstalls);

        setTimeout(() => {
            setIsInstallingAll(false);
            onNext();
        }, 3000);
    };

    const handleCheckboxChange = (toolId: string) => {
        setCheckedTools(prev => ({ ...prev, [toolId]: !prev[toolId] }));
    };

    const handleInstallChecked = async () => {
        setIsInstallingAll(true);
        
        const selectedTools = tools.filter(tool => 
            checkedTools[tool.id] && !attemptedInstalls.includes(tool.id)
        );
        selectedTools.forEach(tool => tool.installCommand());

        // Save to attempted installations
        const newAttemptedInstalls = [...new Set([...attemptedInstalls, ...selectedTools.map(t => t.id)])];
        localStorage.setItem('onboardingAttemptedInstalls', JSON.stringify(newAttemptedInstalls));
        setAttemptedInstalls(newAttemptedInstalls);

        setTimeout(() => {
            setIsInstallingAll(false);
            onNext();
        }, 3000);
    };

    const areAllToolsSelected = () => {
        return tools.every(tool => checkedTools[tool.id]);
    };

    const areAnyToolsSelected = () => {
        return tools.some(tool => checkedTools[tool.id]);
    };

    const areAllToolsAttempted = () => {
        return tools.every(tool => attemptedInstalls.includes(tool.id));
    };

    const getButtonText = () => {
        if (areAllToolsAttempted()) {
            return "All Tools Setup Initiated";
        }
        if (!areAnyToolsSelected()) {
            return "None Selected";
        }
        return areAllToolsSelected() ? "Install All Tools" : "Install Selected Tools";
    };

    useEffect(() => {
        const handleKeyPress = (event: KeyboardEvent) => {
            if (event.key === 'Enter' && !isInstallingAll) {
                handleInstallAll();
            } else if ((event.metaKey || event.ctrlKey) && event.key === 'ArrowRight') {
                event.preventDefault();
                onNext();
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [isInstallingAll]);

    return (
        <div className="step-content flex w-full h-screen items-center justify-center bg-background text-foreground">
            <div className="w-full max-w-[800px] flex flex-col items-center p-4">
                <h5 className="text-xl md:text-2xl lg:text-2xl font-bold text-foreground mb-12 text-center">
                    PearAI requires some extra installation for the following integrations
                </h5>
    
                <div className="w-full space-y-2 mb-4">
                    {tools.map((tool) => (
                        <Card key={tool.id} className={`p-4 flex items-center border-solid border-2 justify-between ${
                            tool.preInstalled || attemptedInstalls.includes(tool.id) ? 'opacity-60' : ''
                        }`}>
                            <div className="flex items-center gap-4 flex-1">
                                <div className="p-1 bg-muted rounded-lg">
                                    {typeof tool.icon === 'string' ? 
                                    <img src={getLogoPath(tool.icon)} alt={tool.name} className="h-[80px]" /> 
                                    : tool.icon}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <div className="font-semibold text-lg">{tool.name}</div>
                                        {(tool.preInstalled || attemptedInstalls.includes(tool.id)) && (
                                            <span className="text-xs ml-2 bg-foreground text-white px-2 py-1 rounded-md">
                                                {tool.preInstalled ? 'Pre-installed' : 'Setup initiated'}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-muted-foreground">{tool.description}</p>
                                </div>
                            </div>
                            <div className="flex items-center h-5 ml-4">
                                <input
                                    type="checkbox"
                                    checked={checkedTools[tool.id] || false}
                                    onChange={() => handleCheckboxChange(tool.id)}
                                    disabled={tool.preInstalled || attemptedInstalls.includes(tool.id)}
                                    className="h-5 w-5 rounded-sm cursor-pointer focus:outline-none"
                                    style={{
                                        accentColor: 'var(--button-background)',
                                    }}
                                />
                            </div>
                        </Card>
                    ))}
                </div>
                <div className="absolute bottom-8 right-8 flex items-center gap-4">
                <div
                    onClick={onNext}
                    className="flex items-center gap-2 cursor-pointer"
                >
                    Skip
                </div>
                <Button
              className="w-[250px] text-button-foreground bg-button hover:bg-button-hover p-4 lg:py-6 lg:px-2 text-sm md:text-base cursor-pointer"
              onClick={handleInstallChecked}
                    disabled={isInstallingAll || !areAnyToolsSelected() || areAllToolsAttempted()}
                >
                    {getButtonText()}
                </Button>
                </div>
            </div>
        </div>
    );
}
