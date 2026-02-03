import {
  ProfileDescription,
  SerializedOrgWithProfiles,
} from "core/config/ProfileLifecycleManager";
import { ControlPlaneSessionInfo } from "core/control-plane/AuthTypes";
import React, { createContext, useContext } from "react";

interface AuthContextType {
  session: ControlPlaneSessionInfo | undefined;
  logout: () => void;
  login: (useOnboarding: boolean) => Promise<boolean>;
  selectedProfile: ProfileDescription | null;
  profiles: ProfileDescription[] | null;
  refreshProfiles: (reason?: string) => Promise<void>;
  organizations: SerializedOrgWithProfiles[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const NOOP_ORG: SerializedOrgWithProfiles = {
  id: "personal",
  name: "Personal",
  slug: "personal",
  iconUrl: "",
  profiles: [],
  selectedProfileId: null,
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return (
    <AuthContext.Provider
      value={{
        session: undefined,

        login: async () => true,
        logout: () => {},

        selectedProfile: null,
        profiles: NOOP_ORG.profiles,

        refreshProfiles: async () => {},

        organizations: [NOOP_ORG],
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
