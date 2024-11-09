"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, Bot, Search, Download, LogIn, User, Command, Terminal, Import, Move } from "lucide-react";
import { IdeMessengerContext } from "@/context/IdeMessenger";
import ImportExtensions from "./setup/ImportExtensions";
import AddToPath from "./setup/AddToPath";
import SignIn from "./setup/SignIn";
import InstallTools from "./setup/InstallTools";

export default function SetupPage({ onNext }: { onNext: () => void }) {
  const [currentFeature, setCurrentFeature] = useState(0);
  const [timestamp, setTimestamp] = useState(Date.now());
  console.dir(window.vscMediaUrl)

  const handleFeatureChange = (index: number) => {
    setCurrentFeature(index);
    setTimestamp(Date.now());
  };

  const handleNextClick = () => {
    if (currentFeature < setupSteps.length - 1) {
      // Increment the feature index if not the last one
      setCurrentFeature(currentFeature + 1);
      setTimestamp(Date.now());
    } else {
      // Proceed to the next step if the last feature
      onNext();
    }
  };

  const setupSteps = [
    {
      icon: <Move className="h-5 w-5" />,
      title: "Import VSCode Extensions",
      description:
        "Automatically import your extensions from VSCode to feel at home.",
      component: <ImportExtensions onNext={handleNextClick} />,
    },
    {
      icon: <Terminal className="h-6 w-6" />,
      title: "Add PearAI To Your Path",
      description: "Easily open PearAI from the command line with 'pearai'.",
      component: <AddToPath onNext={handleNextClick} />,
    },
    {
      icon: <Download className="h-6 w-6" />,
      title: "Install Additional Tools",
      description: "Install recommended tools to enhance your PearAI experience.",
      component: <InstallTools onNext={handleNextClick} />,
    },
    {
      icon: <User className="h-6 w-6" />,
      title: "Sign in",
      description: "Have PearAI work for free out of the box by signing in.",
      component: <SignIn onNext={handleNextClick} />,
    },
  ];

  return (
    <div className="flex w-full overflow-hidden text-foreground h-full">
      <div className="w-[35%] flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6 pt-8">
            <div>
              <h2 className="text-xl lg:text-2xl font-bold text-foreground mb-2">
                Quick Setup
              </h2>
              <p className="text-sm text-muted-foreground">
                Setup PearAI in less than 1 minute.
              </p>
            </div>
            <div className="space-y-3">
              {setupSteps.map((feature, index) => (
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
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>

      </div>

        <div className="w-[65%] flex flex-col h-full justify-center relative bg-background">
            {setupSteps.map((setupStep, index) => (
                <div
                key={index}
                className={`transition-opacity duration-300 ease-in-out ${
                    currentFeature === index
                    ? "opacity-100 z-10"
                    : "opacity-0 z-0"
                }`}
                >
                {index === currentFeature && setupStep.component}
                </div>
            ))}
        </div>
    </div>
  );
}
