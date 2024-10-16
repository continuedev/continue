import { useFormContext } from "react-hook-form";
import { Input, InputSubtext } from "..";

interface BaseApiKeyProps {
  provider: {
    value: string;
    label: string;
  };
  docsUrl: string;
}

export const BaseApiKey = ({ provider, docsUrl }: BaseApiKeyProps) => {
  const formMethods = useFormContext();

  return (
    <div className="mt-4">
      <>
        <label className="block text-sm font-medium mb-1">
          {provider.label} API key
        </label>
        <Input
          id={`providerApiKeys.${provider.value}`}
          className="w-full"
          placeholder={`Enter your ${provider.label} API key`}
          {...formMethods.register(`providerApiKeys.${provider.value}`)}
        />
        <InputSubtext className="mb-0">
          <a
            href={docsUrl}
            target="_blank"
            className="text-inherit underline cursor-pointer hover:text-inherit"
          >
            Click here
          </a>{" "}
          to create an {provider.label} API key
        </InputSubtext>
      </>
    </div>
  );
};
