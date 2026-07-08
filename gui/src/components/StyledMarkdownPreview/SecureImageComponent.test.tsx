import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SecureImageComponent } from "./SecureImageComponent";

describe("SecureImageComponent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Default blocking behavior", () => {
    it("should block images by default and show warning message", () => {
      render(<SecureImageComponent src="https://example.com/image.jpg" />);

      expect(
        screen.getByText(
          /Image blocked for security.*External images can leak data/,
        ),
      ).toBeInTheDocument();
      expect(screen.getByText("Load Image")).toBeInTheDocument();
      expect(screen.queryByRole("img")).not.toBeInTheDocument();
    });

    it("should display the image URL", () => {
      const testUrl = "https://example.com/test-image.png";
      render(<SecureImageComponent src={testUrl} />);

      expect(screen.getByText(testUrl)).toBeInTheDocument();
    });

    it("should handle invalid src prop", () => {
      render(<SecureImageComponent src={undefined} />);

      expect(
        screen.getByText("[Invalid image: no source]"),
      ).toBeInTheDocument();
      expect(screen.queryByText("Load Image")).not.toBeInTheDocument();
    });
  });

  describe("Query parameter detection", () => {
    it("should detect and display query parameters", () => {
      render(
        <SecureImageComponent src="https://example.com/image.jpg?user=123&token=abc" />,
      );

      expect(
        screen.getByText(/Warning: URL contains query parameters/),
      ).toBeInTheDocument();
      expect(screen.getByText(/"user": "123"/)).toBeInTheDocument();
      expect(screen.getByText(/"token": "abc"/)).toBeInTheDocument();
    });

    it("should not show query parameter warning for URLs without parameters", () => {
      render(<SecureImageComponent src="https://example.com/image.jpg" />);

      expect(
        screen.queryByText(/Warning: URL contains query parameters/),
      ).not.toBeInTheDocument();
    });

    it("should handle relative URLs with query parameters", () => {
      render(
        <SecureImageComponent src="/images/test.jpg?id=456&session=xyz" />,
      );

      expect(
        screen.getByText(/Warning: URL contains query parameters/),
      ).toBeInTheDocument();
      expect(screen.getByText(/"id": "456"/)).toBeInTheDocument();
      expect(screen.getByText(/"session": "xyz"/)).toBeInTheDocument();
    });

    it("should handle malformed URLs gracefully", () => {
      render(<SecureImageComponent src="not-a-valid-url://image" />);

      // Should still display the URL even if it can't be parsed
      expect(screen.getByText("not-a-valid-url://image")).toBeInTheDocument();
      expect(screen.getByText("Load Image")).toBeInTheDocument();
    });
  });

  describe("User interaction", () => {
    it("should show image when Load Image button is clicked", () => {
      const testUrl = "https://example.com/image.jpg";
      render(<SecureImageComponent src={testUrl} alt="Test image" />);

      // Initially no image
      expect(screen.queryByRole("img")).not.toBeInTheDocument();

      // Click load button
      const loadButton = screen.getByText("Load Image");
      fireEvent.click(loadButton);

      // Image should now be displayed (query by tag since it might be role="presentation")
      const image = screen.getByAltText("Test image");
      expect(image).toBeInTheDocument();
      expect(image).toHaveAttribute("src", testUrl);
      expect(image).toHaveAttribute("alt", "Test image");

      // Warning message should be gone
      expect(
        screen.queryByText(
          /Image blocked for security.*External images can leak data/,
        ),
      ).not.toBeInTheDocument();
    });

    it("should handle image load errors", async () => {
      const testUrl = "https://example.com/broken-image.jpg";
      render(<SecureImageComponent src={testUrl} alt="broken image" />);

      // Click load button
      const loadButton = screen.getByText("Load Image");
      fireEvent.click(loadButton);

      // Simulate image error (query by alt text since role might be presentation)
      const image = screen.getByAltText("broken image");
      fireEvent.error(image);

      // Should show error message and hide image
      await waitFor(() => {
        expect(screen.getByText(/Failed to load image/)).toBeInTheDocument();
        expect(screen.queryByAltText("broken image")).not.toBeInTheDocument();
      });

      // Load button should be available again
      expect(screen.getByText("Load Image")).toBeInTheDocument();
    });

    it("should pass through title and className props", () => {
      render(
        <SecureImageComponent
          src="https://example.com/image.jpg"
          alt="test image"
          title="Image title"
          className="custom-class"
        />,
      );

      // Click load button
      fireEvent.click(screen.getByText("Load Image"));

      // Check image has title (query by alt text)
      const image = screen.getByAltText("test image");
      expect(image).toHaveAttribute("title", "Image title");

      // Check container has className
      const container = image.parentElement;
      expect(container).toHaveClass("custom-class");
    });
  });

  describe("Security features", () => {
    it("should display query parameters as JSON for transparency", () => {
      render(
        <SecureImageComponent src="https://malicious.com/track.gif?email=user@example.com&id=12345&action=view" />,
      );

      // Should show all parameters clearly
      expect(
        screen.getByText(/Warning: URL contains query parameters/),
      ).toBeInTheDocument();

      // Check JSON is properly formatted
      const preElement = screen.getByText(/"email": "user@example.com"/);
      expect(preElement).toBeInTheDocument();
      expect(screen.getByText(/"id": "12345"/)).toBeInTheDocument();
      expect(screen.getByText(/"action": "view"/)).toBeInTheDocument();
    });

    it("should handle encoded query parameters", () => {
      render(
        <SecureImageComponent src="https://example.com/img.png?data=%7B%22user%22%3A%22test%22%7D" />,
      );

      // Should decode and display the parameter
      expect(
        screen.getByText(/Warning: URL contains query parameters/),
      ).toBeInTheDocument();
      // The decoded value should be shown in the pre element
      const preElement = document.querySelector("pre");
      expect(preElement).toBeTruthy();
      // Check that the JSON contains the decoded data
      expect(preElement?.textContent).toContain('"data"');
      // The value is decoded as a string containing JSON
      expect(preElement?.textContent).toContain('"{');
      expect(preElement?.textContent).toContain("user");
      expect(preElement?.textContent).toContain("test");
    });
  });

  describe("Alt text handling", () => {
    it("should use empty string for alt when not provided", () => {
      render(<SecureImageComponent src="https://example.com/image.jpg" />);

      fireEvent.click(screen.getByText("Load Image"));

      // Query by tag name since empty alt makes it role="presentation"
      const images = document.querySelectorAll("img");
      expect(images.length).toBe(1);
      expect(images[0]).toHaveAttribute("alt", "");
    });

    it("should use provided alt text", () => {
      render(
        <SecureImageComponent
          src="https://example.com/image.jpg"
          alt="Description of image"
        />,
      );

      fireEvent.click(screen.getByText("Load Image"));

      const image = screen.getByAltText("Description of image");
      expect(image).toHaveAttribute("alt", "Description of image");
    });
  });
});
