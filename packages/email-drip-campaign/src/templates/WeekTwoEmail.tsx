import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";
import type { EmailTemplateProps } from "../types";

/**
 * Week 2 Email - Sent 14 days after signup
 * Focus on advanced features and workflow optimization
 */
export const WeekTwoEmail = ({
  firstName = "there",
  userEmail,
}: EmailTemplateProps) => {
  return (
    <Html>
      <Head />
      <Preview>
        Supercharge your workflow with Continue's advanced features
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Supercharge Your Workflow ⚡</Heading>

          <Text style={text}>Hi {firstName},</Text>

          <Text style={text}>
            You've been using Continue for two weeks now! Let's explore some
            advanced features that can take your productivity to the next level.
          </Text>

          <Section style={mediaSection}>
            <Img
              src="https://via.placeholder.com/600x300?text=Advanced+Features"
              alt="Continue Advanced Features"
              style={mediaImage}
            />
          </Section>

          <Heading style={h2}>🔥 Power User Features</Heading>

          <Section style={featureSection}>
            <Text style={featureTitle}>Custom Slash Commands</Text>
            <Text style={text}>
              Create custom commands for your repetitive tasks. Type{" "}
              <code style={code}>/</code> in the chat to see available commands.
              Want to add your own? Check out our{" "}
              <Link
                href="https://docs.continue.dev/customization/slash-commands"
                style={link}
              >
                slash commands guide
              </Link>
              .
            </Text>
          </Section>

          <Section style={featureSection}>
            <Text style={featureTitle}>Context Providers</Text>
            <Text style={text}>
              Give Continue access to external context like your docs, Jira
              issues, or database schema. Use <code style={code}>@docs</code>,{" "}
              <code style={code}>@issue</code>, and more to reference external
              resources in your chat.
            </Text>
          </Section>

          <Section style={featureSection}>
            <Text style={featureTitle}>Multiple Model Configuration</Text>
            <Text style={text}>
              Use different models for different tasks - a fast model for
              autocomplete, a powerful one for complex edits. Customize your
              setup in the Continue config file.
            </Text>
          </Section>

          <Section style={buttonSection}>
            <Button
              style={button}
              href="https://docs.continue.dev/customization/overview"
            >
              Learn About Customization
            </Button>
          </Section>

          <Hr style={hr} />

          <Text style={text}>
            <strong>🎓 Quick Tutorial:</strong> Try this in your next coding
            session:
          </Text>

          <ol style={list}>
            <li style={listItem}>
              Open a file with a function you want to improve
            </li>
            <li style={listItem}>
              Highlight the function and press{" "}
              <code style={code}>Cmd/Ctrl + I</code>
            </li>
            <li style={listItem}>
              Type: "Add JSDoc comments and improve error handling"
            </li>
            <li style={listItem}>Review and accept the changes</li>
          </ol>

          <Text style={footer}>
            Want to share feedback or request features? We'd love to hear from
            you on{" "}
            <Link href="https://discord.gg/continue" style={link}>
              Discord
            </Link>{" "}
            or{" "}
            <Link href="https://github.com/continuedev/continue" style={link}>
              GitHub
            </Link>
            .
          </Text>

          <Text style={footer}>
            <Link href={`{{unsubscribeUrl}}`} style={link}>
              Unsubscribe
            </Link>{" "}
            from these emails
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export default WeekTwoEmail;

// Styles
const main = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "20px 0 48px",
  marginBottom: "64px",
  maxWidth: "600px",
};

const h1 = {
  color: "#333",
  fontSize: "24px",
  fontWeight: "bold",
  margin: "40px 0 20px",
  padding: "0 40px",
};

const h2 = {
  color: "#333",
  fontSize: "20px",
  fontWeight: "bold",
  margin: "32px 0 16px",
  padding: "0 40px",
};

const text = {
  color: "#333",
  fontSize: "16px",
  lineHeight: "26px",
  margin: "16px 0",
  padding: "0 40px",
};

const mediaSection = {
  padding: "20px 40px",
};

const mediaImage = {
  width: "100%",
  maxWidth: "520px",
  height: "auto",
  borderRadius: "8px",
};

const featureSection = {
  margin: "24px 0",
};

const featureTitle = {
  color: "#333",
  fontSize: "18px",
  fontWeight: "600",
  margin: "16px 0 8px",
  padding: "0 40px",
};

const code = {
  backgroundColor: "#f4f4f4",
  padding: "2px 6px",
  borderRadius: "3px",
  fontFamily: "monospace",
  fontSize: "14px",
};

const buttonSection = {
  padding: "20px 40px",
  textAlign: "center" as const,
};

const button = {
  backgroundColor: "#007bff",
  borderRadius: "5px",
  color: "#fff",
  fontSize: "16px",
  fontWeight: "bold",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "12px 24px",
};

const list = {
  margin: "16px 0",
  padding: "0 60px",
};

const listItem = {
  margin: "12px 0",
  fontSize: "16px",
  lineHeight: "26px",
  color: "#333",
};

const hr = {
  borderColor: "#e6ebf1",
  margin: "20px 40px",
};

const footer = {
  color: "#8898aa",
  fontSize: "14px",
  lineHeight: "20px",
  padding: "0 40px",
  margin: "8px 0",
};

const link = {
  color: "#007bff",
  textDecoration: "underline",
};
