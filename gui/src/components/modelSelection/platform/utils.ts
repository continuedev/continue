import { ProfileDescription } from "core/config/ProfileLifecycleManager";

export function getProfileDisplayText(profile: ProfileDescription): string {
  return profile.title;
}
