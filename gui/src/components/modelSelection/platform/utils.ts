import { ProfileDescription } from "core/config/ProfileLifecycleManager";
import { isLocalProfile } from "../../../util";

export function getProfileDisplayText(profile: ProfileDescription): string {
  return isLocalProfile(profile) ? profile.title : profile.fullSlug.packageSlug;
}
