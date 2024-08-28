import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import { table } from "table";
import { lightGray, vscBackground, vscInputBackground } from "../components";
import { CopyButton } from "../components/markdown/CopyButton";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { useNavigationListener } from "../hooks/useNavigationListener";

const Th = styled.th`
  padding: 0.5rem;
  text-align: left;
  border: 1px solid ${vscInputBackground};
`;

const Tr = styled.tr`
  &:hover {
    background-color: ${vscInputBackground};
  }

  overflow-wrap: anywhere;

  border: 1px solid ${vscInputBackground};
`;

const Td = styled.td`
  padding: 0.5rem;
  border: 1px solid ${vscInputBackground};
`;

function generateTable(data: unknown[][]) {
  return table(data);
}

function Stats() {
  useNavigationListener();
  const navigate = useNavigate();
  const ideMessenger = useContext(IdeMessengerContext);

  const [days, setDays] = useState<
    { day: string; promptTokens: number; generatedTokens: number }[]
  >([]);
  const [models, setModels] = useState<
    { model: string; promptTokens: number; generatedTokens: number }[]
  >([]);

  useEffect(() => {
    ideMessenger.request("stats/getTokensPerDay", undefined).then((result) => {
      result.status === "success" && setDays(result.content);
    });
  }, []);

  useEffect(() => {
    ideMessenger
      .request("stats/getTokensPerModel", undefined)
      .then((result) => {
        result.status === "success" && setModels(result.content);
      });
  }, []);

  return (
    <div>
      <div
        className="items-center flex m-0 p-0 sticky top-0"
        style={{
          borderBottom: `0.5px solid ${lightGray}`,
          backgroundColor: vscBackground,
        }}
      >
        <ArrowLeftIcon
          width="1.2em"
          height="1.2em"
          onClick={() => navigate(-1)}
          className="inline-block ml-4 cursor-pointer"
        />
        <h3 className="text-lg font-bold m-2 inline-block">My Usage</h3>
      </div>

      <div className="flex gap-2 items-center">
        <h2 className="ml-2">Tokens per Day</h2>
        <CopyButton
          text={generateTable(
            ([["Day", "Generated Tokens", "Prompt Tokens"]] as any).concat(
              days.map((day) => [
                day.day,
                day.generatedTokens,
                day.promptTokens,
              ]),
            ),
          )}
        />
      </div>
      <table className="w-full border-collapse">
        <thead>
          <Tr>
            <Th>Day</Th>
            <Th>Generated Tokens</Th>
            <Th>Prompt Tokens</Th>
          </Tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <Tr key={day.day} className="">
              <Td>{day.day}</Td>
              <Td>{day.generatedTokens}</Td>
              <Td>{day.promptTokens}</Td>
            </Tr>
          ))}
        </tbody>
      </table>

      <div className="flex gap-2 items-center">
        <h2 className="ml-2">Tokens per Model</h2>
        <CopyButton
          text={generateTable(
            ([["Model", "Generated Tokens", "Prompt Tokens"]] as any).concat(
              models.map((model) => [
                model.model,
                model.generatedTokens,
                model.promptTokens,
              ]),
            ),
          )}
        />
      </div>
      <table className="w-full border-collapse">
        <thead>
          <Tr>
            <Th>Model</Th>
            <Th>Generated Tokens</Th>
            <Th>Prompt Tokens</Th>
          </Tr>
        </thead>
        <tbody>
          {models.map((model) => (
            <Tr key={model.model} className="">
              <Td>{model.model}</Td>
              <Td>{model.generatedTokens}</Td>
              <Td>{model.promptTokens}</Td>
            </Tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Stats;
