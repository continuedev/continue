import { Box, Text, useInput } from "ink";
import React, { useEffect, useState } from "react";
import { loadAuthConfig, listUserOrganizations } from "../auth/workos.js";

interface Organization {
  id: string;
  name: string;
}

interface OrganizationSelectorProps {
  onSelect: (organizationId: string | null, organizationName: string) => void;
  onCancel: () => void;
}

const OrganizationSelector: React.FC<OrganizationSelectorProps> = ({
  onSelect,
  onCancel,
}) => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentOrgId, setCurrentOrgId] = useState<string | null | undefined>();

  useEffect(() => {
    const loadOrganizations = async () => {
      try {
        const authConfig = loadAuthConfig();
        setCurrentOrgId(authConfig.organizationId);
        
        const organizations = await listUserOrganizations();
        if (organizations === null) {
          setError("Failed to load organizations");
          setLoading(false);
          return;
        }

        setOrganizations(organizations);
        setLoading(false);
      } catch (err: any) {
        setError(err.message || "Failed to load organizations");
        setLoading(false);
      }
    };

    loadOrganizations();
  }, []);

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    if (key.return) {
      const totalOptions = organizations.length + 1; // +1 for personal
      if (selectedIndex === 0) {
        onSelect(null, "Personal");
      } else if (selectedIndex <= organizations.length) {
        const selectedOrg = organizations[selectedIndex - 1];
        onSelect(selectedOrg.id, selectedOrg.name);
      }
      return;
    }

    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      const totalOptions = organizations.length + 1; // +1 for personal
      setSelectedIndex((prev) => Math.min(totalOptions - 1, prev + 1));
    }
  });

  if (loading) {
    return (
      <Box
        flexDirection="column"
        padding={1}
        borderStyle="round"
        borderColor="blue"
      >
        <Text color="blue" bold>
          Organization Selector
        </Text>
        <Text color="gray">Loading organizations...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        flexDirection="column"
        padding={1}
        borderStyle="round"
        borderColor="red"
      >
        <Text color="red" bold>
          Error
        </Text>
        <Text color="red">{error}</Text>
        <Text color="gray" dimColor>
          Press Escape to cancel
        </Text>
      </Box>
    );
  }

  const allOptions = [
    { id: null, name: "Personal", isCurrent: currentOrgId === null },
    ...organizations.map((org) => ({
      ...org,
      isCurrent: currentOrgId === org.id,
    })),
  ];

  return (
    <Box
      flexDirection="column"
      padding={1}
      borderStyle="round"
      borderColor="blue"
    >
      <Text color="blue" bold>
        Select Organization
      </Text>
      <Box flexDirection="column" marginTop={1}>
        {allOptions.map((option, index) => {
          const isSelected = index === selectedIndex;
          const isCurrent = option.isCurrent;
          
          return (
            <Box key={option.id || "personal"}>
              <Text
                color={isSelected ? "blue" : "white"}
                bold={isSelected}
                inverse={isSelected}
              >
                {isSelected ? "▶ " : "  "}
                {option.name}
                {isCurrent ? " (current)" : ""}
              </Text>
            </Box>
          );
        })}
      </Box>
      <Box marginTop={1}>
        <Text color="gray" dimColor>
          Use ↑/↓ to navigate, Enter to select, Escape to cancel
        </Text>
      </Box>
    </Box>
  );
};

export default OrganizationSelector;