import { useRouteError } from "react-router-dom";

export default function ErrorPage() {
  const error: any = useRouteError();
  console.error(error);

  return (
    <div id="error-page" className="text-center">
      <h1>Error in Continue React App</h1>
      <p>
        <i>{error.statusText || error.message}</i>
      </p>
      <br />
      <pre className="text-left m-4">{error.stack}</pre>
    </div>
  );
}
