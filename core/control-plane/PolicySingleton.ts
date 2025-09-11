import { PolicyResponse } from "./client.js";

export class PolicySingleton {
  private static instance: PolicySingleton;
  public policy: PolicyResponse | null = null;

  private constructor() {}

  public static getInstance(): PolicySingleton {
    if (!PolicySingleton.instance) {
      PolicySingleton.instance = new PolicySingleton();
    }
    return PolicySingleton.instance;
  }
}
