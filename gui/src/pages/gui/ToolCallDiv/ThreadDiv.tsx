import styled from "styled-components";

interface ThreadDivProps {
  children: React.ReactNode;
  icon: React.ReactNode;
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  position: relative;
  padding: 8px;
`;

const ChildrenDiv = styled.div`
  margin: 8px;
  margin-left: 0;
`;

const W = 16;

const HeaderDiv = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
`;

export function ThreadDiv(props: ThreadDivProps) {
  return (
    <Container>
      <HeaderDiv>
        <div style={{ width: `${W}px`, height: `${W}px`, fontWeight: "bold" }}>
          {props.icon}
        </div>
        Continue wants to create a new file
      </HeaderDiv>
      <ChildrenDiv>{props.children}</ChildrenDiv>
    </Container>
  );
}
