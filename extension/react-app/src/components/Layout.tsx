import styled from "styled-components";
import { defaultBorderRadius } from ".";
import { Outlet } from "react-router-dom";

const LayoutTopDiv = styled.div`
  height: 100%;
  border-radius: ${defaultBorderRadius};
  scrollbar-base-color: transparent;
  scrollbar-width: thin;
`;

const Layout = () => {
  return (
    <LayoutTopDiv>
      <div
        style={{
          scrollbarGutter: "stable both-edges",
          minHeight: "100%",
          display: "grid",
          gridTemplateRows: "1fr auto",
        }}
      >
        <Outlet />
      </div>
    </LayoutTopDiv>
  );
};

export default Layout;
