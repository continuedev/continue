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
 * Week 3 Email - Sent 21 days after signup
 * Focus on best practices, community, and getting the most out of Continue
 */
export const WeekThreeEmail = ({
  firstName = "there",
  userEmail,
}: EmailTemplateProps) => {
  return (
    <Html>
      <Head />
      <Preview>Continue Pro Tips - Get the most out of your setup</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Continue Pro Tips 🎯</Heading>

          <Text style={text}>Hi {firstName},</Text>

          <Text style={text}>
            It's been three weeks with Continue! You're well on your way to
            mastering AI-powered development. Let's share some pro tips from our
            community to help you get even more value.
          </Text>

          <Section style={mediaSection}>
            <Img
              src="https://via.placeholder.com/600x300?text=Pro+Tips"
              alt="Continue Pro Tips"
              style={mediaImage}
            />
          </Section>

          <Heading style={h2}>💎 Best Practices from Power Users</Heading>

          <Section style={tipSection}>
            <Text style={tipTitle}>🎨 Optimize Your Prompts</Text>
            <Text style={text}>
              Be specific and provide context. Instead of "fix this", try "fix
              this function to handle null values and add TypeScript types". The
              more context you provide, the better the results!
            </Text>
          </Section>

          <Section style={tipSection}>
            <Text style={tipTitle}>📁 Use Codebase Context</Text>
            <Text style={text}>
              Add <code style={code}>@codebase</code> to your prompts when
              asking questions that require understanding your entire project.
              Continue will search your codebase and provide more accurate
              answers.
            </Text>
          </Section>

          <Section style={tipSection}>
            <Text style={tipTitle}>⚙️ Customize for Your Stack</Text>
            <Text style={text}>
              Add custom rules in your <code style={code}>.continuerules</code>{" "}
              file to guide Continue's behavior. Include your coding standards,
              preferred libraries, and architectural patterns.
            </Text>
          </Section>

          <Section style={tipSection}>
            <Text style={tipTitle}>🔄 Iterate and Refine</Text>
            <Text style={text}>
              Don't accept the first suggestion blindly. Ask Continue to refine,
              explain, or try a different approach. It's like having a
              conversation with a very knowledgeable colleague!
            </Text>
          </Section>

          <Hr style={hr} />

          <Heading style={h2}>🌟 Join the Community</Heading>

          <Text style={text}>
            Continue is better with a community! Join thousands of developers
            sharing tips, showcasing workflows, and helping each other succeed.
          </Text>

          <Section style={buttonSection}>
            <Button style={button} href="https://discord.gg/continue">
              Join Discord
            </Button>
            <Button
              style={secondaryButton}
              href="https://github.com/continuedev/continue"
            >
              Star on GitHub
            </Button>
          </Section>

          <Hr style={hr} />

          <Text style={text}>
            <strong>📚 Resources to Explore:</strong>
          </Text>

          <ul style={list}>
            <li style={listItem}>
              <Link href="https://docs.continue.dev" style={link}>
                Complete Documentation
              </Link>
            </li>
            <li style={listItem}>
              <Link href="https://continue.dev/blog" style={link}>
                Blog - Tips, Updates & Tutorials
              </Link>
            </li>
            <li style={listItem}>
              <Link
                href="https://github.com/continuedev/continue/discussions"
                style={link}
              >
                GitHub Discussions
              </Link>
            </li>
          </ul>

          <Text style={text}>
            Thank you for being part of the Continue journey. We're excited to
            see what you'll build! 🚀
          </Text>

          <Text style={footer}>
            This is the last email in our onboarding series, but we're always
            here to help. Reach out anytime!
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

export default WeekThreeEmail;

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

const tipSection = {
  margin: "24px 0",
};

const tipTitle = {
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
  margin: "0 8px 8px 8px",
};

const secondaryButton = {
  backgroundColor: "#6c757d",
  borderRadius: "5px",
  color: "#fff",
  fontSize: "16px",
  fontWeight: "bold",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "12px 24px",
  margin: "0 8px 8px 8px",
};

const list = {
  margin: "16px 0",
  padding: "0 60px",
};

const listItem = {
  margin: "8px 0",
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
