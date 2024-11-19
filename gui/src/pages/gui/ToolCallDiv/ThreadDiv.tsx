import styled from "styled-components";
import { lightGray, vscBackground } from "../../../components";

interface ThreadDivProps {
  children: React.ReactNode;
  icon: React.ReactNode;
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  position: relative;
  border-left: 1px solid ${lightGray};
  padding-left: 16px;
  margin-left: 16px;
`;

const ChildrenDiv = styled.div`
  margin: 8px;
  margin-left: 0;
`;

const W = 12;

const IconWrapper = styled.div`
  position: absolute;
  left: -${W / 2 + W / 4}px;
  width: ${W}px;
  height: ${W}px;
  top: 50%;
  overflow: hidden;
  transform: translateY(-50%);

  background-color: ${vscBackground};
  border-radius: 50%;
  //   outline: 1px solid ${lightGray};

  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${W / 4}px;
`;

export function ThreadDiv(props: ThreadDivProps) {
  return (
    <Container>
      <IconWrapper>{props.icon}</IconWrapper>
      <ChildrenDiv>{props.children}</ChildrenDiv>
    </Container>
  );
}
