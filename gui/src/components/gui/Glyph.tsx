import type React from "react"
import styled from "styled-components"
import { lightGray } from ".."

const StyledGlyph = styled.span`
  position: relative;
  display: inline-block;
  font-family: var(--monaco-monospace-font);
  font-size: 22px;
  font-weight: lighter;
  vertical-align: -0.1rem;
  margin: 0 6px 0 2px;
  line-height: 0.7;
  color: --vscode-editor-foreground;
  z-index: 1;

  &::before {
    content: "";
    position: absolute;
    top: 66%;
    left: -10%;
    transform: translateY(-50%);
    width: 17px;
    height: 17px;
    border: 1px solid ${lightGray}33;
    background-color: ${lightGray}33;
    border-radius: 3px;
    box-sizing: border-box;
    z-index: -1;
  }
`

interface GlyphProps {
  children: string
}

const Glyph: React.FC<GlyphProps> = ({ children }) => {
  if (children !== "+") {
    console.warn('Currently, only the "+" glyph is supported.')
    return null
  }

  return <StyledGlyph>{children}</StyledGlyph>
}

export default Glyph