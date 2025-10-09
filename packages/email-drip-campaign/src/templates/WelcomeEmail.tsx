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
 * Welcome Email - Sent immediately upon signup
 * This email welcomes new users and helps them get started with Continue
 */
export const WelcomeEmail = ({
  firstName = "there",
  userEmail,
}: EmailTemplateProps) => {
  return (
    <Html>
      <Head />
      <Preview>Welcome to Continue - Let's get you set up!</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Welcome to Continue, {firstName}! 🎉</Heading>

          <Text style={text}>
            We're thrilled to have you on board! Continue is here to supercharge
            your coding workflow with AI-powered assistance right in your IDE.
          </Text>

          <Section style={mediaSection}>
            {/* Placeholder for GIF/video - Replace with actual media URL */}
            <Img
              src="https://via.placeholder.com/600x300?text=Welcome+to+Continue"
              alt="Welcome to Continue"
              style={mediaImage}
            />
          </Section>

          <Section style={buttonSection}>
            <Button style={button} href="https://docs.continue.dev/quickstart">
              Get Started Now
            </Button>
          </Section>

          <Text style={text}>
            <strong>Here's what you can do with Continue:</strong>
          </Text>

          <ul style={list}>
            <li style={listItem}>
              💬 <strong>Chat with your codebase</strong> - Ask questions about
              your code and get instant answers
            </li>
            <li style={listItem}>
              ✨ <strong>Autocomplete on steroids</strong> - Get intelligent
              code suggestions as you type
            </li>
            <li style={listItem}>
              🔧 <strong>Edit with AI</strong> - Refactor, fix bugs, and write
              tests with natural language
            </li>
            <li style={listItem}>
              📚 <strong>Context-aware assistance</strong> - Continue
              understands your entire project
            </li>
          </ul>

          <Hr style={hr} />

          <Text style={text}>
            Over the next few weeks, we'll send you tips and tricks to help you
            get the most out of Continue. Stay tuned!
          </Text>

          <Text style={footer}>
            Questions? Reply to this email or check out our{" "}
            <Link href="https://docs.continue.dev" style={link}>
              documentation
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

export default WelcomeEmail;

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
  padding: "0 40px",
  listStyleType: "none",
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
