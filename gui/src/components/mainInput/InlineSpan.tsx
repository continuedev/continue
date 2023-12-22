interface InlineSpanProps {
  color?: string;
  children: React.ReactNode;
}

function InlineSpan(props: InlineSpanProps) {
  return (
    <span
      style={{
        color: props.color,
        float: "right",
        textAlign: "right",
      }}
      className="whitespace-nowrap overflow-hidden overflow-ellipsis ml-2"
    >
      {props.children}
    </span>
  );
}

export default InlineSpan;
