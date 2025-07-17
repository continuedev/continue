import { WarningMessage } from "core";
import { ReactElement } from "react";
import ExpendableBox from "./ExpendableBox";

function MessageBox({
  warningMessage,
  actions,
}: {
  warningMessage: WarningMessage;
  actions?: (() => ReactElement)[];
}) {
  const warningMessageTextColor =
    warningMessage.level === "fatal" ? "text-error" : "text-warning";
  const warningMessageBorderColor =
    warningMessage.level === "fatal" ? "border-error" : "border-warning";
  return (
    <div
      className={`relative m-2 flex flex-col rounded-md border border-solid ${warningMessageBorderColor} bg-transparent p-4`}
    >
      <p className={`thread-message ${warningMessageTextColor}`}>
        <b>Warning: </b>
        {`${warningMessage.message}`}
      </p>
      {actions && (
        <div>
          <p>{`Recommended Action${actions.length > 1 ? "s" : ""}:`}</p>
          <ul>
            {actions.map((action, ind) => {
              return <li key={`warning-action-${ind}`}>{action()}</li>;
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function WarningMessageBox({
  warningMessage,
  actions,
}: {
  warningMessage: WarningMessage;
  actions?: (() => ReactElement)[];
}) {
  if (warningMessage.category === "exceeded-context-length") {
    return (
      <ExpendableBox
        children={
          <MessageBox warningMessage={warningMessage} actions={actions} />
        }
      />
    );
  }
  return <MessageBox warningMessage={warningMessage} actions={actions} />;
}
