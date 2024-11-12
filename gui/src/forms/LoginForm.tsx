
import { useContext, useEffect, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { useDispatch } from "react-redux";
import { Button, Input } from "../components";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { useAuth } from "../hooks/useAuth";
import Base64 from "../util/base64";

interface QuickModelSetupProps {
  onDone: () => void;
  hideFreeTrialLimitMessage?: boolean;
}

const MODEL_PROVIDERS_URL =
  "https://docs.continue.dev/customize/model-providers";
const CODESTRAL_URL = "https://console.mistral.ai/codestral";
const CONTINUE_SETUP_URL = "https://docs.continue.dev/setup/overview";

function LoginForm({
  onDone,
  hideFreeTrialLimitMessage,
}: QuickModelSetupProps) {

  const formMethods = useForm();
  const dispatch = useDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const username = formMethods.watch("username");
  const password = formMethods.watch("password");
  const [errorMsg, setErrorMsg] = useState('')
  function isDisabled() {
    return !username || !password;
  }


  async function onSubmit() {
    // let response = await fetch(`http://10.8.132.139:8086/prod-api/captchaImage`, {
    //   method: "GET",
    //   mode: 'no-cors'
    // });
    // base64 密码加密
    const pwd = Base64.encode(password);
    let response = await fetch(`http://api.lingxi.eastcom-sw.com/lingxi/apiKey/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password: pwd }),
    });
    if (!response.ok) {
      setErrorMsg(JSON.stringify(response))
    } else {
      const res = await response.json();
      if(res?.code == 200) {
        ideMessenger.post("setControlPlaneSessionInfo", {
          accessToken: res.data?.accessToken || username,
          account: {
            id: username,
            label: username,
          },
        });
        ideMessenger.post("config/reload", undefined)
        onDone();
      } else {
        setErrorMsg(res?.msg)
      }
    }

    // ideMessenger.post("config/addModel", { model });
    // ideMessenger.post("openConfigJson", undefined);

    // dispatch(setDefaultModel({ title: model.title, force: true }));

  }

  return (
    <FormProvider {...formMethods}>
      <form onSubmit={formMethods.handleSubmit(onSubmit)}>
        <div className="mx-auto max-w-md p-6">
          <h1 className="mb-0 text-center text-2xl">登录</h1>

          <div className="my-8 flex flex-col gap-6">

            <div>
              <>
                <label className="mb-1 block text-sm font-medium">
                  用户名
                </label>
                <Input
                  id="username"
                  className="w-full"
                  placeholder={`请输入用户名`}
                  {...formMethods.register("username")}
                />
                {/* <InputSubtext className="mb-0">
                    <a
                      className="cursor-pointer text-inherit underline hover:text-inherit"
                      onClick={() =>
                        ideMessenger.post("openUrl", selectedProviderApiKeyUrl)
                      }
                    >
                      Click here
                    </a>{" "}
                    to create a {selectedProvider.title} API key
                  </InputSubtext> */}
              </>
              <>
                <label className="mb-1 mt-8 block text-sm font-medium">
                  密码
                </label>
                <Input
                  id="password"
                  className="w-full"
                  type="password"
                  placeholder={`请输入密码`}
                  {...formMethods.register("password")}
                />
              </>
            </div>

          </div>
          {errorMsg && <div className=" w-full text-red-500"> {errorMsg}</div>}
          <div className="mt-4 w-full">
            <Button type="submit" className="w-full"
              disabled={isDisabled()}
            >
              登录
            </Button>
            {/* <AddModelButtonSubtext /> */}
          </div>
        </div>
      </form>
    </FormProvider>
  );
}

export default LoginForm;
