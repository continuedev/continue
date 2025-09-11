import { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import { table } from "table";
import { lightGray, vscBackground, vscInputBackground } from "../components";
import { CopyIconButton } from "../components/gui/CopyIconButton";
import { PageHeader } from "../components/PageHeader";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { useNavigationListener } from "../hooks/useNavigationListener";

const Th = styled.th`
  padding: 0.5rem;
  text-align: left;
  border: 1px solid ${lightGray};
`;

const Tr = styled.tr`
  &:hover {
    background-color: ${vscInputBackground};
  }

  overflow-wrap: anywhere;

  border: 1px solid ${lightGray};
`;

const Td = styled.td`
  padding: 0.5rem;
  border: 1px solid ${lightGray};
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
    <div
      style={{
        backgroundColor: vscBackground,
      }}
    >
      <PageHeader title="More" onTitleClick={() => navigate(-1)} showBorder />

      <div className="p-2">
        <div className="flex items-center gap-2">
          <h2 className="ml-2">Tokens per Day</h2>
          <CopyIconButton
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
                <Td>{day.generatedTokens.toLocaleString()}</Td>
                <Td>{day.promptTokens.toLocaleString()}</Td>
              </Tr>
            ))}
          </tbody>
        </table>

        <div className="flex items-center gap-2">
          <h2 className="ml-2">Tokens per Model</h2>
          <CopyIconButton
            text={generateTable(
              ([["Model", "Generated Tokens", "Prompt Tokens"]] as any).concat(
                models.map((model) => [
                  model.model,
                  model.generatedTokens.toLocaleString(),
                  model.promptTokens.toLocaleString(),
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
                <Td>{model.generatedTokens.toLocaleString()}</Td>
                <Td>{model.promptTokens.toLocaleString()}</Td>
              </Tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Stats;
