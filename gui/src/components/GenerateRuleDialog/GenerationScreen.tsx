import { useEffect, useRef, useState } from "react";
import Spinner from "../gui/Spinner";
import { Button } from "../ui";

interface GenerationScreenProps {
  generatedContent: string;
  isGenerating: boolean;
  error: string | null;
  onBack: () => void;
  onContinue: () => void;
}

export function GenerationScreen({
  generatedContent,
  isGenerating,
  error,
  onBack,
  onContinue,
}: GenerationScreenProps) {
  const [editableContent, setEditableContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Update editable content when generation completes
  useEffect(() => {
    if (!isGenerating && generatedContent) {
      setEditableContent(generatedContent);
    }
  }, [isGenerating, generatedContent]);

  // Auto-scroll textarea as content streams in
  useEffect(() => {
    if (textareaRef.current && isGenerating) {
      textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
    }
  }, [generatedContent, isGenerating]);

  const displayContent = isGenerating ? generatedContent : editableContent;
  const showSpinner = isGenerating && !generatedContent;

  return (
    <div className="px-2 pb-2 pt-4 sm:px-4">
      <div>
        <div className="text-center">
          <h2 className="mb-0">Your rule</h2>
          <p className="text-description m-0 mt-2 p-0">
            Review and edit your generated rule below
          </p>
        </div>
        <div className="mt-5">
          <div className="flex flex-col gap-4">
            <div className="relative">
              <textarea
                ref={textareaRef}
                className="border-input-border bg-input text-input-foreground placeholder:text-input-placeholder focus:border-border-focus box-border w-full resize-none rounded border p-2 text-xs focus:outline-none"
                rows={10}
                value={displayContent}
                onChange={(e) => setEditableContent(e.target.value)}
                disabled={isGenerating}
                placeholder={
                  showSpinner ? "" : "Your generated rule will appear here..."
                }
              />
              {showSpinner && (
                <div className="absolute left-2 top-2">
                  <Spinner />
                </div>
              )}
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex flex-row justify-center gap-5">
              <Button
                type="button"
                className="min-w-16"
                onClick={onBack}
                variant="outline"
                disabled={isGenerating}
              >
                Back
              </Button>
              <Button
                className="min-w-16"
                onClick={onContinue}
                disabled={isGenerating || (!generatedContent && !error)}
              >
                Continue
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
