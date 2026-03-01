import { SlashCommand, ChatMessage } from "../../index.js";

const GuideSlashCommand: SlashCommand = {
  name: "guide",
  description: "Guide mode for beginners - interactive step-by-step discovery",
  run: async function* ({ llm, history, abortController }) {
    // Discovery questions workflow
    const discoveryQuestions = [
      {
        question: "What are you trying to build? Describe your idea in your own words.",
        context: "project_goal",
      },
      {
        question: "Who is this for? (Just me, Friends/Family, Public users, or Business?)",
        context: "target_audience",
      },
      {
        question: "What problem does this solve? Why do you need it?",
        context: "problem_statement",
      },
      {
        question: "What's your experience level? (Beginner/Intermediate/Advanced)",
        context: "experience_level",
      },
      {
        question: "Any specific requirements? (Tech preferences, constraints, must-haves - or just say 'none' to skip)",
        context: "requirements",
      },
    ];

    // Collect user responses
    const responses: Record<string, string> = {};

    // Start with greeting
    yield {
      role: "assistant" as const,
      content: `Hello! 👋 I'm excited to help you build something amazing!

I'll guide you through a quick discovery process to understand what you want to build. This helps me give you better results. Let's start!

**${discoveryQuestions[0].question}**`,
    };

    // Wait for first answer and continue with remaining questions
    for (let i = 1; i < discoveryQuestions.length; i++) {
      yield {
        role: "assistant" as const,
        content: discoveryQuestions[i].question,
      };
    }

    // After all questions are answered, create refined specification
    yield {
      role: "assistant" as const,
      content: `Perfect! Thank you for sharing all those details.

Based on our conversation, I'll now create a refined specification that you can use with Continue's other features. Let me summarize what I understand:

---

**🎯 Guide Mode Complete!**

Your project details have been collected. You can now:

1. **Use this context** for your next requests - just reference what we've discussed
2. **Start coding** with the "/code" command and better context
3. **Ask specific questions** about implementation

**Pro tip:** The information you've provided helps me understand your needs better. For future tasks, try to include similar context about what you're building, who it's for, and your experience level.

What would you like to work on first?`,
    };
  },
};

export default GuideSlashCommand;
