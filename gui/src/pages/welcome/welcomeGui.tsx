import { useContext, useEffect, useMemo, useState } from "react";
import Features from "./Features";
import ImportExtensions from "./ImportExtensions";
import AddToPath from "./AddToPath";
import FinalStep from "./FinalStep";
import { IdeMessengerContext } from "@/context/IdeMessenger";

export default function Welcome() {
  const ideMessenger = useContext(IdeMessengerContext);
  const [step, setStep] = useState(0);

  useEffect(() => {
    // Lock the overlay when welcome page mounts
    ideMessenger.post("lockOverlay", undefined);

    // Cleanup - unlock when component unmounts
    return () => {
      ideMessenger.post("unlockOverlay", undefined);
    };
  }, []);

  useEffect(() => {
    if (step === 4) {
      ideMessenger.post("unlockOverlay", undefined);
    }
  }, [step]);

  const [isUserSignedIn, setIsUserSignedIn] = useState(false);

  useEffect(() => {
    const checkUserSignInStatus = async () => {
      try {
        const res = await ideMessenger.request("getPearAuth", undefined);
        const signedIn = res?.accessToken ? true : false;
        setIsUserSignedIn(signedIn);
        console.dir("User signed in:");
        console.dir(signedIn);
      } catch (error) {
        console.error("Error checking user sign-in status:", error);
      }
    };

    checkUserSignInStatus();
  }, [ideMessenger]); // Dependency array ensures this runs once when the component mounts

  const handleNextStep = () => {
    setStep((prevStep) => Math.min(prevStep + 1, 4));
  };

  const handleBackStep = () => {
    setStep((prevStep) => Math.max(prevStep - 1, 0));
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return <Features onNext={handleNextStep} />;
      case 1:
        return (
          <ImportExtensions onNext={handleNextStep} onBack={handleBackStep} />
        );
      case 2:
        return <AddToPath onNext={handleNextStep} onBack={handleBackStep} />;
      case 3:
        if (!isUserSignedIn) {
          return <SignIn onNext={handleNextStep} onBack={handleBackStep} />;
        }
        return <FinalStep onBack={handleBackStep} />;
      case 4:
        return <FinalStep onBack={handleBackStep} />;
      default:
        return null;
    }
  };

  return <div className="flex flex-col space-y-4">{renderStep()}</div>;
}
import SignIn from "./SignIn";
