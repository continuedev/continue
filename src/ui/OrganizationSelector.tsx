import React, { useEffect, useState } from "react";
import {
  getOrganizationId,
  listUserOrganizations,
  loadAuthConfig,
} from "../auth/workos.js";
import Selector, { SelectorOption } from "./Selector.js";

interface Organization extends SelectorOption {}

interface OrganizationSelectorProps {
  onSelect: (organizationId: string | null, organizationName: string) => void;
  onCancel: () => void;
}

const OrganizationSelector: React.FC<OrganizationSelectorProps> = ({
  onSelect,
  onCancel,
}) => {
  const [allOptions, setAllOptions] = useState<Organization[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentOrgId, setCurrentOrgId] = useState<string | null | undefined>();

  useEffect(() => {
    const loadOrganizations = async () => {
      try {
        const authConfig = loadAuthConfig();
        setCurrentOrgId(getOrganizationId(authConfig));

        const organizations = await listUserOrganizations();
        if (organizations === null) {
          setError("Failed to load organizations");
          setLoading(false);
          return;
        }

        const options: Organization[] = [
          { 
            id: "personal", 
            name: "Personal"
          },
          ...organizations,
        ];

        setAllOptions(options);
        setLoading(false);
      } catch (err: any) {
        setError(err.message || "Failed to load organizations");
        setLoading(false);
      }
    };

    loadOrganizations();
  }, []);

  const handleSelect = (option: Organization) => {
    if (option.id === "personal") {
      onSelect(null, "Personal");
    } else {
      onSelect(option.id, option.name);
    }
  };

  return (
    <Selector
      title="Select Organization"
      options={allOptions}
      selectedIndex={selectedIndex}
      loading={loading}
      error={error}
      loadingMessage="Loading organizations..."
      currentId={currentOrgId === null ? "personal" : currentOrgId}
      onSelect={handleSelect}
      onCancel={onCancel}
      onNavigate={setSelectedIndex}
    />
  );
};

export default OrganizationSelector;
