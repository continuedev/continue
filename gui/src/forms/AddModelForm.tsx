import {
  ArrowTopRightOnSquareIcon,
  PlusCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { useContext } from "react";
import { FormProvider, useFieldArray, useForm } from "react-hook-form";
import {
  Button,
  GhostButton,
  Input,
  SecondaryButton,
  StyledActionButton,
} from "../components";
import AddModelButtonSubtext from "../components/AddModelButtonSubtext";
import Alert from "../components/gui/Alert";
import ModelSelectionListbox from "../components/modelSelection/ModelSelectionListbox";
import { useAuth } from "../context/Auth";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { completionParamsInputs } from "../pages/AddNewModel/configs/completionParamsInputs";
import { DisplayInfo } from "../pages/AddNewModel/configs/models";
import {
  ProviderInfo,
  providers,
} from "../pages/AddNewModel/configs/providers";
import { useAppDispatch } from "../redux/hooks";
import { updateSelectedModelByRole } from "../redux/thunks";
import { FREE_TRIAL_LIMIT_REQUESTS, hasPassedFTL } from "../util/freeTrial";

interface QuickModelSetupProps {
  onDone?: () => void;
  onSubmit?: (models: any[]) => void;
  hideFreeTrialLimitMessage?: boolean;
}

const MODEL_PROVIDERS_URL =
  "https://docs.continue.dev/customize/model-providers";
const CODESTRAL_URL = "https://console.mistral.ai/codestral";
const CONTINUE_SETUP_URL = "https://docs.continue.dev/setup/overview";

interface ProviderFormData {
  provider: ProviderInfo;
  apiKey?: string;
  selectedModels: string[];
  [key: string]: any;
}

interface FormData {
  providers: ProviderFormData[];
}

export function AddModelForm({
  onDone,
  onSubmit: onSubmitProp,
  hideFreeTrialLimitMessage,
}: QuickModelSetupProps) {
  const dispatch = useAppDispatch();
  const { selectedProfile } = useAuth();

  const formMethods = useForm<FormData>({
    defaultValues: {
      providers: [
        {
          provider: providers["openai"]!,
          selectedModels: [],
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: formMethods.control,
    name: "providers",
  });

  const ideMessenger = useContext(IdeMessengerContext);

  const popularProviderTitles = [
    providers["openai"]?.title || "",
    providers["anthropic"]?.title || "",
    providers["mistral"]?.title || "",
    providers["gemini"]?.title || "",
    providers["azure"]?.title || "",
    providers["ollama"]?.title || "",
    providers["deepseek"]?.title || "",
  ];

  const allProviders = Object.entries(providers)
    .filter(([key]) => !["freetrial", "openai-aiohttp"].includes(key))
    .map(([, provider]) => provider)
    .filter((provider) => !!provider)
    .map((provider) => provider!);

  const popularProviders = allProviders
    .filter((provider) => popularProviderTitles.includes(provider.title))
    .sort((a, b) => a.title.localeCompare(b.title));

  const otherProviders = allProviders
    .filter((provider) => !popularProviderTitles.includes(provider.title))
    .sort((a, b) => a.title.localeCompare(b.title));

  function isDisabled() {
    const providersData = formMethods.watch("providers");

    for (let i = 0; i < providersData.length; i++) {
      const providerData = providersData[i];
      const selectedProvider = providerData.provider;

      if (providerData.selectedModels.length === 0) {
        return true;
      }

      if (
        !selectedProvider.downloadUrl &&
        selectedProvider.provider !== "free-trial"
      ) {
        const required = selectedProvider.collectInputFor
          ?.filter((input) => input.required)
          .map((input) => {
            const value = formMethods.watch(`providers.${i}.${input.key}`);
            return value;
          });

        if (
          !required?.every((value) => value !== undefined && value.length > 0)
        ) {
          return true;
        }
      }
    }

    return false;
  }

  function onSubmit() {
    const providersData = formMethods.watch("providers");
    const models: any[] = [];

    providersData.forEach((providerData) => {
      const selectedProvider = providerData.provider;

      providerData.selectedModels.forEach((modelTitle) => {
        const modelPackage = selectedProvider.packages.find(
          (pkg) => pkg.title === modelTitle,
        );

        if (modelPackage) {
          const apiKey = providerData.apiKey;
          const hasValidApiKey = apiKey !== undefined && apiKey !== "";
          const reqInputFields: Record<string, any> = {};

          for (let input of selectedProvider.collectInputFor ?? []) {
            if (input.key !== "apiKey") {
              reqInputFields[input.key] = (providerData as any)[input.key];
            }
          }

          const model = {
            ...selectedProvider.params,
            ...modelPackage.params,
            ...reqInputFields,
            provider: selectedProvider.provider,
            title: modelPackage.title,
            ...(hasValidApiKey ? { apiKey } : {}),
          };

          models.push(model);
        }
      });
    });

    if (onSubmitProp) {
      onSubmitProp(models);
    } else {
      models.forEach((model) => {
        ideMessenger.post("config/addModel", { model });
      });

      ideMessenger.post("config/openProfile", {
        profileId: "local",
      });

      if (models.length > 0) {
        void dispatch(
          updateSelectedModelByRole({
            selectedProfile,
            role: "chat",
            modelTitle: models[0].title,
          }),
        );
      }
    }

    if (onDone) {
      onDone();
    }
  }

  function addProvider() {
    append({
      provider: providers["openai"]!,
      selectedModels: [],
    });
  }

  return (
    <FormProvider {...formMethods}>
      <form onSubmit={formMethods.handleSubmit(onSubmit)}>
        <div className="mx-auto max-w-md p-6">
          <h1 className="mb-0 text-center text-2xl">Add Chat models</h1>
          {!hideFreeTrialLimitMessage && hasPassedFTL() && (
            <p className="text-sm text-gray-400">
              You've reached the free trial limit of {FREE_TRIAL_LIMIT_REQUESTS}{" "}
              free inputs. To keep using Continue, you can either use your own
              API key, or use a local LLM. To read more about the options, see
              our{" "}
              <a
                onClick={() => ideMessenger.post("openUrl", CONTINUE_SETUP_URL)}
              >
                documentation
              </a>
              .
            </p>
          )}

          <div className="mt-4 flex flex-col gap-4">
            {fields.map((field, index) => {
              const selectedProvider = formMethods.watch(
                `providers.${index}.provider`,
              );
              const selectedModels =
                formMethods.watch(`providers.${index}.selectedModels`) || [];

              const selectedProviderApiKeyUrl = selectedProvider.packages.some(
                (pkg) => pkg.params.model?.startsWith("codestral"),
              )
                ? CODESTRAL_URL
                : selectedProvider.apiKeyUrl;

              return (
                <div
                  key={field.id}
                  className="border-border rounded-lg border border-solid px-4 py-3"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <label className="text-base font-medium">
                      {selectedProvider.title} Provider
                    </label>
                    {fields.length > 1 && (
                      <GhostButton
                        onClick={() => remove(index)}
                        className="text-description-muted"
                      >
                        <XCircleIcon className="h-3 w-3" />
                      </GhostButton>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="font-medium">Provider</label>
                      <ModelSelectionListbox
                        selectedProvider={selectedProvider}
                        setSelectedProvider={(val: DisplayInfo) => {
                          const match = [
                            ...popularProviders,
                            ...otherProviders,
                          ].find((provider) => provider.title === val.title);
                          if (match) {
                            formMethods.setValue(
                              `providers.${index}.provider`,
                              match,
                            );
                            formMethods.setValue(
                              `providers.${index}.selectedModels`,
                              [],
                            );
                          }
                        }}
                        topOptions={popularProviders}
                        otherOptions={otherProviders}
                      />
                    </div>

                    {selectedProvider.downloadUrl && (
                      <div>
                        <label className="mb-1 block text-sm font-medium">
                          Install provider
                        </label>
                        <StyledActionButton
                          onClick={() => {
                            selectedProvider.downloadUrl &&
                              ideMessenger.post(
                                "openUrl",
                                selectedProvider.downloadUrl,
                              );
                          }}
                        >
                          <p className="text-sm underline">
                            {selectedProvider.downloadUrl}
                          </p>
                          <ArrowTopRightOnSquareIcon width={24} height={24} />
                        </StyledActionButton>
                      </div>
                    )}

                    {selectedProvider.packages.some((pkg) =>
                      pkg.params.model?.startsWith("codestral"),
                    ) && (
                      <div className="my-2">
                        <Alert>
                          <p className="m-0 text-sm font-bold">
                            Codestral API key
                          </p>
                          <p className="m-0 mt-1">
                            Note that codestral requires a different API key
                            from other Mistral models
                          </p>
                        </Alert>
                      </div>
                    )}

                    {selectedProvider.apiKeyUrl && (
                      <div>
                        <label className="mb-1 font-medium">API key</label>
                        <Input
                          id={`providers.${index}.apiKey`}
                          className="w-full"
                          placeholder={`Enter your ${selectedProvider.title} API key`}
                          {...formMethods.register(`providers.${index}.apiKey`)}
                        />
                        <span className="text-description-muted text-xs">
                          <a
                            className="cursor-pointer text-inherit underline hover:text-inherit hover:brightness-125"
                            onClick={() => {
                              if (selectedProviderApiKeyUrl) {
                                ideMessenger.post(
                                  "openUrl",
                                  selectedProviderApiKeyUrl,
                                );
                              }
                            }}
                          >
                            Click here
                          </a>{" "}
                          to create a {selectedProvider.title} API key
                        </span>
                      </div>
                    )}

                    {selectedProvider.collectInputFor &&
                      selectedProvider.collectInputFor
                        .filter(
                          (field) =>
                            !Object.values(completionParamsInputs).some(
                              (input) => input.key === field.key,
                            ) &&
                            field.required &&
                            field.key !== "apiKey",
                        )
                        .map((field) => (
                          <div key={field.key}>
                            <label className="mb-1 block text-sm font-medium">
                              {field.label}
                            </label>
                            <Input
                              id={`providers.${index}.${field.key}`}
                              className="w-full"
                              defaultValue={field.defaultValue}
                              placeholder={`${field.placeholder}`}
                              {...formMethods.register(
                                `providers.${index}.${field.key}`,
                              )}
                            />
                          </div>
                        ))}

                    <div>
                      <label className="font-medium">Models</label>
                      <div className="max-h-40 space-y-2 overflow-y-auto rounded border border-gray-200 py-2">
                        {selectedProvider.packages.map((model) => (
                          <div key={model.title} className="flex items-center">
                            <input
                              type="checkbox"
                              id={`providers.${index}.models.${model.title}`}
                              value={model.title}
                              checked={selectedModels.includes(model.title)}
                              onChange={(e) => {
                                const currentSelected = selectedModels;
                                if (e.target.checked) {
                                  formMethods.setValue(
                                    `providers.${index}.selectedModels`,
                                    [...currentSelected, model.title],
                                  );
                                } else {
                                  formMethods.setValue(
                                    `providers.${index}.selectedModels`,
                                    currentSelected.filter(
                                      (m) => m !== model.title,
                                    ),
                                  );
                                }
                              }}
                              className="mr-2"
                            />
                            <label
                              htmlFor={`providers.${index}.models.${model.title}`}
                              className="flex cursor-pointer items-center text-sm"
                            >
                              {window.vscMediaUrl && model.icon && (
                                <img
                                  src={`${window.vscMediaUrl}/logos/${model.icon}`}
                                  className="mr-2 h-4 w-4 object-contain object-center"
                                />
                              )}
                              {model.title}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            <SecondaryButton onClick={addProvider} type="button">
              <PlusCircleIcon className="mr-2 h-3 w-3" />
              Add another provider
            </SecondaryButton>
          </div>

          <div className="mt-4 w-full">
            <Button type="submit" className="w-full" disabled={isDisabled()}>
              Connect
            </Button>
            <AddModelButtonSubtext />
          </div>
        </div>
      </form>
    </FormProvider>
  );
}
