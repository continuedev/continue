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
 * Week 1 Email - Sent 7 days after signup
 * Focus on key features and getting users comfortable with the basics
 */
export const WeekOneEmail = ({
  firstName = "there",
  userEmail,
}: EmailTemplateProps) => {
  return (
    <Html>
      <Head />
      <Preview>Your first week with Continue - Key features to explore</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Your First Week with Continue 🚀</Heading>

          <Text style={text}>Hi {firstName},</Text>

          <Text style={text}>
            It's been a week since you joined Continue! We hope you've had a
            chance to explore. Let's dive into some key features that can
            transform your coding workflow.
          </Text>

          <Section style={mediaSection}>
            <Img
              src="https://via.placeholder.com/600x300?text=Key+Features"
              alt="Continue Key Features"
              style={mediaImage}
            />
          </Section>

          <Heading style={h2}>🎯 Feature Spotlight</Heading>

          <Section style={featureSection}>
            <Text style={featureTitle}>1. Chat with Your Codebase</Text>
            <Text style={text}>
              Press <code style={code}>Cmd/Ctrl + L</code> to open the Continue
              sidebar. Ask questions like "How does authentication work?" or
              "Where is the user model defined?" and get instant answers.
            </Text>
          </Section>

          <Section style={featureSection}>
            <Text style={featureTitle}>2. Inline Editing</Text>
            <Text style={text}>
              Highlight code and press <code style={code}>Cmd/Ctrl + I</code> to
              edit with AI. Try "Add error handling" or "Convert to async/await"
              - it's like pair programming with an AI!
            </Text>
          </Section>

          <Section style={featureSection}>
            <Text style={featureTitle}>3. Smart Autocomplete</Text>
            <Text style={text}>
              Continue's autocomplete goes beyond basic suggestions. It
              understands your coding patterns and suggests entire code blocks.
              Just start typing and watch the magic happen!
            </Text>
          </Section>

          <Section style={buttonSection}>
            <Button style={button} href="https://docs.continue.dev/features">
              Explore All Features
            </Button>
          </Section>

          <Hr style={hr} />

          <Text style={text}>
            <strong>💡 Pro Tip:</strong> Use the <code style={code}>@</code>{" "}
            symbol in chat to reference specific files, folders, or
            documentation. Try "@docs explain how to configure models".
          </Text>

          <Text style={footer}>
            Having trouble? Check out our{" "}
            <Link href="https://docs.continue.dev" style={link}>
              documentation
            </Link>{" "}
            or join our{" "}
            <Link href="https://discord.gg/continue" style={link}>
              Discord community
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

export default WeekOneEmail;

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
