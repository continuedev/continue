"use client";

import { useState, useEffect, useRef, useContext, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Sparkles, Bot, Search } from "lucide-react";
import { IdeMessengerContext } from "@/context/IdeMessenger";

const getAssetPath = (assetName: string) => {
  return `${window.vscMediaUrl}/assets/${assetName}`;
};

export default function Features({ onNext }: { onNext: () => void }) {
  const [currentFeature, setCurrentFeature] = useState(0);
  const [progress, setProgress] = useState(0);
  const progressInterval = useRef<NodeJS.Timeout>();
  const [isLoading, setIsLoading] = useState(true);
  const [timestamp, setTimestamp] = useState(Date.now());

  const FEATURE_DURATION = 5000;
  const AUTO_PROGRESS = false;

  const features = [
    {
      icon: <Sparkles className="h-6 w-6" />,
      title: "PearAI Chat",
      description:
        "Ask the Chat in sidebar to help you understand code and make changes. Powered by Continue.",
      video: getAssetPath("pearai-chat-welcome.mp4"),
    },
    {
      icon: <Bot className="h-6 w-6" />,
      title: "PearAI Creator",
      description: "Ask for a new feature, a refactor, or to fix a bug. Creator will make and apply the changes to your files automatically. Powered by aider.",
      video: getAssetPath("pearai-creator-welcome.mp4"),
    },
    {
      icon: <Search className="h-6 w-6" />,
      title: "PearAI Search",
      description: "Search the web with AI. Never have out-of-date documentation for requests again. Powered by Perplexity.",
      video: getAssetPath("pearai-search-welcome.mp4"),
    },
  ];

  const ideMessenger = useContext(IdeMessengerContext);

  const isUserSignedIn = useMemo(() => {
    return ideMessenger.request("getPearAuth", undefined).then((res) => {
      return res?.accessToken ? true : false;
    });
  }, [ideMessenger]);

  const [videoSrc, setVideoSrc] = useState(features[0].video);

  useEffect(() => {
    setIsLoading(true);
    const img = new Image();
    img.onload = () => {
      setIsLoading(false);
      setVideoSrc(features[currentFeature].video);
    };
    img.src = features[currentFeature].video;
  }, [currentFeature]);

  useEffect(() => {
    if (!AUTO_PROGRESS) return;

    const startTime = Date.now();
    progressInterval.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newProgress = (elapsed / FEATURE_DURATION) * 100;

      if (newProgress >= 100) {
        setCurrentFeature((current) => (current + 1) % features.length);
        setProgress(0);
        clearInterval(progressInterval.current);
      } else {
        setProgress(newProgress);
      }
    }, 50);

    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, [currentFeature]);

  const handleFeatureChange = (index: number) => {
    setCurrentFeature(index);
    setProgress(0);
    setTimestamp(Date.now());
  };

  const handleNextClick = () => {
    if (currentFeature < features.length - 1) {
      // Increment the feature index if not the last one
      setCurrentFeature(currentFeature + 1);
      setProgress(0);
      setTimestamp(Date.now());
    } else {
      // Proceed to the next step if the last feature
      onNext();
    }
  };

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        handleNextClick();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentFeature]);

  return (
    <div className="flex w-full overflow-hidden text-foreground">
      <div className="w-[35%] min-w-[320px] max-w-[420px] flex flex-col h-screen">
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6 pt-8">
            <div>
              <h2 className="text-xl lg:text-2xl font-bold text-foreground mb-2">
                Welcome to PearAI
              </h2>
              <p className="text-sm text-muted-foreground">
                Speed up your development process by seamlessly integrating AI
                into your workflow.
              </p>
            </div>
            <div className="space-y-3">
              {features.map((feature, index) => (
                <Card
                  key={index}
                  className={`border-none p-3 transition-all duration-200 hover:scale-[1.02] ${
                    currentFeature === index
                      ? "bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] shadow-sm ring-1 ring-[var(--vscode-input-border)]"
                      : "bg-[var(--vscode-input-background)] text-[var(--vscode-foreground)] opacity-60 hover:opacity-80"
                  }`}
                  onClick={() => handleFeatureChange(index)}
                  style={{ cursor: "pointer" }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-1.5 rounded-lg ${
                        currentFeature === index
                          ? "bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)]"
                          : "bg-[var(--vscode-input-background)] text-[var(--vscode-foreground)] opacity-60"
                      }`}
                    >
                      {feature.icon}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-foreground text-sm">
                        {feature.title}
                      </h3>
                      {currentFeature === index && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {feature.description}
                        </p>
                      )}
                      {currentFeature === index && (
                        <Progress
                          value={progress}
                          className="mt-2 h-0.5 bg-input [&>div]:bg-button"
                        />
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-input shrink-0">
          <Button
            className="w-full text-button-foreground bg-button hover:bg-button-hover p-3 text-sm cursor-pointer relative"
            onClick={handleNextClick}
          >
            <span className="absolute left-1/2 -translate-x-1/2">Next</span>
          </Button>
        </div>
      </div>

      <div className="flex-1 relative bg-background">
        {features.map((feature, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-all duration-700 ${
              currentFeature === index ? "opacity-100 z-10" : "opacity-0 z-0"
            }`}
          >
            {currentFeature === index && (
              <div className="flex items-center justify-center h-full w-full">
                <video
                src={`${feature.video}`}
                  className="rounded-lg max-h-[90%] max-w-[90%] object-contain"
                  muted
                  autoPlay
                  playsInline
                  loop
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
